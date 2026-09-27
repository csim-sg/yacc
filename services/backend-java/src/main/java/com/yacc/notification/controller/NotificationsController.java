package com.yacc.notification.controller;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.yacc.auth.model.AuthUser;
import com.yacc.common.model.BaseListResponse;
import com.yacc.notification.model.MarkAllReadEnvelope;
import com.yacc.notification.model.MarkNotificationReadRequest;
import com.yacc.notification.model.NotificationEnvelope;
import com.yacc.notification.model.NotificationResponse;
import com.yacc.notification.service.NotificationService;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import jakarta.validation.Valid;

/**
 * Notification wire surface (ledger rows REST-NOTIF-001..004; frozen
 * contract ops {@code listNotifications}, {@code markNotificationRead},
 * {@code dismissNotification}, {@code markAllNotificationsRead}). Every
 * operation is scoped to the authenticated user.
 */
@RestController
@RequestMapping("/api/notifications")
public class NotificationsController {

    private final NotificationService notifications;
    private final ObjectMapper mapper;

    public NotificationsController(NotificationService notifications, ObjectMapper mapper) {
        this.notifications = notifications;
        this.mapper = mapper;
    }

    @GetMapping
    public BaseListResponse<NotificationResponse> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @AuthenticationPrincipal AuthUser principal) {
        var result = notifications.list(principal.getId(), page, pageSize);
        return BaseListResponse.of(
                result.items().stream()
                        .map(notification -> NotificationResponse.from(notification, mapper))
                        .toList(),
                result.page(), result.limit(), result.total());
    }

    @PatchMapping("/{id}")
    public NotificationEnvelope markRead(@PathVariable("id") UUID id,
            @Valid @RequestBody MarkNotificationReadRequest request,
            @AuthenticationPrincipal AuthUser principal) {
        return new NotificationEnvelope(
                NotificationResponse.from(notifications.markRead(id, principal.getId()), mapper));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void dismiss(@PathVariable("id") UUID id, @AuthenticationPrincipal AuthUser principal) {
        notifications.dismiss(id, principal.getId());
    }

    @PostMapping("/mark-all-read")
    public MarkAllReadEnvelope markAllRead(@AuthenticationPrincipal AuthUser principal) {
        long marked = notifications.markAllRead(principal.getId());
        ObjectNode data = mapper.createObjectNode();
        data.put("markedCount", marked);
        return new MarkAllReadEnvelope(data);
    }
}
