package com.yacc.api.user;

/**
 * Updated-user representation (frozen contract component
 * {@code UpdateUserResponse}).
 */
public record UpdateUserResponse(
        String id,
        String email,
        String name,
        String role,
        String status) {

    public static UpdateUserResponse from(com.yacc.entity.User user) {
        return new UpdateUserResponse(
                user.getId(),
                user.getEmail(),
                user.getName(),
                user.getRole().getLabel(),
                user.getStatus().getLabel());
    }
}
