package com.yacc.api.user;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.yacc.entity.UserRole;
import com.yacc.entity.UserStatus;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

/**
 * Partial user-update body (frozen contract component
 * {@code UpdateUserBody}, op {@code updateUser}). Self role/status
 * modification is rejected by the service (ledger row REST-USER-003).
 *
 * @param email new email, null to leave unchanged
 * @param name new display name, null to leave unchanged
 * @param role new role, null to leave unchanged
 * @param status new status, null to leave unchanged
 */
// Contract UpdateUserBody: every member is optional and non-nullable —
// absent stays absent on re-emitted wire JSON (MIG-102).
@JsonInclude(JsonInclude.Include.NON_NULL)
public record UpdateUserRequest(
        @Email @Size(max = 255) String email,
        String name,
        UserRole role,
        UserStatus status) {
}
