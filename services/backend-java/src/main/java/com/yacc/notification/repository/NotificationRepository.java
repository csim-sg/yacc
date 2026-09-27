package com.yacc.notification.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.yacc.notification.model.Notification;

/**
 * Spring Data JPA repository for {@link Notification} (MIG-021; ADR-027/ARCH-004 §7).
 */
public interface NotificationRepository extends JpaRepository<Notification, java.util.UUID> {
}
