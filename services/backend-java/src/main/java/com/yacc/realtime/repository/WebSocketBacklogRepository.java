package com.yacc.realtime.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.yacc.realtime.model.WebSocketBacklog;

/**
 * Spring Data JPA repository for {@link WebSocketBacklog} (MIG-021;
 * ADR-027/ARCH-004 §7). Replay/sweep behavior is MIG-051.
 */
public interface WebSocketBacklogRepository extends JpaRepository<WebSocketBacklog, Long> {
}
