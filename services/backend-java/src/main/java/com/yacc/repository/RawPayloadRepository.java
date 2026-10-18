package com.yacc.repository;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.yacc.entity.RawPayload;

/**
 * Spring Data JPA repository for {@link RawPayload} (MIG-021; ADR-027/ARCH-004 §7).
 */
public interface RawPayloadRepository extends JpaRepository<RawPayload, Integer> {

    Optional<RawPayload> findByMessageIdAndPlatform(UUID messageId, String platform);
}
