package com.yacc.user.model;

import java.time.LocalDateTime;

/**
 * Created-user representation (frozen contract component
 * {@code CreateUserResponse}).
 */
public record CreateUserResponse(
        String id,
        String email,
        String name,
        String role,
        String status,
        LocalDateTime createdAt) {

    public static CreateUserResponse from(com.yacc.auth.model.User user) {
        return new CreateUserResponse(
                user.getId(),
                user.getEmail(),
                user.getName(),
                user.getRole().getLabel(),
                user.getStatus().getLabel(),
                user.getCreatedAt());
    }
}
