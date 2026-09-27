package com.yacc.notification.service;

import java.util.UUID;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.yacc.auth.service.UserDirectoryService;
import com.yacc.common.controller.NotFoundException;
import com.yacc.notification.model.Notification;
import com.yacc.notification.repository.NotificationRepository;

/**
 * Notification management (ledger rows REST-NOTIF-001..004; POC
 * {@code notifications.service} parity): own-scope listing with clamped
 * pagination, ownership-enforced read/dismiss, bulk mark-read, and the
 * deduplicated creation API that other bounded contexts compose through
 * (assignment and mention notifications; ADR-030).
 */
@Service
public class NotificationService {

    private final NotificationRepository notifications;
    private final UserDirectoryService directory;

    public NotificationService(NotificationRepository notifications, UserDirectoryService directory) {
        this.notifications = notifications;
        this.directory = directory;
    }

    /**
     * Creates a notification for the user (deduped on user + type +
     * conversation — POC {@code onConflictDoNothing} parity). Fails silently
     * for unknown users? No — the caller validated the user; creation never
     * breaks the surrounding flow, matching the POC's best-effort call sites.
     */
    @Transactional
    public void createDeduped(String userId, String type, UUID conversationId, String actorId,
            String message, String metadataJson) {
        if (conversationId != null && notifications.existsByUserIdAndTypeAndConversationId(
                userId, type, conversationId)) {
            return;
        }
        if (!directory.existsLiveById(userId)) {
            return;
        }
        notifications.save(new Notification(UUID.randomUUID(), userId, type, conversationId,
                actorId, message));
    }

    /** Own-scope page (most recent first). */
    @Transactional(readOnly = true)
    public NotificationPage list(String userId, int oneIndexedPage, int pageSize) {
        int page = Math.max(1, oneIndexedPage);
        int limit = Math.min(100, Math.max(1, pageSize));
        var result = notifications.findByUserId(userId,
                PageRequest.of(page - 1, limit, Sort.by(Sort.Direction.DESC, "createdAt")));
        return new NotificationPage(result.getContent(), result.getTotalElements(), page, limit);
    }

    /** Marks the user's own notification read; 404 when absent or foreign. */
    @Transactional
    public Notification markRead(UUID notificationId, String userId) {
        Notification notification = owned(notificationId, userId);
        notification.setRead(true);
        return notifications.save(notification);
    }

    /** Deletes the user's own notification; 404 when absent or foreign. */
    @Transactional
    public void dismiss(UUID notificationId, String userId) {
        notifications.delete(owned(notificationId, userId));
    }

    /** Marks every unread notification of the user read; returns the count. */
    @Transactional
    public long markAllRead(String userId) {
        var unread = notifications.findByUserIdAndIsReadFalse(userId);
        unread.forEach(notification -> notification.setRead(true));
        notifications.saveAll(unread);
        return unread.size();
    }

    private Notification owned(UUID notificationId, String userId) {
        return notifications.findByIdAndUserId(notificationId, userId)
                .orElseThrow(() -> new NotFoundException("Notification not found or access denied"));
    }

    /** One own-scope page.
     *
     * @param items page items
     * @param total all notifications of the user
     * @param page 1-indexed page
     * @param limit page size
     */
    public record NotificationPage(java.util.List<Notification> items, long total, int page, int limit) {
    }
}
