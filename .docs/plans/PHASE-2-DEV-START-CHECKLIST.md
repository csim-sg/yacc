# Phase 2 Development Start Checklist

**Target Kickoff**: February 12, 2026 (Monday, 9:00 AM)  
**Duration**: 8 days (Feb 12-19)  
**Status**: ✅ ALL BLOCKERS RESOLVED, READY TO START

---

## Pre-Kickoff Verification (Complete Before Dev Starts)

### Documentation Fixes Applied ✅
- [x] Audit log API endpoint scope updated (multi-entity queryable)
- [x] RBAC matrix added to handoff document (complete role permissions)
- [x] Audit endpoint export added to API contract
- [x] Conversation-scoped note removed from audit log docs
- [x] GOV-021 recorded (MVP scope extended to include Phase 2)

### Product Owner Confirmations (If Not Already Confirmed)
- [ ] Confirm bulk actions behavior: **partial success is OK** (return 200 + failures list)
- [ ] Confirm rule re-evaluation scope: **inbound messages only** (no re-eval on manual updates)
- [ ] Confirm raw payload access: **manager+ with audit logging** (all roles audited)

### Architect Approvals
- [x] MVP scope decision: approved (Phase 1 + Phase 2 = MVP)
- [x] RBAC matrix reviewed: approved
- [x] Audit endpoint design reviewed: approved
- [x] @mention defaults reviewed: approved
- [x] Architecture constraints verified: all OK

---

## Phase 2 Sequential Development Plan

**PRINCIPLE**: One task at a time (sequential, not parallel).  
**ORDER**: Backend → Frontend → QA integration (for each feature)  

### Week 1: Tags + Notes (Feb 12-14)

#### Day 1: Monday Feb 12
**Task**: BE-TAGS-01 + BE-TAGS-TESTS

Backend implementation: Tags CRUD
- Create: `POST /tags` (any user)
- List: `GET /tags` (any user)
- Attach: `POST /conversations/:id/tags` (any user)
- Detach: `DELETE /conversations/:id/tags/:tagId` (any user)
- Unique constraint on tags (name)
- Audit log: `tag.created`, `conversation.tag_added`, `conversation.tag_removed`

Files to create:
- `controllers/tags.controller.ts`
- `services/tags.service.ts`
- `types/tags.types.ts`
- `__tests__/tags.test.ts`

Target: 10+ tests passing, ≥85% coverage, ready for handoff

---

#### Day 2: Tuesday Feb 13
**Task**: BE-NOTES-01 + BE-MENTIONS-NOTIFICATION

Backend implementation: Notes + @mention parsing
- Create: `POST /conversations/:id/notes` (any user)
- List: `GET /conversations/:id/notes` (any user)
- Parse @mentions from note body (regex: `/@(\w+)/g`)
- Match local-part of user email (case-insensitive)
- Create notification for mentioned users (if match found)
- Audit log: `note.created`

Files to create:
- `controllers/notes.controller.ts`
- `services/notes.service.ts`
- `services/mention-parser.service.ts`
- `types/notes.types.ts`
- `__tests__/notes.test.ts`

Target: 12+ tests, ≥85% coverage, ready for handoff

---

#### Day 2-3: Tuesday-Wednesday Feb 13-14
**Task**: FE-TAGS-NOTES-UI + FE-TESTS

Frontend implementation: Conversation right panel
- Add tags selector (multi-select, create inline, show existing tags)
- Add notes panel (create note, list notes, show @mention support text)
- Integrate with TanStack Query (refetch on add/remove tag, on note creation)
- Add error handling + loading states
- Show "Note supports @mention syntax" hint

Files to create:
- `components/ConversationRightPanel.tsx` (container)
- `components/TagsPanel.tsx` (tags selector + logic)
- `components/NotesPanel.tsx` (notes list + create form)
- `hooks/useTags.ts` (TanStack Query for tags)
- `hooks/useNotes.ts` (TanStack Query for notes)
- `services/tags.service.ts` (API client)
- `services/notes.service.ts` (API client)
- `__tests__/TagsPanel.spec.ts` (Playwright E2E)
- `__tests__/NotesPanel.spec.ts` (Playwright E2E)

Target: 20+ E2E tests, real-time UI updates verified, ready for handoff

---

### Week 1-2: Assignments + Notifications Center (Feb 14-16)

#### Day 3-4: Wednesday-Thursday Feb 14-15
**Task**: BE-ASSIGN-01 + BE-NOTIFICATIONS-ENDPOINTS

Backend implementation: Assignments + Notifications CRUD
- Assign: `POST /conversations/:id/assign` (manager+ only)
- Notifications endpoints:
  - `GET /notifications` (own notifications only)
  - `PATCH /notifications/:id` (mark read)
  - `DELETE /notifications/:id` (dismiss)
  - `POST /notifications/mark-all-read`
- WebSocket emit: `notification.received` (on assignment + mention)
- Audit log: `conversation.assigned`, notification creation

Files to create:
- `controllers/assignments.controller.ts`
- `controllers/notifications.controller.ts`
- `services/assignments.service.ts`
- `services/notifications.service.ts`
- `types/assignments.types.ts`
- `types/notifications.types.ts`
- `__tests__/assignments.test.ts`
- `__tests__/notifications.test.ts`

Target: 15+ tests, ≥85% coverage, WebSocket event firing verified

---

#### Day 4-5: Thursday-Friday Feb 15-16
**Task**: FE-ASSIGN-UI + FE-NOTIFICATIONS-CENTER

Frontend implementation: Assignment dropdown + Notifications center
- Add assignment dropdown in conversation right panel
- Add notification bell icon in header with badge count
- Add notification center drawer (list notifications, mark read, dismiss, mark all read)
- Click notification → navigate to conversation
- Real-time updates via WebSocket `notification.received`

Files to create:
- `components/AssignmentDropdown.tsx`
- `components/NotificationCenter.tsx`
- `components/NotificationBell.tsx`
- `hooks/useAssignments.ts`
- `hooks/useNotifications.ts`
- `services/assignments.service.ts` (API client)
- `__tests__/AssignmentDropdown.spec.ts` (E2E)
- `__tests__/NotificationCenter.spec.ts` (E2E)

Target: 25+ E2E tests, real-time notification delivery verified

---

### Week 2: Routing Rules + Bulk Actions + Audit (Feb 17-19)

#### Day 6: Monday Feb 17
**Task**: BE-ROUTING-RULES-01

Backend implementation: Routing rules CRUD
- Create: `POST /routing-rules`
- List: `GET /routing-rules`
- Update: `PATCH /routing-rules/:id`
- Delete: `DELETE /routing-rules/:id`
- Query executions: `GET /routing-rules/:id/executions`
- Implement rules engine: evaluate on inbound message (first match wins)
- Audit log: `rule.created`, `rule.updated`, `rule.deleted`, `rule.executed`

Files to create:
- `controllers/routing-rules.controller.ts`
- `services/routing-rules.service.ts`
- `services/rules-engine.service.ts` (evaluation logic)
- `types/routing-rules.types.ts`
- `__tests__/routing-rules.test.ts`

Target: 20+ tests (including evaluation logic), ≥85% coverage

---

#### Day 7: Tuesday Feb 18
**Task**: BE-BULK-ACTIONS-01 + BE-AUDIT-QUERY

Backend implementation: Bulk actions + Audit query endpoints
- Bulk endpoint: `POST /conversations/bulk` (assign/tag/status, max 100)
- Best-effort behavior: return success count + failure reasons
- Audit query: `GET /api/audit-logs` (cross-entity queryable)
- Audit query: `GET /api/conversations/:id/audit-logs` (conversation scoped)
- Audit export: `POST /api/audit-logs/export` (CSV export, admin+ only)
- Audit log: `bulk_action_applied`

Files to create:
- `controllers/bulk-actions.controller.ts`
- `controllers/audit-logs.controller.ts`
- `services/bulk-actions.service.ts`
- `services/audit-logs.service.ts`
- `__tests__/bulk-actions.test.ts`
- `__tests__/audit-logs.test.ts`

Target: 25+ tests (partial failure scenarios), ≥85% coverage

---

#### Day 7-8: Tuesday-Wednesday Feb 18-19
**Task**: FE-RULES-ADMIN-UI + FE-AUDIT-VIEWER + FE-BULK-ACTIONS

Frontend implementation: Rules admin + Audit viewer + Bulk actions
- Rules admin page (super admin/admin only):
  - Create/list/update/delete rules UI
  - Condition builder (channel, keyword, sender, tag, time)
  - Action builder (assign, tag, priority)
  - Priority ordering (drag-to-reorder)
  - View rule execution logs
- Audit log viewer (manager+ only):
  - Filter by actor, action, entity_type, date range
  - Export to CSV
  - Search by entity ID
  - View metadata (old/new values)
- Bulk actions UX:
  - Multi-select up to 100 conversations in inbox
  - Bulk action dropdown (assign/tag/status)
  - Show result summary: "Assigned 98 of 100, 2 failed"
  - List failures with reasons

Files to create:
- `pages/RoutingRulesPage.tsx`
- `components/RuleBuilder.tsx` (condition + action builder)
- `components/RuleExecutionLog.tsx`
- `pages/AuditLogPage.tsx`
- `components/AuditLogViewer.tsx`
- `components/BulkActionModal.tsx`
- `hooks/useRoutingRules.ts`
- `hooks/useAuditLogs.ts`
- `services/routing-rules.service.ts` (API client)
- `services/audit-logs.service.ts` (API client)
- `__tests__/RoutingRulesPage.spec.ts` (E2E)
- `__tests__/AuditLogPage.spec.ts` (E2E)
- `__tests__/BulkActions.spec.ts` (E2E)

Target: 40+ E2E tests, partial failure scenarios covered

---

### Final Day: Wednesday Feb 19

#### Day 8: Final Verification
**Task**: QA-FINAL-VERIFICATION

QA finalization:
- Run all Phase 2 tests (unit + integration + E2E)
- Verify coverage ≥85% for all new code
- Run regression tests (Phase 1 tests must still pass)
- Test real-time updates (WebSocket `notification.received`, assignment, mentions)
- Test RBAC matrix (ensure each role can/cannot perform correct actions)
- Create QA sign-off report

---

## Definition of Done (for each task)

### Backend Tasks
- [ ] All tests passing (unit + integration)
- [ ] Coverage ≥85%
- [ ] No TypeScript errors
- [ ] No `any` types
- [ ] Flat folder structure maintained
- [ ] Audit logging implemented for all actions
- [ ] API endpoints documented in `.docs/02-api-and-data-model.md`
- [ ] Error handling with proper HTTP status codes + correlation IDs
- [ ] Code reviewed by architect

### Frontend Tasks
- [ ] All E2E tests passing (Playwright)
- [ ] Coverage ≥85% for new code
- [ ] No TypeScript errors
- [ ] RBAC enforced at UI level (per matrix)
- [ ] Real-time updates working (WebSocket events)
- [ ] Accessibility: `data-testid` on all interactive elements
- [ ] Error handling + user-friendly messages
- [ ] Code reviewed by architect

### QA Tasks
- [ ] All acceptance criteria covered by tests
- [ ] RBAC permutation tests passing (4 roles × 8+ actions)
- [ ] Partial failure scenarios tested (bulk actions, audit queries)
- [ ] Real-time notification delivery verified (<1s)
- [ ] Regression suite passing (Phase 1 tests)
- [ ] Test report generated

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Rules engine complex | Start simple: 1 condition + 1 action, expand incrementally |
| Audit query performance | Index audit_logs on (entity_type, created_at DESC, actor_id) |
| RBAC testing explosion | Use parameterized tests (4 roles × 8 actions = 32 test cases) |
| Notification spam | Implement dedup on (user_id, conversation_id, type) |
| Bulk action partial failures | Use database transactions per conversation, not per bulk request |
| WebSocket event race conditions | Ensure UI waits for WebSocket ACK before considering state updated |

---

## Governance & Handoff

### Progress Tracking
- Update `.docs/plans/00-INDEX.md` daily with completion status
- Create `GOV-022-phase2-implementation-log.md` to record decisions/deferrals

### PR Strategy
- Create one PR per feature (tags, notes, assignments, rules, bulk, audit)
- Keep PRs focused and small (<500 lines changed per PR)
- Reference user stories in PR description
- Link to relevant ADRs or governance entries

### Architect Approval Checkpoints
- **Day 3 (Feb 14)**: Tags + Notes PR review
- **Day 5 (Feb 15)**: Assignments + Notifications PR review
- **Day 6 (Feb 17)**: Routing Rules PR review
- **Day 7 (Feb 18)**: Bulk + Audit PR review
- **Day 8 (Feb 19)**: Final Phase 2 sign-off

---

## Success Criteria

- [ ] All 20 user stories (stories 3.x, 6.x, 7.x, 8.x, 14.x, 20.x) are testable and passing
- [ ] Test coverage ≥85% for all new Phase 2 code
- [ ] No TypeScript errors or `any` types
- [ ] RBAC matrix enforced across all endpoints + UI
- [ ] Real-time WebSocket events verified (notification, assignment, rules)
- [ ] Audit logging covers all Phase 2 actions (tags, notes, assignments, rules, bulk, access)
- [ ] Zero regressions in Phase 1 tests
- [ ] All 6 PRs merged to `dev` with architect approval
- [ ] Governance documentation updated

---

## Day-by-Day Schedule

```
MON Feb 12:  BE Tags
TUE Feb 13:  BE Notes + Mentions
WED Feb 14:  FE Tags/Notes
THU Feb 15:  BE Assignments + Notifications
FRI Feb 16:  FE Assignments + Notifications
MON Feb 17:  BE Routing Rules
TUE Feb 18:  BE Bulk Actions + Audit
WED Feb 19:  FE Rules + Audit + Bulk Actions
THU Feb 20:  QA Final Verification + Sign-Off
```

**Target Completion**: February 19, 2026 (EOD)  
**MVP Ready**: February 20, 2026 (all sign-offs complete)

---

**Document Version**: 1.0  
**Status**: Ready for Development  
**Last Updated**: 2026-02-11  
**Maintained By**: Architect
