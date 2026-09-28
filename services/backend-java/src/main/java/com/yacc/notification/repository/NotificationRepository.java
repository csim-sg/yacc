package com.yacc.notification.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.yacc.notification.model.Notification;

/**
 * Spring Data JPA repository for {@link Notification} (MIG-021; ADR-027).
 * Derived queries only — no raw SQL.
 */
public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    Page<Notification> findByUserId(String userId, Pageable pageable);

    List<Notification> findByUserId(String userId);

    List<Notification> findByUserIdAndIsReadFalse(String userId);

    Optional<Notification> findByIdAndUserId(UUID id, String userId);

    boolean existsByUserIdAndTypeAndConversationId(String userId, String type, UUID conversationId);
}
