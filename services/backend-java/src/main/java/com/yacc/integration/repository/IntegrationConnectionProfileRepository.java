package com.yacc.integration.repository;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import com.yacc.integration.model.IntegrationConnectionProfile;

/**
 * Spring Data JPA repository for {@link IntegrationConnectionProfile}
 * (MIG-021; ADR-027/ARCH-004 §7).
 */
public interface IntegrationConnectionProfileRepository
        extends JpaRepository<IntegrationConnectionProfile, Integer> {

    Optional<IntegrationConnectionProfile> findByIntegrationTypeAndName(String integrationType, String name);
}
