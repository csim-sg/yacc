# ADR-021: Lenient JSON Schema Validation for Routing Rules

**Title**: Lenient JSON Schema Validation for Routing Rules Conditions and Actions  
**Status**: Approved  
**Date**: 2026-02-25  
**Author**: Product Owner + Enterprise Architect  
**Decision Authority**: EA-003 (Architecture Decision Making)

---

## Context

YACC Phase 2 introduces **routing rules** — user-defined automation that assigns, tags, and prioritizes conversations based on conditions. Rules have:

- **Conditions**: Flexible matching logic (channel, keyword, sender, tag, time, future extensions)
- **Actions**: Flexible target operations (assign, tag, set_priority, future extensions)

Both conditions and actions are **user-specified JSON structures** stored in the database. The system must:

1. Accept and store rules at creation time
2. Evaluate rules when inbound messages arrive
3. Support future extensions (new condition/action types) without breaking existing rules

Two validation strategies are possible:

### Strategy A: Strict Schema Validation

**Approach**: Validate structure against a rigid JSON schema at creation time.

**Examples**:
```json
// ✅ ACCEPTED
{
  "type": "and",
  "conditions": [
    { "type": "channel", "operator": "eq", "value": "telegram_group_123" },
    { "type": "keyword", "operator": "contains", "value": "urgent" }
  ]
}

// ❌ REJECTED at creation time
{
  "type": "and",
  "conditions": [
    { "type": "channel", "operator": "eq", "value": "telegram_group_123" },
    { "type": "unknown_future_type", "value": "something" }  // Unknown type → 400 error
  ]
}
```

**Pros**:
- Early error detection (user knows immediately if config is wrong)
- Clearer error messages (schema mismatch reported at save time)
- Simpler debugging (no "silent failures" at evaluation time)

**Cons**:
- Breaking changes: Adding new condition/action types requires schema migration
- Old UI can't create rules using new conditions (users confused)
- New backend feature blocked on UI update
- Not future-proof (schema must be versioned)

### Strategy B: Lenient JSON Storage (CHOSEN)

**Approach**: Accept any valid JSON at creation time. Validate structure at evaluation time (when message arrives).

**Examples**:
```json
// ✅ ACCEPTED at creation time
{
  "type": "and",
  "conditions": [
    { "type": "channel", "operator": "eq", "value": "telegram_group_123" },
    { "type": "keyword", "operator": "contains", "value": "urgent" }
  ]
}

// ✅ ALSO ACCEPTED at creation time (even though condition is unknown)
{
  "type": "and",
  "conditions": [
    { "type": "channel", "operator": "eq", "value": "telegram_group_123" },
    { "type": "future_condition_type", "value": "something" }  // Stored successfully
  ]
}

// ❌ At evaluation time (message arrival), unknown condition type is skipped/ignored
// Rule execution log shows: matched_conditions: [channel match], missed: [unknown_condition]
```

**Pros**:
- **Extensible**: New condition/action types can be added by backend without blocking UI
- **Forward-compatible**: Old UI can create rules that new backend understands
- **No schema migration**: Rules stored as flexible JSON blobs
- **Future-proof**: System gracefully handles unknown types (logs for debugging)

**Cons**:
- **Silent failures**: Invalid rules "work" (stored successfully) until evaluated
- **Harder debugging**: Invalid syntax not caught until message arrives
- **User confusion**: Rule may be saved but never actually fire (no error message)

---

## Decision

**Use Strategy B: Lenient JSON Storage with Strict Validation on Referenced Entities**

### Rationale

1. **Extensibility** is critical for long-term system evolution
   - Phase 2 defines 5 condition types (channel, keyword, sender, tag, time)
   - Phase 3+ may add new types (conversation status, message length, etc.)
   - Strategy B allows new types without blocking users or requiring schema updates

2. **Forward Compatibility** enables agile deployment
   - New backend features can go live without waiting for UI updates
   - Old UI can still create valid rules that new backend understands
   - Reduces coordination overhead between frontend and backend teams

3. **Risk is Mitigated** by comprehensive operational visibility
   - **Execution logs** show exactly which conditions matched/missed (post-eval inspection)
   - **Test endpoint** (`POST /api/routing-rules/:ruleId/test`) allows dry-run before save
   - **Audit logging** tracks all rule changes with actor/timestamp
   - **Admin warnings** can be added to UI for unrecognized condition types (optional)

4. **User Experience** is reasonable
   - Test endpoint lets advanced users validate rules before saving
   - Execution logs visible in admin UI (query by rule_id)
   - Failed rules show up in logs with clear reasons (non-matching conditions, etc.)

### Compromise: Strict Validation on Referenced Entities

To balance extensibility with safety, we enforce **strict validation on referenced entities**:

```typescript
// ❌ REJECTED at creation time: User not found or inactive
{
  "type": "sequence",
  "actions": [
    { "type": "assign", "value": "user-uuid-that-doesnt-exist" }  // 400 error
  ]
}

// ❌ REJECTED at creation time: Tag not found
{
  "type": "sequence",
  "actions": [
    { "type": "tag", "value": "tag-uuid-that-doesnt-exist" }  // 400 error
  ]
}

// ✅ ACCEPTED: User/tag exist, but condition type is unknown (lenient)
{
  "type": "and",
  "conditions": [
    { "type": "future_condition", "value": "something" }  // Stored, evaluated at runtime
  ],
  "actions": [
    { "type": "assign", "value": "alice-uuid" }  // Valid user UUID
  ]
}
```

**Benefit**: Prevents "rule points to non-existent user" situations while allowing schema evolution.

---

## Alternatives Considered

### Alternative 1: Versioned Schemas
**Approach**: Store multiple schema versions (v1, v2, v3); upgrade on write.

**Decision**: Rejected (increases complexity, versioning overhead, backward compatibility burden)

### Alternative 2: Strict with Feature Flags
**Approach**: Strict schema, but use feature flags to enable/disable new condition types.

**Decision**: Rejected (adds operational complexity, not worth maintenance burden for this use case)

### Alternative 3: Type Registration System
**Approach**: Runtime registry of supported condition/action types; validate against registry.

**Decision**: Rejected (over-engineered for Phase 2 scope; lenient storage achieves same goal with less code)

---

## Implications

### For Backend Development

1. **Rules Evaluation Engine** (in `services/routing-rules.service.ts`)
   - Must handle **unknown condition types gracefully** (skip with logging, don't error)
   - Must handle **unknown action types gracefully** (skip with logging, don't error)
   - Must log matched/missed conditions and applied/skipped actions to `routing_rule_executions` table
   - Should NOT crash or throw if condition type is unrecognized

2. **Rule Execution Logging**
   - Every rule evaluation → one row in `routing_rule_executions`
   - Must capture: `matched_conditions` (JSON), `applied_actions` (JSON), `executed_at`
   - Must show: which conditions matched, which actions were applied
   - Must show: which conditions/actions were skipped (unknown types)

3. **Test Endpoint** (`POST /api/routing-rules/:ruleId/test`)
   - Simulates rule evaluation with sample message
   - Dry-run (doesn't persist, doesn't trigger notifications)
   - Response shows: matched_conditions, applied_actions, would-be-actions
   - Allows users to verify rule before going live

4. **Error Handling at Create Time**
   - Validate all `action.value` user UUIDs exist and are active
   - Validate all tag UUIDs exist (can be deleted later via soft delete)
   - If validation fails → 400 error, don't store rule
   - JSON schema structure NOT validated (accepted as-is)

### For Frontend Development

1. **Rule Builder UI**
   - Show available condition types (but don't reject unknown types)
   - Show available action types (but don't reject unknown types)
   - Provide **Test button** → calls POST /api/routing-rules/:ruleId/test before save
   - Display test results (matched conditions, applied actions)

2. **Rule Execution Logs UI**
   - Query: `GET /api/routing-rules/:ruleId/executions`
   - Show: matched_conditions (JSON), applied_actions (JSON), executed_at
   - Allow filtering by date range
   - Show success/failure rate per rule (for monitoring)

3. **Warning for Unrecognized Types** (Optional Enhancement)
   - If condition type not in known list → show warning: "Condition type unknown; rule may not evaluate as expected"
   - If action type not in known list → show warning: "Action type unknown; rule may not apply as expected"
   - Allows users to verify they didn't typo the condition/action type

### For QA Testing

1. **Test Coverage**
   - ✅ Valid rules evaluate correctly
   - ✅ Unknown condition types are skipped (logged, not error)
   - ✅ Unknown action types are skipped (logged, not error)
   - ✅ Execution logs capture matched/missed conditions and applied/skipped actions
   - ✅ Test endpoint dry-runs correctly without persisting
   - ✅ Referenced user UUIDs validated at creation time (400 if not found)
   - ✅ Referenced tag UUIDs validated at creation time (400 if not found)

2. **Regression Testing**
   - Rules created in Phase 2 must still work after new condition/action types added in Phase 3+
   - Old conditions/actions not evaluated against new types (no conflicts)
   - Backward compatibility verified

---

## Standards Alignment

### TOGAF (The Open Group Architecture Framework)

**Principle: Modifiability**
- Lenient schema allows modifications (new condition/action types) without breaking existing rules
- Supports evolutionary architecture (extensions without breaking changes)
- Aligns with "design for change" principle

**Principle: Simplicity**
- Simple approach: store JSON, evaluate at runtime
- Complex logic isolated to evaluation engine
- Avoids over-engineering (no versioning, no feature flags)

### AWS Well-Architected Framework

**Operational Excellence**: 
- Rule execution logs provide observability (what matched, what was applied)
- Test endpoint enables validation before deployment
- Audit logging tracks all rule changes

**Reliability**:
- Lenient storage prevents creation failures (users can always save rules)
- Graceful degradation (unknown types skipped, not error)
- Execution logs enable post-incident debugging

### ISO 27001 Controls

**A.12.6.1 (Management of technical vulnerabilities)**
- Lenient schema reduces risk of schema injection attacks (only JSON storage, no dynamic SQL)
- Strict validation on entity references prevents orphaned assignments

**A.14.2.1 (Change management)**
- Evolution of condition/action types doesn't require schema migration or downtime
- Backward compatible (old rules work with new backend)

---

## Consequences

### Positive

✅ **Extensibility**: New condition/action types added without schema migration  
✅ **Forward Compatibility**: Old UI can create rules evaluated by new backend  
✅ **Simplicity**: Simple JSON storage, no schema versioning  
✅ **Agility**: Backend can evolve faster than UI  
✅ **Future-Proof**: System gracefully handles unknown types  

### Negative

⚠️ **Silent Failures**: Invalid rules stored successfully but never fire  
⚠️ **Harder Debugging**: Errors not caught at creation time  
⚠️ **User Confusion**: Rule may be saved but not actually working (no error message)  

### Mitigations

| Risk | Mitigation |
|------|-----------|
| Invalid rules stored but never fire | Test endpoint (dry-run) + Execution logs (post-eval inspection) |
| Errors not caught at creation time | Strict validation on entity references (users/tags exist and active) |
| User confusion about why rule doesn't work | Execution logs show matched/missed conditions; UI can warn on unknown types |
| Hard to debug why rule didn't apply | Execution log stored for every evaluation; queryable by rule_id |

---

## Approval

**Approved By**: Enterprise Architecture Validator  
**Date**: 2026-02-25  
**Authority**: EA-003 (Architecture Decision Making)

**Condition**: Use lenient JSON storage with strict validation on referenced entities (users, tags).

**Review Cycle**: Phase 2A (Week 1) completion review; reassess if issues emerge.

---

## References

- **Phase 2 Planning**: `.docs/plans/02-PHASE2-PLANNING.md` (sections 2.5, ADR-021)
- **EA Approval**: `.docs/governance/GOV-032-phase2-final-approval.md` (approval conditions)
- **Related ADRs**: ADR-005 (flat architecture), ADR-014 (frontend patterns)
- **Related Governance**: GOV-021 (RBAC matrix), GOV-030 (backend refactoring decisions)

---

**ADR ID**: ADR-021  
**Title**: Lenient JSON Schema Validation for Routing Rules  
**Status**: Approved  
**Date**: 2026-02-25  
**Version**: 1.0
