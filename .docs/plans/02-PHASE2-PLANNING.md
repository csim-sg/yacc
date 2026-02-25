# Phase 2 Planning - Collaboration + Rules + Audit

**Status**: Design Complete (Blocked on ADR + EA Final Approval)  
**Estimated Duration**: 3-4 weeks  
**Start Date**: 2026-03-05 (pending approval)  
**Target Completion**: 2026-03-26 (MVP ready)

---

## Table of Contents

1. [Overview](#overview)
2. [Architectural Decisions](#architectural-decisions)
3. [API Design (Complete)](#api-design-complete)
4. [Data Model](#data-model)
5. [Blocking Issues & Resolutions](#blocking-issues--resolutions)
6. [Implementation Tasks](#implementation-tasks)
7. [Acceptance Criteria](#acceptance-criteria)

---

## Overview

Phase 2 extends Phase 1 MVP (auth, inbox, messaging) with **collaboration features** (tags, notes, assignments), **rule-based routing**, **audit logging**, and **bulk actions**.

### What Phase 2 Delivers

- ✅ Tags: User-created, reusable, soft-delete only
- ✅ Notes: Internal-only with @mention notifications
- ✅ Assignments: One per conversation, with dual notifications on change
- ✅ Routing Rules: Auto-assign, auto-tag, auto-prioritize (evaluated once at message arrival)
- ✅ Bulk Actions: Assign/tag multiple conversations (max 100, best-effort)
- ✅ Audit Logging: All collaboration actions logged with actor/timestamp/metadata
- ✅ Conversation Status: Open/Pending/Resolved with auto-reopen on new message

### Why Phase 2 Matters

Teams need to **collaborate** (tags, notes, assignments) and **automate** (routing rules) to handle message volume at scale. Phase 1 alone is insufficient for production multi-user workflows.

---

## Architectural Decisions

### 1. Rules Evaluation: Once at Message Arrival

**Decision**: Rules evaluated **once** when inbound message arrives (no re-evaluation, no cascading).

**Rationale**: Simple, predictable, no state management complexity.

**Implication**: Manual overrides don't trigger re-evaluation; rule automation is unidirectional (initial message → apply rules → stop).

---

### 2. @Mention Parsing: Strict Email Match

**Decision**: `@{email_prefix}` matches only to existing user emails (exact or prefix). No fuzzy matching.

**Examples**:
- `@alice` → matches `alice@company.com` ✅
- `@alice@company.com` → matches `alice@company.com` ✅
- `@alice_johnson` → no match ❌

**Frontend Display**: `display_name > username > email` (fallback chain).

---

### 3. Note Visibility: All Team Members See All Notes

**Decision**: All roles (User, Manager, Admin, Super Admin) can **read all notes** in a conversation, regardless of assignment.

**Rationale**: Open collaboration. Teams need visibility into guidance and discussion.

**Implication**: Notes are not private; use audit logs for sensitive discussions, not notes.

---

### 4. Assignment with Deactivated User

**Decision**: Keep assignment in database, but **hide in list view** (show as unassigned) and **show deactivated status in detail view**.

**Behavior**:
- User deactivated → assignment preserved (FK still valid)
- List view: Shows conversation as "Unassigned"
- Detail view: Shows "Assigned to: Alice Johnson (deactivated)" with warning icon
- Functionality: Conversation not visible to deactivated user (read-only, can't action)

**Rationale**: Audit trail preservation + visibility of historical assignments.

---

### 5. Tag Soft Delete + Archive Immutability

**Decision**: Tags use **soft delete only** (never hard-deleted if in-use). Archived conversations have **immutable tags** (can't change).

**Behavior**:
- DELETE /api/tags/:tagId → soft-delete (set `deleted_at`) if not in-use
- If in-use → 409 conflict with "merge tags first or archive conversations"
- Archived conversation → can't add/remove/change tags (409 conflict)

**Rationale**: Audit trail preservation + historical accuracy of archived data.

---

### 6. Routing Rules Validation: Lenient Schema

**Decision**: **Strict validation on create** (user/tag references must exist), but **lenient JSON schema storage** (conditions/actions stored as-is, no format validation).

**Implications**:
- Bad condition syntax → stored successfully → fails silently at eval time
- Benefit: Extensible (new condition types don't require schema changes)
- Risk: Debugging harder (invalid rules "work" until evaluated)
- Mitigation: Rule execution logs show matched_conditions and applied_actions (post-eval inspection)

---

### 7. Routing Rules Ordering: Explicit with Auto-Shift

**Decision**: Rules have **explicit `order` field** (0, 1, 2, ...). Evaluated in ascending order. **Auto-shift on insert** (if order 10 taken, shift 10+ up by 1).

**Frontend**: Auto-generates order from visual position (drag-to-reorder UI).

---

### 8. Response Format: HTTP Status Only

**Decision**: Single-item responses use **HTTP status codes only** (201/200/204/404). Multi-item responses extend **BaseListResponse<T>**.

**Internal Fields Never Exposed**: `deleted_at`, `archived_at`, `password_hash`, etc. are database-only.

---

## API Design (Complete)

### 2.1 Tags API

#### POST /api/tags - Create Tag
- **Auto-generates slug `key`** from `name` (e.g., "Urgent Priority" → "urgent-priority")
- **Request**: `{ name, color? }`
- **Response (201)**: Tag DTO
- **RBAC**: All roles

#### GET /api/tags - List Tags
- **Pagination**: BaseListRequest (limit, page, searchText)
- **Sorting**: By name, created_at
- **Response**: BaseListResponse<Tag>
- **RBAC**: All roles

#### PATCH /api/tags/:tagId - Update Tag
- **Updates**: name (regenerates key), color
- **Key immutable once created**
- **RBAC**: Tag creator only

#### DELETE /api/tags/:tagId - Soft Delete
- **Behavior**: Soft-delete if not in-use
- **409 conflict**: "Tag is used by X conversations"
- **RBAC**: Tag creator only

#### POST /api/tags/:sourceTagId/merge/:targetTagId - Merge Tags
- **Behavior**: Move all source tag references to target, soft-delete source
- **Response**: `{ merged_count, source_tag, target_tag }`
- **RBAC**: Admin+

---

### 2.2 Tags on Conversations API

#### POST /api/conversations/:conversationId/tags - Add Tag
- **Request**: `{ tag_id }` OR `{ name, color }` (inline create)
- **Creates tag if not exists** (inline creation)
- **Response (201 or 200)**: Tag DTO
- **RBAC**: All roles

#### GET /api/conversations/:conversationId/tags - List Tags
- **BaseListResponse<Tag>** with added_by, added_at
- **RBAC**: All roles

#### DELETE /api/conversations/:conversationId/tags/:tagId - Remove Tag
- **Response (204)**
- **RBAC**: All roles

---

### 2.3 Notes API

#### POST /api/conversations/:conversationId/notes - Create Note
- **Parses @mentions** (strict email match)
- **Creates notifications** for mentioned users (type='mention')
- **Audit logs**: `note.created` with mentioned_users
- **Request**: `{ body }`
- **Response (201)**: Note DTO + mentions array + unmatched_mentions
- **RBAC**: Admin+

#### GET /api/conversations/:conversationId/notes - List Notes
- **BaseListResponse<Note>** with author, mentions, created_at, updated_at
- **RBAC**: All roles (notes visible to all)

#### PATCH /api/conversations/:conversationId/notes/:noteId - Update Note
- **Re-parses @mentions**
- **Creates notifications** for new mentions
- **Audit logs**: `note.updated` with old/new mentions
- **RBAC**: Author OR Manager+

#### DELETE /api/conversations/:conversationId/notes/:noteId - Delete Note
- **Audit logs**: `note.deleted`
- **RBAC**: Author OR Manager+

---

### 2.4 Assignments API

#### POST /api/conversations/:conversationId/assignments - Assign
- **Replaces existing** assignment (if any)
- **Creates notifications**: 
  - New assignee: type='assignment'
  - Old assignee (if reassign): type='assignment_removed'
- **Audit logs**: `assignment.created` or `assignment.changed`
- **Response (201 new, 200 reassign)**
- **RBAC**: Manager+

#### GET /api/conversations/:conversationId/assignments - Get Assignment
- **Returns current** assignment or null
- **Shows deactivated status** if user inactive
- **RBAC**: All roles

#### DELETE /api/conversations/:conversationId/assignments - Unassign
- **Creates notification** for old assignee: type='assignment_removed'
- **Audit logs**: `assignment.removed`
- **Response (204)**
- **RBAC**: Manager+

---

### 2.5 Routing Rules API

#### POST /api/routing-rules - Create Rule
- **Auto-generates `order`** (append to highest + 1)
- **Auto-shifts** conflicting orders up
- **Strict validation**: Active users, existing tags
- **Lenient storage**: Conditions/actions stored as-is
- **Audit logs**: `routing_rule.created`
- **Response (201)**
- **RBAC**: Super Admin

#### GET /api/routing-rules - List Rules
- **Ordered by `order` field**
- **Shows**: id, name, status, order, conditions, actions, last_evaluated_at, evaluation_count
- **BaseListResponse<Rule>**
- **RBAC**: Super Admin

#### POST /api/routing-rules/reorder - Drag-to-Reorder
- **Request**: `{ rules: [{ id, order }] }`
- **Atomically updates** all orders
- **Response**: Updated rules in new order
- **Audit logs**: `routing_rules.reordered` with old/new order
- **RBAC**: Super Admin

#### PATCH /api/routing-rules/:ruleId - Update Rule
- **Updates**: name, description, status, conditions, actions
- **Re-validates** active users, existing tags
- **Cannot change order** (use reorder endpoint)
- **Audit logs**: `routing_rule.updated` with changes
- **Response (200)**
- **RBAC**: Super Admin

#### DELETE /api/routing-rules/:ruleId - Delete Rule
- **Soft deletes** (soft delete, never hard delete)
- **Audit logs**: `routing_rule.deleted`
- **Response (204)**
- **RBAC**: Super Admin

#### POST /api/routing-rules/:ruleId/test - Test Rule
- **Request**: `{ conditions?, message_sample? }`
- **Evaluates rule** against sample message
- **Shows matched_conditions** and applied_actions (dry-run)
- **Response**: `{ matched: boolean, matched_conditions, applied_actions }`
- **RBAC**: Super Admin

#### GET /api/routing-rules/:ruleId/executions - List Execution Logs
- **BaseListResponse<Execution>** with matched_conditions, applied_actions, executed_at
- **Queryable** by date range
- **Shows success/failure** of each evaluation
- **RBAC**: Super Admin

---

### 2.6 Bulk Actions API

#### POST /api/conversations/bulk/assign - Bulk Assign
- **Request**: `{ conversation_ids: [uuid], assigned_user_id: uuid }`
- **Max 100 conversations** per request
- **Best-effort**: Some may fail (no atomic all-or-nothing)
- **Response (200)**: `{ success_count, failed_count, failures: [{id, reason}] }`
- **Audit logs**: Each success logged as `assignment.created`
- **RBAC**: Manager+

#### POST /api/conversations/bulk/tag - Bulk Tag
- **Request**: `{ conversation_ids: [uuid], tag_id: uuid }`
- **Or inline create**: `{ conversation_ids, name, color }`
- **Max 100 conversations**
- **Best-effort**
- **Response (200)**: `{ success_count, failed_count, failures }`
- **Audit logs**: Each success logged as `tag.added_to_conversation`
- **RBAC**: All roles

#### POST /api/conversations/bulk/status - Bulk Status Change
- **Request**: `{ conversation_ids, status: 'open' | 'pending' | 'resolved' }`
- **Max 100 conversations**
- **Best-effort**
- **Response (200)**: `{ success_count, failed_count, failures }`
- **Audit logs**: Each success logged as `conversation.status_changed`
- **RBAC**: Manager+

---

### 2.7 Audit Logs API

#### GET /api/audit-logs - Query Audit Logs
- **Filters**:
  - actor_id: UUID
  - action: string (e.g., 'note.created', 'tag.merged')
  - entity_type: string (e.g., 'note', 'tag', 'conversation')
  - entity_id: UUID
  - date_from, date_to: ISO 8601
- **BaseListResponse<AuditLog>** with actor, action, entity, metadata, created_at
- **Response includes**: `{ id, actor_id, actor_email, action, entity_type, entity_id, metadata, created_at }`
- **RBAC**: Manager+ (read-only)

#### POST /api/audit-logs/export - Export CSV
- **Request**: Filters (same as GET)
- **Response**: CSV file download
- **Format**: actor_email | action | entity_type | entity_id | metadata (JSON) | created_at
- **Max 50K rows** per export (paginated if needed)
- **RBAC**: Manager+

---

### 2.8 Conversation Status Lifecycle API

#### PATCH /api/conversations/:conversationId/status - Change Status
- **Request**: `{ status: 'open' | 'pending' | 'resolved' }`
- **Applies to**: DM/Group only (broadcast ignores)
- **Auto-reopen**: If resolved conversation receives inbound message → status='open'
- **Audit logs**: `conversation.status_changed` with old_status, new_status
- **Response (200)**: Updated conversation DTO
- **RBAC**: Manager+

#### Auto-Reopen Logic (Automatic)
- **Trigger**: Inbound message on resolved conversation
- **Action**: Set status='open', create system event in timeline
- **Audit logs**: `conversation.auto_reopened` with reason
- **WebSocket**: Emit `conversation.updated` to connected clients

---

## Data Model

### New Tables

```sql
-- Tags
CREATE TABLE tags (
  id UUID PRIMARY KEY,
  key VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(7) DEFAULT '#3B82F6',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

CREATE TABLE conversation_tags (
  conversation_id UUID REFERENCES conversations(id),
  tag_id UUID REFERENCES tags(id),
  added_by UUID REFERENCES users(id),
  added_at TIMESTAMP DEFAULT NOW(),
  archived_at TIMESTAMP NULL,
  PRIMARY KEY (conversation_id, tag_id)
);

-- Notes
CREATE TABLE notes (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  author_id UUID NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE note_mentions (
  id UUID PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES notes(id),
  mentioned_user_id UUID NOT NULL REFERENCES users(id),
  mention_text VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(note_id, mentioned_user_id)
);

-- Assignments
CREATE TABLE conversation_assignments (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  assigned_user_id UUID NOT NULL REFERENCES users(id),
  assigned_by UUID NOT NULL REFERENCES users(id),
  assigned_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(conversation_id)
);

-- Routing Rules
CREATE TABLE routing_rules (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  status VARCHAR(20) DEFAULT 'active',
  order INT NOT NULL UNIQUE,
  conditions JSONB NOT NULL,
  actions JSONB NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_evaluated_at TIMESTAMP,
  evaluation_count INT DEFAULT 0
);

CREATE TABLE routing_rule_executions (
  id UUID PRIMARY KEY,
  rule_id UUID NOT NULL REFERENCES routing_rules(id),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  matched BOOLEAN NOT NULL,
  matched_conditions JSONB,
  applied_actions JSONB,
  executed_at TIMESTAMP DEFAULT NOW()
);

-- Audit Logs (already exists in Phase 1, extended in Phase 2)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  actor_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_notes_conversation_id ON notes(conversation_id);
CREATE INDEX idx_note_mentions_mentioned_user_id ON note_mentions(mentioned_user_id);
CREATE INDEX idx_conversation_tags_tag_id ON conversation_tags(tag_id);
CREATE INDEX idx_routing_rules_order ON routing_rules(order);
CREATE INDEX idx_routing_rule_executions_rule_id ON routing_rule_executions(rule_id);
CREATE INDEX idx_routing_rule_executions_conversation_id ON routing_rule_executions(conversation_id);
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

---

## Blocking Issues & Resolutions

### Issue 1: Notes API Missing Audit Logging ✅ RESOLVED

**Problem**: Note CRUD operations not logged.  
**Solution**: Add audit logging for `note.created`, `note.updated`, `note.deleted`.  
**Implementation**: Log with actor_id, note_id, conversation_id, mentioned_users.

---

### Issue 2: Notes API Missing @Mention Notifications ✅ RESOLVED

**Problem**: Design said "@mention parsing" but didn't trigger notifications.  
**Solution**: After note creation, create notifications for all matched @mentions.  
**Implementation**: 
1. Parse body for @mentions
2. Create notification row for each matched user (type='mention')
3. Emit WebSocket event: `notification.created`

---

### Issue 3: Routing Rules Missing ADR + Execution Logging ✅ RESOLVED

**Problem**: Lenient JSON storage is architectural decision but undocumented.  
**Solution**: Create ADR + add execution logging spec.  
**Implementation**: 
1. Create ADR-021: Routing Rules Validation Strategy (see section below)
2. Add rule execution logging to routing_rule_executions table on every evaluation
3. Document in API: GET /api/routing-rules/:ruleId/executions lists evaluation logs

---

## ADR-021: Routing Rules Validation Strategy

**Title**: Lenient JSON Schema Validation for Routing Rules  
**Status**: Approved (pending EA final review)  
**Date**: 2026-02-25

### Context

Routing rules are user-defined automation configurations with:
- Conditions: Flexible matching logic (channel, keyword, sender, tag, time)
- Actions: Flexible target operations (assign, tag, set_priority)

Two validation strategies possible:

**Option A: Strict Schema**
- Validate condition/action structure at creation time
- Reject invalid schemas immediately
- Benefits: Early error detection, simpler debugging
- Drawbacks: Harder to extend with new condition/action types (requires schema updates)

**Option B: Lenient Storage** (CHOSEN)
- Accept any JSON structure at creation time
- Validate at evaluation time (rules are evaluated when messages arrive)
- Benefits: Extensible (new types added without schema changes), forward-compatible
- Drawbacks: Invalid rules "work" until evaluated (silent failure), harder to debug

### Decision

**Use Lenient Storage (Option B)** with strict validation on **referenced entities** (users, tags).

### Rationale

1. **Extensibility**: New condition/action types can be added by backend without blocking rule creation
2. **Forward Compatibility**: Old UI can create rules that new backend understands (vs vice versa)
3. **User Experience**: Users don't hit "unsupported field" errors for future features
4. **Risk Mitigation**: Mitigated via:
   - Rule execution logs (show matched_conditions, applied_actions post-eval)
   - POST /api/routing-rules/:ruleId/test endpoint (dry-run before saving)
   - Audit logging (trace all rule changes)

### Implications

1. **Invalid syntax in conditions/actions** → Silently ignored at eval time
2. **Rule execution logs** show exactly what matched/applied (debugging aid)
3. **Future extensions** don't require migration
4. **Risk**: Teams may deploy invalid rules and not realize until seeing execution logs

### Mitigation

1. Test endpoint (POST /api/routing-rules/:ruleId/test) allows dry-run
2. Execution logs are queried (GET /api/routing-rules/:ruleId/executions)
3. Audit logging tracks all rule changes (actor, timestamp)
4. UI should show warnings if condition/action not recognized (optional frontend enhancement)

### Approved By

Enterprise Architecture Validator  
Date: 2026-02-25

---

## Implementation Tasks

### Phase 2A: Foundation (Week 1)

- [ ] Create database schema (all new tables)
- [ ] Create common DTOs (Tag, Note, Assignment, RoutingRule, AuditLog)
- [ ] Create validation schemas (Zod)
- [ ] Implement notification engine extension (assignment, mention)
- [ ] Create audit logging middleware

### Phase 2B: Tags (Week 1)

- [ ] POST /api/tags
- [ ] GET /api/tags
- [ ] PATCH /api/tags/:tagId
- [ ] DELETE /api/tags/:tagId (soft delete)
- [ ] POST /api/tags/:sourceTagId/merge/:targetTagId
- [ ] POST /api/conversations/:conversationId/tags (with inline create)
- [ ] GET /api/conversations/:conversationId/tags
- [ ] DELETE /api/conversations/:conversationId/tags/:tagId

### Phase 2C: Notes & Assignments (Week 1-2)

- [ ] POST /api/conversations/:conversationId/notes
- [ ] GET /api/conversations/:conversationId/notes
- [ ] PATCH /api/conversations/:conversationId/notes/:noteId
- [ ] DELETE /api/conversations/:conversationId/notes/:noteId
- [ ] POST /api/conversations/:conversationId/assignments
- [ ] GET /api/conversations/:conversationId/assignments
- [ ] DELETE /api/conversations/:conversationId/assignments

### Phase 2D: Routing Rules (Week 2-3)

- [ ] POST /api/routing-rules (with auto-shift)
- [ ] GET /api/routing-rules
- [ ] POST /api/routing-rules/reorder
- [ ] PATCH /api/routing-rules/:ruleId
- [ ] DELETE /api/routing-rules/:ruleId
- [ ] POST /api/routing-rules/:ruleId/test
- [ ] GET /api/routing-rules/:ruleId/executions
- [ ] Implement rules evaluation engine (at message arrival)
- [ ] Implement rule execution logging

### Phase 2E: Bulk Actions & Status (Week 3)

- [ ] POST /api/conversations/bulk/assign
- [ ] POST /api/conversations/bulk/tag
- [ ] POST /api/conversations/bulk/status
- [ ] PATCH /api/conversations/:conversationId/status
- [ ] Implement auto-reopen logic

### Phase 2F: Audit & Polish (Week 3-4)

- [ ] GET /api/audit-logs (with filters)
- [ ] POST /api/audit-logs/export
- [ ] WebSocket events for all Phase 2 operations
- [ ] E2E tests (Playwright) for all workflows
- [ ] Performance testing (bulk operations, rule evaluation)
- [ ] Documentation (API docs, ADRs, runbooks)

---

## Acceptance Criteria

### Tags Feature (Story 3.2, 17.1)

**AC 1**: Tag creation auto-generates slug key from name
- Given: User creates tag with name "Urgent Priority"
- When: POST /api/tags
- Then: Response includes key="urgent-priority"

**AC 2**: Tags can be merged
- Given: Two tags "Urgent" and "Critical"
- When: POST /api/tags/urgent/merge/critical
- Then: All conversations with "Urgent" now have "Critical", "Urgent" soft-deleted

**AC 3**: Soft delete prevents hard deletion if in-use
- Given: Tag used by 5 conversations
- When: DELETE /api/tags/:tagId
- Then: 409 conflict with message "Tag is used by 5 conversations"

**AC 4**: Archived conversations have immutable tags
- Given: Archived conversation with tags
- When: Try to add/remove tag
- Then: 409 conflict "Cannot modify tags on archived conversation"

---

### Notes Feature (Story 3.1)

**AC 1**: @mentions are parsed strictly
- Given: Note body "Hey @alice, thanks @bob_smith"
- When: POST /api/conversations/:conversationId/notes
- Then: mentions=[alice], unmatched_mentions=['bob_smith']

**AC 2**: @mention notifications created
- Given: Note created with @alice mention
- When: Backend processes
- Then: Notification created for alice (type='mention')

**AC 3**: All team members see all notes
- Given: User assigned different conversation
- When: GET /api/conversations/:conversationId/notes
- Then: User sees all notes (permission granted)

**AC 4**: Edit/Delete hierarchical permissions
- Given: User is note author
- When: PATCH /api/conversations/:conversationId/notes/:noteId
- Then: Author can edit (200 OK)

- Given: User is Manager
- When: PATCH on other user's note
- Then: Manager can edit (200 OK)

- Given: User is regular User (not author, not manager)
- When: PATCH on other user's note
- Then: 403 forbidden

---

### Assignments Feature (Story 3.3, 14.1)

**AC 1**: One assignment per conversation
- Given: Conversation assigned to alice
- When: POST /api/conversations/:conversationId/assignments with bob
- Then: Old assignment replaced, alice unassigned

**AC 2**: Dual notifications on reassign
- Given: Conversation assigned alice → bob
- When: POST with bob_id
- Then: 
  - Notification created for bob (type='assignment')
  - Notification created for alice (type='assignment_removed')

**AC 3**: Deactivated user display
- Given: Assigned user deactivated
- When: GET /api/conversations (list)
- Then: Conversation shown as "Unassigned"

- When: GET /api/conversations/:conversationId (detail)
- Then: Shows "Assigned to: Alice Johnson (deactivated)"

---

### Routing Rules Feature (Story 7.1, 7.2)

**AC 1**: Rules evaluated once at message arrival
- Given: Rule matches inbound message
- When: Message processed
- Then: Rule actions applied, execution logged

**AC 2**: First matching rule wins
- Given: Two rules (order 0, order 1) both match
- When: Message evaluated
- Then: Only rule 0 actions applied

**AC 3**: Auto-shift on order conflict
- Given: Rules at order [0, 1, 10, 11]
- When: Create rule with order 10
- Then: Existing rules shift to [11, 12], new rule at 10

**AC 4**: Rule test endpoint (dry-run)
- Given: Rule with conditions
- When: POST /api/routing-rules/:ruleId/test with sample message
- Then: Response shows matched_conditions and applied_actions (without persisting)

**AC 5**: Rule execution logs queryable
- Given: Rules evaluated on 1000 messages
- When: GET /api/routing-rules/:ruleId/executions
- Then: Returns list of all evaluations with matched/applied data

---

### Bulk Actions Feature (Story 8.1, 8.2, 19.1, 19.2)

**AC 1**: Bulk assign up to 100 conversations
- Given: 50 conversations selected
- When: POST /api/conversations/bulk/assign
- Then: All 50 assigned, success_count=50, failures=[]

**AC 2**: Best-effort (partial success allowed)
- Given: 50 conversations, 2 not found
- When: POST /api/conversations/bulk/assign
- Then: success_count=48, failed_count=2, failures=[{id, reason}]

**AC 3**: Max 100 per request
- Given: 101 conversations
- When: POST /api/conversations/bulk/assign
- Then: 400 validation_error "Max 100 conversations"

---

### Audit Logging Feature (Story 6.2, 20.1, 20.2)

**AC 1**: All collaboration actions logged
- Given: Tag added to conversation
- When: POST /api/conversations/:conversationId/tags
- Then: Audit log created: action='tag.added', actor_id, entity_id, created_at

**AC 2**: Queryable by filters
- Given: Audit logs exist
- When: GET /api/audit-logs?actor_id=alice&action=note.created
- Then: Returns notes created by alice

**AC 3**: CSV export
- Given: Audit logs exist
- When: POST /api/audit-logs/export
- Then: CSV file downloaded with columns: actor_email, action, entity_type, entity_id, metadata, created_at

---

### Conversation Status Feature (Story 18.1)

**AC 1**: Status lifecycle (open → pending → resolved)
- Given: Conversation in "open" state
- When: PATCH /api/conversations/:conversationId/status with status='pending'
- Then: Conversation.status='pending', audit logged

**AC 2**: Auto-reopen on new inbound message
- Given: Conversation in "resolved" state
- When: New inbound message arrives
- Then: Conversation.status='open', system event created in timeline, audit logged

**AC 3**: Broadcast ignores status
- Given: Broadcast conversation (read-only channel)
- When: PATCH /api/conversations/:conversationId/status
- Then: 400 validation_error "Status changes not supported for broadcast"

---

## Next Steps

1. **EA Final Review**: Submit ADR-021 + updated API design for final approval
2. **Task Breakdown**: Create 50+ implementation tasks in GitHub (one per endpoint)
3. **Resource Allocation**: Assign frontend + backend developers
4. **Testing Strategy**: Create 100+ acceptance test cases (Playwright E2E)
5. **Kickoff**: Phase 2 begins 2026-03-05 (pending approval)

---

**Document Version**: 1.0  
**Last Updated**: 2026-02-25  
**Status**: Ready for EA Final Review  
**Blocked On**: ADR-021 Approval, EA Final Validation
