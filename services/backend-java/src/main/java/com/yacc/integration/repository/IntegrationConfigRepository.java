package com.yacc.integration.repository;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import com.yacc.integration.model.IntegrationConfig;

/**
 * Spring Data JPA repository for {@link IntegrationConfig} (MIG-021;
 * ADR-027/ARCH-004 §7).
 */
public interface IntegrationConfigRepository extends JpaRepository<IntegrationConfig, Integer> {

    Optional<IntegrationConfig> findByPlatform(String platform);
}
