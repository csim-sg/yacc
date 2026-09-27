package com.yacc.routingrule.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.yacc.audit.model.AuditRecord;
import com.yacc.audit.service.AuditPersistence;
import com.yacc.auth.service.UserDirectoryService;
import com.yacc.common.controller.BadRequestException;
import com.yacc.common.controller.NotFoundException;
import com.yacc.routingrule.model.ExecutionPage;
import com.yacc.routingrule.model.RoutingRule;
import com.yacc.routingrule.model.RoutingRuleWrite;
import com.yacc.routingrule.repository.RoutingRuleExecutionRepository;
import com.yacc.routingrule.repository.RoutingRuleRepository;
import com.yacc.tag.service.TagService;

/**
 * Routing-rule CRUD + execution-log queries (ledger rows
 * REST-RULES-001..005; ADR-021 lenient rule JSON re-expressed: conditions
 * and actions accept any valid JSON; referenced entities — tags and
 * assignee users — are strictly validated; evaluation-time enforcement is
 * the rules engine's concern). Composes through the tag and auth contexts'
 * public service APIs (ADR-030).
 */
@Service
public class RoutingRulesService {

    private final RoutingRuleRepository rules;
    private final RoutingRuleExecutionRepository executions;
    private final TagService tags;
    private final UserDirectoryService directory;
    private final AuditPersistence audit;
    private final ObjectMapper mapper;

    public RoutingRulesService(RoutingRuleRepository rules,
            RoutingRuleExecutionRepository executions,
            TagService tags, UserDirectoryService directory, AuditPersistence audit,
            ObjectMapper mapper) {
        this.rules = rules;
        this.executions = executions;
        this.tags = tags;
        this.directory = directory;
        this.audit = audit;
        this.mapper = mapper;
    }

    /** All rules by priority (envelope carries limit=total, POC parity). */
    @Transactional(readOnly = true)
    public List<RoutingRule> list() {
        return rules.findByOrderByPriorityAsc();
    }

    /** One rule by id (404 when absent). */
    @Transactional(readOnly = true)
    public RoutingRule getById(UUID ruleId) {
        return rules.findById(ruleId)
                .orElseThrow(() -> new NotFoundException("Rule not found"));
    }

    /** Creates a rule with lenient-JSON + strict-reference validation. */
    @Transactional
    public RoutingRule create(UUID actorId, RoutingRuleWrite request) {
        if (request.name() == null || request.name().isBlank()) {
            throw new BadRequestException("Rule name is required");
        }
        if (request.priority() == null) {
            throw new BadRequestException("Priority is required");
        }
        request.assertPriorityInRange();
        validateReferences(request.conditions(), request.actions());
        RoutingRule rule = new RoutingRule(UUID.randomUUID(), request.name().trim(),
                request.statusOrDefault(), request.priority(),
                toJson(request.conditions()), toJson(request.actions()), actorId.toString());
        rule.setDescription(request.description());
        RoutingRule saved = rules.save(rule);

        ObjectNode metadata = mapper.createObjectNode();
        metadata.put("ruleName", saved.getName());
        metadata.put("status", saved.getStatus());
        metadata.put("priority", saved.getPriority());
        audit.persist(new AuditRecord("rule.created", "rule", saved.getId().toString(),
                actorId.toString(), metadata, null));
        return saved;
    }

    /** Partially updates a rule (PATCH semantics — only provided fields). */
    @Transactional
    public RoutingRule update(UUID ruleId, RoutingRuleWrite request, UUID actorId) {
        if (request.name() != null && request.name().isBlank()) {
            throw new BadRequestException("Rule name is required");
        }
        request.assertPriorityInRange();
        RoutingRule rule = rules.findById(ruleId)
                .orElseThrow(() -> new NotFoundException("Rule not found"));
        validateReferences(request.conditions(), request.actions());
        if (request.name() != null) {
            rule.setName(request.name().trim());
        }
        if (request.description() != null) {
            rule.setDescription(request.description().trim());
        }
        if (request.status() != null) {
            rule.setStatus(request.statusOrDefault());
        }
        if (request.priority() != null) {
            rule.setPriority(request.priority());
        }
        if (request.conditions() != null) {
            rule.setConditions(toJson(request.conditions()));
        }
        if (request.actions() != null) {
            rule.setActions(toJson(request.actions()));
        }
        rule.setUpdatedAt(LocalDateTime.now());
        RoutingRule saved = rules.save(rule);

        ObjectNode metadata = mapper.createObjectNode();
        metadata.put("ruleName", saved.getName());
        ObjectNode changes = metadata.putObject("changes");
        changes.put("name", request.name() != null);
        changes.put("status", request.status() != null);
        changes.put("priority", request.priority() != null);
        changes.put("conditions", request.conditions() != null);
        changes.put("actions", request.actions() != null);
        audit.persist(new AuditRecord("rule.updated", "rule", ruleId.toString(),
                actorId.toString(), metadata, null));
        return saved;
    }

    /** Deletes a rule (executions cascade). */
    @Transactional
    public void delete(UUID ruleId, UUID actorId) {
        RoutingRule rule = rules.findById(ruleId)
                .orElseThrow(() -> new NotFoundException("Rule not found"));
        rules.delete(rule);
        ObjectNode metadata = mapper.createObjectNode();
        metadata.put("ruleName", rule.getName());
        audit.persist(new AuditRecord("rule.deleted", "rule", ruleId.toString(),
                actorId.toString(), metadata, null));
    }

    /** Execution-log page for one rule. */
    @Transactional(readOnly = true)
    public ExecutionPage executions(UUID ruleId, int page, int pageSize) {
        if (!rules.existsById(ruleId)) {
            throw new NotFoundException("Rule not found");
        }
        int safePage = Math.max(1, page);
        int limit = Math.min(100, Math.max(1, pageSize));
        var result = executions.findByRuleId(ruleId,
                PageRequest.of(safePage - 1, limit, Sort.by(Sort.Direction.DESC, "createdAt")));
        return new ExecutionPage(result.getContent(), result.getTotalElements(), safePage, limit);
    }

    /**
     * ADR-021 compromise: lenient structure, STRICT validation of referenced
     * entities — tag conditions require an existing tag; assign actions an
     * existing user; tag actions an existing tag; priority actions the
     * frozen enum. Structure itself is NOT rejected (evaluation-time
     * concern).
     */
    private void validateReferences(JsonNode conditions, JsonNode actions) {
        if (conditions != null && conditions.isArray()) {
            for (JsonNode condition : conditions) {
                if ("tag".equals(text(condition, "field"))) {
                    Integer tagId = intOf(condition.get("value"));
                    if (tagId == null || !tags.exists(tagId)) {
                        throw new BadRequestException("Tag " + condition.get("value") + " not found");
                    }
                }
            }
        }
        if (actions != null && actions.isArray()) {
            for (JsonNode action : actions) {
                String type = text(action, "type");
                if ("assign".equals(type)) {
                    String userId = text(action, "value");
                    if (userId == null || !directory.existsLiveById(userId)) {
                        throw new BadRequestException("User " + action.get("value") + " not found");
                    }
                } else if ("tag".equals(type)) {
                    Integer tagId = intOf(action.get("value"));
                    if (tagId == null || !tags.exists(tagId)) {
                        throw new BadRequestException("Tag " + action.get("value") + " not found");
                    }
                } else if ("priority".equals(type)) {
                    String value = text(action, "value");
                    if (value == null || !List.of("low", "normal", "high", "urgent").contains(value)) {
                        throw new BadRequestException("Invalid priority value: " + value);
                    }
                }
            }
        }
    }

    private String toJson(JsonNode node) {
        return node == null ? null : node.toString();
    }

    private static String text(JsonNode node, String field) {
        return node != null && node.hasNonNull(field) && node.get(field).isTextual()
                ? node.get(field).asText() : null;
    }

    private static Integer intOf(JsonNode node) {
        if (node == null) {
            return null;
        }
        if (node.isNumber()) {
            return node.asInt();
        }
        if (node.isTextual()) {
            try {
                return Integer.parseInt(node.asText());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

}
