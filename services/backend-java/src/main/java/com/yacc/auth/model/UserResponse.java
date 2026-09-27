package com.yacc.auth.model;

import java.time.LocalDateTime;

/**
 * Canonical wire user object (MIG-030; frozen contract
 * {@code openapi.yaml} / {@code UserResponse}; contract-canonicalization §1.2):
 * {@code id} is a uuid string, {@code role} is the lowercase wire enum
 * ({@code super_admin|admin|manager|user}), {@code status} the lowercase
 * status enum. This is the single user shape for every auth response.
 *
 * @param id            user uuid
 * @param email         email address
 * @param name          display name
 * @param role          lowercase wire role label
 * @param status        lowercase wire status label
 * @param emailVerified whether the email is verified (optional on the wire)
 * @param createdAt     creation timestamp
 * @param updatedAt     last-update timestamp
 */
public record UserResponse(
        String id,
        String email,
        String name,
        String role,
        String status,
        boolean emailVerified,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {

    /** Maps a persisted identity to its canonical wire shape. */
    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getName(),
                user.getRole().getLabel(),
                user.getStatus().getLabel(),
                user.isEmailVerified(),
                user.getCreatedAt(),
                user.getUpdatedAt());
    }
}
