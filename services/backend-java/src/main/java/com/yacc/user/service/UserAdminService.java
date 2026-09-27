package com.yacc.user.service;

import java.util.Locale;

import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.yacc.auth.model.User;
import com.yacc.auth.model.UserPage;
import com.yacc.auth.model.UserRole;
import com.yacc.auth.model.UserStatus;
import com.yacc.auth.service.UserDirectoryService;
import com.yacc.common.controller.BadRequestException;
import com.yacc.common.controller.ConflictException;
import com.yacc.common.controller.ForbiddenException;
import com.yacc.common.controller.NotFoundException;
import com.yacc.audit.model.AuditRecord;
import com.yacc.audit.service.AuditPersistence;
import com.yacc.user.model.CreateUserRequest;
import com.yacc.user.model.CreateUserResponse;
import com.yacc.user.model.DeleteUserResponse;
import com.yacc.user.model.UpdateUserRequest;
import com.yacc.user.model.UpdateUserResponse;

/**
 * User-administration policy (ledger rows REST-USER-001..005; POC
 * {@code users.service} parity): pagination/filter validation, the
 * self-modification and self-deletion guards, partial-update semantics, and
 * the {@code users.*} audit trail. Persistence composes through the auth
 * bounded context's public {@link UserDirectoryService} (ADR-030 — no
 * cross-package repository access).
 */
@Service
public class UserAdminService {

    private final UserDirectoryService directory;
    private final AuditPersistence audit;
    private final ObjectMapper mapper;

    public UserAdminService(UserDirectoryService directory, AuditPersistence audit,
            ObjectMapper mapper) {
        this.directory = directory;
        this.audit = audit;
        this.mapper = mapper;
    }

    /**
     * Lists live users, filtered and paginated (POC parity: page ≥ 1, limit
     * restricted to 20/50/100), and audits {@code users.list}.
     */
    public UserPage list(int page, int limit, UserRole role,
            UserStatus status, String search, User actor) {
        if (page < 1) {
            throw new BadRequestException("Page must be >= 1");
        }
        if (limit != 20 && limit != 50 && limit != 100) {
            throw new BadRequestException("Limit must be 20, 50, or 100");
        }
        var result = directory.list(page, limit, role, status, search);
        ObjectNode listMeta = mapper.createObjectNode();
        listMeta.put("page", page);
        listMeta.put("limit", limit);
        listMeta.put("resultCount", result.users().size());
        audit.persist(new AuditRecord("users.list", "user", "list", actor.getId(),
                listMeta, null));
        return result;
    }

    /** Creates a user with any role (super-admin provisioning, 201 path). */
    public CreateUserResponse create(CreateUserRequest request, User actor) {
        if (directory.existsLiveByEmailIgnoreCase(request.email())) {
            throw new ConflictException("Email already registered");
        }
        User created = directory.create(request.email(), request.password(), request.name(),
                request.role(), UserStatus.ACTIVE, false);
        ObjectNode createdMeta = mapper.createObjectNode();
        createdMeta.put("createdUserId", created.getId());
        createdMeta.put("email", created.getEmail());
        createdMeta.put("role", request.role().getLabel());
        createdMeta.put("createdBy", actor.getEmail());
        audit.persist(new AuditRecord("users.created", "user", created.getId(), actor.getId(),
                createdMeta, null));
        return CreateUserResponse.from(created);
    }

    /** Partially updates a user; role/status self-modification is forbidden. */
    public UpdateUserResponse update(String userId, UpdateUserRequest request, User actor) {
        if (actor.getId().equals(userId) && (request.role() != null || request.status() != null)) {
            throw new ForbiddenException("Cannot modify your own role or status");
        }
        User user = directory.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        if (user.getDeletedAt() != null) {
            throw new BadRequestException("Cannot update a deleted user");
        }
        if (request.email() != null
                && directory.existsLiveByEmailIgnoreCaseAndIdNot(request.email(), userId)) {
            throw new ConflictException("Email already in use");
        }
        ObjectNode metadata = mapper.createObjectNode();
        metadata.put("userId", userId);
        metadata.set("changes", changedFields(user, request));
        metadata.put("updatedBy", actor.getEmail());
        User updated = directory.updateFields(user, request.email(), request.name(),
                request.role(), request.status());
        audit.persist(new AuditRecord("users.updated", "user", userId, actor.getId(),
                metadata, null));
        return UpdateUserResponse.from(updated);
    }

    /** Soft-deletes a user; self-deletion is forbidden; idempotent. */
    public DeleteUserResponse delete(String userId, User actor) {
        if (actor.getId().equals(userId)) {
            throw new ForbiddenException("Cannot delete your own account");
        }
        User user = directory.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        if (user.getDeletedAt() != null) {
            return new DeleteUserResponse(user.getId(), user.getDeletedAt());
        }
        User deleted = directory.softDelete(user);
        ObjectNode deletedMeta = mapper.createObjectNode();
        deletedMeta.put("userId", userId);
        deletedMeta.put("email", user.getEmail());
        deletedMeta.put("deletedBy", actor.getEmail());
        deletedMeta.put("reason", "Manual deletion by admin");
        audit.persist(new AuditRecord("users.deleted", "user", userId, actor.getId(),
                deletedMeta, null));
        return new DeleteUserResponse(deleted.getId(), deleted.getDeletedAt());
    }

    /** Builds the POC-parity change summary for the {@code users.updated} audit row. */
    private ObjectNode changedFields(User user, UpdateUserRequest request) {
        ObjectNode changes = mapper.createObjectNode();
        if (request.email() != null && !request.email().equalsIgnoreCase(user.getEmail())) {
            changes.putObject("email").put("from", user.getEmail())
                    .put("to", request.email().toLowerCase(Locale.ROOT));
        }
        if (request.name() != null && !request.name().equals(user.getName())) {
            changes.putObject("name").put("from", user.getName()).put("to", request.name());
        }
        if (request.role() != null && request.role() != user.getRole()) {
            changes.putObject("role").put("from", user.getRole().getLabel())
                    .put("to", request.role().getLabel());
        }
        if (request.status() != null && request.status() != user.getStatus()) {
            changes.putObject("status").put("from", user.getStatus().getLabel())
                    .put("to", request.status().getLabel());
        }
        return changes;
    }
}
