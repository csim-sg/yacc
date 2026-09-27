package com.yacc.integration.model;

import java.time.LocalDateTime;

/**
 * Profile response (never carries secrets; POC {@code IrcProfileResponse}
 * parity).
 *
 * @param id             numeric profile id
 * @param name           profile name
 * @param isEnabled      enabled flag
 * @param isActive       single-active flag
 * @param config         non-secret config
 * @param hasPassword    whether a secret is stored
 * @param lastTestedAt   last connection-test timestamp
 * @param lastTestPassed last connection-test outcome
 * @param createdAt      creation timestamp
 * @param updatedAt      last-update timestamp
 */
public record ProfileResponse(Integer id, String name, boolean isEnabled, boolean isActive,
        Profile config, boolean hasPassword, LocalDateTime lastTestedAt,
        Boolean lastTestPassed, LocalDateTime createdAt, LocalDateTime updatedAt) {
}
