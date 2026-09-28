package com.yacc.user.model;

import com.yacc.auth.model.UserRole;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Create-user request body (frozen contract component
 * {@code CreateUserBody}, op {@code createUser}): super_admin-only user
 * provisioning — unlike self-registration this DOES carry a role
 * (ledger row REST-USER-002).
 *
 * @param email new identity email (unique, ≤255 chars)
 * @param password initial credential (≥8 chars, POC parity)
 * @param name display name
 * @param role wire role granted by the super admin
 */
public record CreateUserRequest(
        @NotBlank @Email @Size(max = 255) String email,
        @NotBlank @Size(min = 8) String password,
        @NotBlank String name,
        @NotNull UserRole role) {
}
