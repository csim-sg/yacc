package com.yacc.repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import com.yacc.entity.WebSocketBacklogEntry;

/**
 * Spring Data JPA repository for {@link WebSocketBacklogEntry} (MIG-051;
 * ADR-027/ARCH-004 §7).
 *
 * <p>Replay reads by user ordered by emission, filtering the 1h window on
 * {@code expires_at} (replay correctness never depends on the sweep);
 * deletion supports the post-replay clear (store/replay/clear lifecycle,
 * WS-BHV-009) and the scheduled expired-row sweep.</p>
 */
public interface WebSocketBacklogRepository extends JpaRepository<WebSocketBacklogEntry, Long> {

    /** Unexpired backlog rows of one user, oldest first (replay order). */
    List<WebSocketBacklogEntry> findByUserIdAndExpiresAtAfterOrderByEmittedAtAsc(
            String userId, LocalDateTime now);

    /** Storage hygiene: deletes every expired row; returns the row count. */
    @Transactional
    long deleteByExpiresAtBefore(LocalDateTime now);

    /**
     * Deletes exactly the enumerated rows of one user — the rows delivered by
     * a replay (the full read set on success, the delivered prefix on an
     * incomplete delivery). Scoping the post-replay clear to the read set
     * never drops rows stored for the user while a replay is in flight.
     */
    @Transactional
    long deleteByUserIdAndIdIn(@Param("userId") String userId,
            @Param("ids") Collection<Long> ids);

    /** Deletes every row of one user (fixture cleanup / maintenance). */
    @Transactional
    long deleteByUserId(String userId);
}
