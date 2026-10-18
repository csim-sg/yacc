package com.yacc.api.conversation;

import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.yacc.api.auth.AuthUser;
import com.yacc.api.conversation.BulkActionEnvelope;
import com.yacc.api.conversation.BulkActionRequest;
import com.yacc.api.conversation.BulkActionResponseData;
import com.yacc.api.conversation.BulkActionService;

import jakarta.validation.Valid;

/**
 * Bulk-action wire surface (ledger row REST-BULK-001; frozen contract op
 * {@code bulkActionConversations}): manager+ only, best-effort partial
 * success semantics.
 */
@RestController
@RequestMapping("/api/conversations")
public class BulkActionController {

    private final BulkActionService bulkActions;

    public BulkActionController(BulkActionService bulkActions) {
        this.bulkActions = bulkActions;
    }

    @PostMapping("/bulk")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','MANAGER')")
    public BulkActionEnvelope bulkAction(@Valid @RequestBody BulkActionRequest request,
            @AuthenticationPrincipal AuthUser principal) {
        return new BulkActionEnvelope(bulkActions.apply(request, principal.getId()));
    }
}
