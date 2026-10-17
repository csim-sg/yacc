package com.yacc.api.user;

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

    public static CreateUserResponse from(com.yacc.entity.User user) {
        return new CreateUserResponse(
                user.getId(),
                user.getEmail(),
                user.getName(),
                user.getRole().getLabel(),
                user.getStatus().getLabel(),
                user.getCreatedAt());
    }
}
