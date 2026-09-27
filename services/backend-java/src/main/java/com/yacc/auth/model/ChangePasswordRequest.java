package com.yacc.auth.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Authenticated password change (MIG-030 forced-change contract; ADR-025
 * bootstrap/recovery). Replaces the credential and clears the forced
 * change flag; the current password is verified before the change.
 *
 * @param currentPassword the credential currently on record
 * @param newPassword     the replacement credential (minimum 8 characters)
 */
public record ChangePasswordRequest(
        @NotBlank String currentPassword,
        @NotBlank @Size(min = 8) String newPassword) {
}
