package com.yacc.auth.model;

import java.time.LocalDateTime;

/**
 * Wire representation of a user (frozen contract component
 * {@code UserResponse}): {@code id} UUID string, lowercase {@code role},
 * lowercase {@code status}, and the nullable soft-delete timestamp.
 *
 * @param id user UUID
 * @param email email address
 * @param name display name
 * @param role lowercase wire role (super_admin | admin | manager | user)
 * @param status lowercase wire status (active | inactive | suspended)
 * @param createdAt creation timestamp
 * @param updatedAt last-update timestamp
 * @param deletedAt soft-delete timestamp, null while the identity is live
 */
public record UserResponse(
        String id,
        String email,
        String name,
        String role,
        String status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        LocalDateTime deletedAt) {

    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getName(),
                user.getRole().getLabel(),
                user.getStatus().getLabel(),
                user.getCreatedAt(),
                user.getUpdatedAt(),
                user.getDeletedAt());
    }
}
