package com.yacc.routingrule.controller;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.yacc.auth.model.AuthUser;
import com.yacc.common.model.BaseListResponse;
import com.yacc.routingrule.model.RoutingRuleExecutionResponse;
import com.yacc.routingrule.model.RoutingRuleResponse;
import com.yacc.routingrule.model.RoutingRuleWrite;
import com.yacc.routingrule.service.RoutingRulesService;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.validation.Valid;

/**
 * Routing-rule wire surface (ledger rows REST-RULES-001..005; frozen
 * contract ops {@code listRoutingRules}, {@code createRoutingRule},
 * {@code updateRoutingRule}, {@code deleteRoutingRule},
 * {@code getRoutingRuleExecutions}): manager+ reads, admin+ writes.
 */
@RestController
public class RoutingRulesController {

    private final RoutingRulesService rules;
    private final ObjectMapper objectMapper;

    public RoutingRulesController(RoutingRulesService rules, ObjectMapper objectMapper) {
        this.rules = rules;
        this.objectMapper = objectMapper;
    }

    @GetMapping("/api/routing-rules")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','MANAGER')")
    public BaseListResponse<RoutingRuleResponse> list() {
        var all = rules.list();
        return BaseListResponse.of(
                all.stream().map(rule -> RoutingRuleResponse.from(rule, objectMapper)).toList(),
                1, all.size(), all.size());
    }

    @PostMapping("/api/routing-rules")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public RuleEnvelope create(@Valid @RequestBody RoutingRuleWrite request,
            @AuthenticationPrincipal AuthUser principal) {
        return new RuleEnvelope(RoutingRuleResponse.from(
                rules.create(UUID.fromString(principal.getId()), request), objectMapper));
    }

    @PatchMapping("/api/routing-rules/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
    public RuleEnvelope update(@PathVariable("id") UUID id,
            @Valid @RequestBody RoutingRuleWrite request,
            @AuthenticationPrincipal AuthUser principal) {
        return new RuleEnvelope(RoutingRuleResponse.from(
                rules.update(id, request, UUID.fromString(principal.getId())), objectMapper));
    }

    @DeleteMapping("/api/routing-rules/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
    public RuleEnvelope delete(@PathVariable("id") UUID id,
            @AuthenticationPrincipal AuthUser principal) {
        var rule = rules.getById(id);
        rules.delete(id, UUID.fromString(principal.getId()));
        return new RuleEnvelope(RoutingRuleResponse.from(rule, objectMapper));
    }

    @GetMapping("/api/routing-rules/{id}/executions")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','MANAGER')")
    public BaseListResponse<RoutingRuleExecutionResponse> executions(
            @PathVariable("id") UUID id,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int pageSize) {
        var result = rules.executions(id, page, pageSize);
        return BaseListResponse.of(
                result.items().stream()
                        .map(execution -> RoutingRuleExecutionResponse.from(execution, objectMapper))
                        .toList(),
                result.page(), result.limit(), result.total());
    }

    /**
     * Single-rule envelope {@code {data: RoutingRule}}.
     *
     * @param data the rule
     */
    public record RuleEnvelope(RoutingRuleResponse data) {
    }
}
