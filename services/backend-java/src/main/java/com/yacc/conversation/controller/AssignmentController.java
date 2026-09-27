package com.yacc.conversation.controller;

import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.yacc.auth.model.AuthUser;
import com.yacc.conversation.model.AssignmentResponse;
import com.yacc.conversation.service.AssignmentService;
import com.yacc.common.controller.ForbiddenException;

import jakarta.validation.constraints.NotBlank;

/**
 * POST-surface assignment (ledger row REST-ASSIGN-001; frozen contract op
 * {@code assignConversationByPost}): manager+ in-code RBAC — the POC
 * enforced the role check inside the controller, mirrored here as an
 * explicit {@code user}-role denial with the same 403 message.
 */
@RestController
public class AssignmentController {

    private final AssignmentService assignments;

    public AssignmentController(AssignmentService assignments) {
        this.assignments = assignments;
    }

    @PostMapping("/api/conversations/{conversationId}/assign")
    public AssignmentEnvelope assign(@PathVariable("conversationId") UUID conversationId,
            @jakarta.validation.Valid @RequestBody AssignBody body,
            @AuthenticationPrincipal AuthUser principal) {
        if (principal.getRole() == com.yacc.auth.model.UserRole.USER) {
            throw new ForbiddenException("Only manager or higher can assign conversations");
        }
        return new AssignmentEnvelope(
                assignments.assign(conversationId, body.assignedUserId(), principal.getId()));
    }

    /** Assignment body (frozen contract op {@code assignConversationByPost}). */
    public record AssignBody(@NotBlank String assignedUserId) {
    }

    /**
     * Assignment result envelope {@code {data: AssignmentResponse}}.
     *
     * @param data the assignment result
     */
    public record AssignmentEnvelope(AssignmentResponse data) {
    }
}
