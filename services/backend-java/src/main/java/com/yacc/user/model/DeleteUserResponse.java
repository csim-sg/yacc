package com.yacc.user.model;

import java.time.LocalDateTime;

/**
 * Soft-deleted-user representation (frozen contract component
 * {@code DeleteUserResponse}).
 *
 * @param id deleted user UUID
 * @param deletedAt soft-delete timestamp
 */
public record DeleteUserResponse(String id, LocalDateTime deletedAt) {
}
