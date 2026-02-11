# Phase 2 Handoff - Collaboration + Rules

**Owner**: Product Owner + Architect  
**Status**: ✅ APPROVED FOR EXECUTION (defaults chosen)  
**Goal**: Deliver collaboration workflows (tags/notes/assignments), routing rules, notifications, bulk actions, and audit coverage.

---

## Scope

**In scope**:
- Tags: create/list + attach/detach to conversation
- Notes: create/list per conversation; internal-only; appear in timeline
- Assignments: assign/reassign; notify assignee
- Routing rules: CRUD + evaluation (priority order, first match wins)
- Notifications: assignment + @mention (persisted, real-time)
- Bulk actions: assign/tag/status (max 100; best-effort)
- Audit logging: all above actions + query/filter + CSV export

**Out of scope**:
- New external channels (WhatsApp/WeChat/Meta/X)
- Email notifications
- Multi-tenant + vault

---

## Preconditions (must be true before Phase 2 dev starts)

- Phase 1.4 is merged and stable on `dev` (messaging + retry + WebSocket)
- BE-206 Phase 4 integration/E2E tests complete and merged (or explicitly deferred with a GOV entry)
- `.docs/02-api-and-data-model.md` endpoints and WebSocket event shapes are current

---

## Open Decisions (blockers)

1) **@mention identity mapping**
- ✅ Default (approved): `@username` maps to `users.email` local-part (before `@`).
- Behavior: if no match, note still posts, but no mention notification is created (and no error is shown to the author).

2) **Audit log scope and query model**
- ✅ Default (approved): audit logs support multiple `entity_type` values and are queryable across entity types, with conversation-centric filtering supported.
- Required doc sync: remove any "conversation-scoped only" statements from API/data docs.

---

## Phase 2 RBAC Matrix (Role Permissions)

| Action | Super Admin | Admin | Manager | User |
|--------|:---:|:---:|:---:|:---:|
| **Tags** |
| Create tag | ✅ | ✅ | ✅ | ✅ |
| List tags | ✅ | ✅ | ✅ | ✅ |
| Attach tag to conversation | ✅ | ✅ | ✅ | ✅ |
| Detach tag from conversation | ✅ | ✅ | ✅ | ✅ |
| **Notes** |
| Create note | ✅ | ✅ | ✅ | ✅ |
| List notes in conversation | ✅ | ✅ | ✅ | ✅ |
| @mention in note (triggers notification) | ✅ | ✅ | ✅ | ✅ |
| **Assignments** |
| Assign conversation | ✅ | ✅ | ✅ | ❌ |
| Reassign conversation | ✅ | ✅ | ✅ | ❌ |
| **Routing Rules** |
| Create routing rule | ✅ | ✅ | ❌ | ❌ |
| List routing rules | ✅ | ✅ | ✅ | ❌ |
| Update routing rule | ✅ | ✅ | ❌ | ❌ |
| Delete routing rule | ✅ | ✅ | ❌ | ❌ |
| Query rule executions | ✅ | ✅ | ✅ | ❌ |
| **Notifications** |
| List notifications (own only) | ✅ | ✅ | ✅ | ✅ |
| Mark notification read | ✅ | ✅ | ✅ | ✅ |
| Dismiss notification | ✅ | ✅ | ✅ | ✅ |
| Mark all notifications read | ✅ | ✅ | ✅ | ✅ |
| **Bulk Actions** |
| Bulk assign (max 100) | ✅ | ✅ | ✅ | ❌ |
| Bulk tag (max 100) | ✅ | ✅ | ✅ | ✅ |
| Bulk status change (max 100) | ✅ | ✅ | ✅ | ❌ |
| **Audit Logs** |
| Query audit logs (all) | ✅ | ✅ | ✅ | ❌ |
| Query conversation audit logs | ✅ | ✅ | ✅ | ❌ |
| Export audit logs to CSV | ✅ | ✅ | ❌ | ❌ |
| View raw payloads (if accessed) | ✅ | ✅ | ✅ | ❌ |

**Notes**:
- All audit query operations are themselves audit-logged (who queried what, when)
- Tag/note creation does NOT require approval; all users can create and use
- Bulk operations perform best-effort; partial success returns count + failure reasons
- Audit log access is role-based AND audit-logged for compliance

---

## Backend Work Packages (deliverable-oriented)

- Tags
  - Endpoints: `GET /tags`, `POST /tags`, `POST /conversations/:id/tags`, `DELETE /conversations/:id/tags/:tagId`
  - RBAC: user+ for tagging; tag creation allowed per product spec
  - Audit: `tag.created`, `conversation.tag_added`, `conversation.tag_removed`

- Notes + Mentions
  - Endpoints: `GET /conversations/:id/notes`, `POST /conversations/:id/notes`
  - Mention parse + notification create
  - Audit: `note.created`, notification creation

- Assignments
  - Endpoint: `POST /conversations/:id/assign` (and/or `PATCH /conversations/:id` if already standard)
  - Audit: `conversation.assigned`
  - Notifications: assignment notification to assignee

- Routing rules
  - Endpoints: `GET/POST/PATCH/DELETE /routing-rules`, `GET /routing-rules/:id/executions`
  - Engine: evaluate on inbound message (and optionally on conversation update where needed)
  - Audit: `rule.created`, `rule.updated`, `rule.deleted`, `rule.executed`

- Bulk actions
  - Endpoint: `POST /conversations/bulk` (assign/tag/status)
  - Constraints: max 100; best-effort response includes failures
  - Audit: `bulk_action_applied` (+ per-entity audit if required)

- Notifications
  - Endpoints: `GET /notifications`, `PATCH /notifications/:id`, `DELETE /notifications/:id`, `POST /notifications/mark-all-read`
  - WebSocket: emit `notification.received` for assignment + mention

---

## Frontend Work Packages

- Conversation right panel
  - Tags selector (multi-select + create inline)
  - Notes panel (create + list; @mention support)
  - Assignment dropdown

- Inbox bulk actions
  - Multi-select up to 100 + apply assign/tag/status
  - Show partial success summary + failures

- Notifications center
  - Unread badge count; mark read; dismiss; mark all read
  - Click navigates to conversation

- Rules admin (super admin)
  - CRUD rules, enable/disable, priority ordering
  - Execution log view (by rule ID, by conversation)

- Audit log viewer (manager+)
  - Filter by actor/action/entity/date; export CSV

---

## QA Handoff (acceptance coverage)

- RBAC: enforce role matrix for create/update across tags/notes/assign/rules/audit/notifications
- Rules: priority order + first match wins + disable/enable
- Mentions: notification created only for valid mention; no duplicates; note visible in timeline
- Bulk: best-effort behavior + max 100 validation + failure reasons
- Audit: every action creates log entry with required metadata; filters and export work
- Real-time: assignment and mention notifications arrive via WebSocket and persist across reconnect

---

## Definition of Done

- Endpoints implemented + documented in `.docs/02-api-and-data-model.md`
- WebSocket events implemented + documented (if added/changed)
- Unit/integration/E2E tests added; overall coverage target met for new code
- `.docs/plans/00-INDEX.md` updated with accurate statuses
- Governance entry created if any planned scope is deferred
