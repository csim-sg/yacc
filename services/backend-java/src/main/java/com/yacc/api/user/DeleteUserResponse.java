package com.yacc.api.user;

import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Soft-deleted-user representation (frozen contract component
 * {@code DeleteUserResponse}).
 *
 * @param id deleted user UUID
 * @param deletedAt soft-delete timestamp
 */
// Contract DeleteUserResponse: both members are optional and non-nullable —
// absent stays absent on the wire; never emitted as null (MIG-102).
@JsonInclude(JsonInclude.Include.NON_NULL)
public record DeleteUserResponse(String id, LocalDateTime deletedAt) {
}
