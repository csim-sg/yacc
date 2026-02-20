# INT-011..INT-014 Implementation Summary

**Status**: ✅ **READY TO CODE**  
**Date**: 2026-02-20  
**Scope**: IRC conversation uniqueness + frontend sidebar UX  
**Estimated Duration**: 60-75 hours  
**PR Strategy**: Single branch, 8-9 commits, one PR to `dev`

---

## 🔄 REQUIREMENT MAPPING

### New Requirement #1: IRC Conversation Uniqueness

**Requirement**:
```
Conversation uniqueness is per (ircProfile + channel) and per (ircProfile + user) for DMs
```

**Translation**:
- Same channel name `#general` in Profile A ≠ same channel name in Profile B
- Each IRC profile creates its own conversation namespace
- Future DM support: also scoped to `(ircProfile, externalUserId)`

**Impact**:
- Add `ircProfileId` to conversations schema
- Add UNIQUE constraints: `(ircProfileId, externalThreadId)` and `(ircProfileId, externalUserId)`
- Update all conversation queries to filter by `ircProfileId`

---

### New Requirement #2: Frontend Sidebar UX

**Requirement**:
```
Each IRC profile is a main tab/accordion that expands to show:
- Joined channels (from that profile)
- Ongoing DMs (from that profile)
```

**Translation**:
- Sidebar no longer flat list; becomes profile-grouped
- IRC profiles appear as collapsible sections
- Each section contains channels + DMs for that profile
- Telegram can be a default profile or separate section

**Impact**:
- Refactor Sidebar component to accordion layout
- Add hooks for profile state management (useSidebarState, useProfileConversations)
- Add E2E tests for profile expansion/navigation
- Mobile support: collapse to icons, expand on tap

---

## 📊 CONCRETE FILE CHANGES

### Backend (INT-011..INT-014)

```
packages/common/src/db/schema.ts
  + ircProfileId: uuid (optional, NULL for Telegram)
  + unique index (ircProfileId, externalThreadId)
  + unique index (ircProfileId, externalUserId) [reserved for DM]
  + migration file

packages/backend/src/services/irc-ingestion.service.ts
  - InboundIRCMessageDTO: add ircProfileId
  - upsertConversation(): accept ircProfileId parameter
  - Query filters: add ircProfileId to WHERE clause

packages/backend/src/services/conversation.service.ts
  - list(): add optional ircProfileId filter
  - detail(): add optional ircProfileId filter

packages/backend/src/connectors/irc.connector.ts
  - Retrieve ircProfileId from config
  - Pass ircProfileId to ircIngestionService.ingestMessage()

packages/backend/src/connectors/__tests__/irc.connector.test.ts
  - Expand from 28 to 45+ tests
  - Cover 90%+ of connector code
  - Test profile ID passing

packages/backend/src/services/__tests__/irc-ingestion.service.test.ts
  - NEW file: 18+ tests
  - Profile-aware upsert validation
  - Unique constraint enforcement
  - Self-echo, channel detection

packages/backend/src/__tests__/irc-integration.test.ts
  - NEW file: 15+ E2E tests
  - Mock IRC server scenarios
  - Multi-profile channel mapping
  - Error → DLQ flow
```

### Frontend (FE-Sidebar)

```
packages/frontend/src/types/sidebar.types.ts
  - NEW: ProfileSection, ConversationItem types

packages/frontend/src/hooks/useSidebarState.ts
  - NEW: localStorage state management for accordion

packages/frontend/src/hooks/useProfileConversations.ts
  - NEW: Profile-grouped conversation fetching + grouping

packages/frontend/src/components/Sidebar.tsx
  - Refactor from flat list to profile-grouped accordion
  - Profile sections expand/collapse
  - Unread badges per profile + conversation
  - Mobile: collapse to icons

packages/frontend/e2e/sidebar.spec.ts
  - NEW: 8+ Playwright tests
  - Expand profile, click channel, navigate
  - Unread badge updates
  - Mobile responsive behavior
```

---

## 🎯 TASK BREAKDOWN (SEQUENTIAL)

### Phase 1: Backend Schema + Mapping (INT-011) — 10 hrs
1. Add `ircProfileId` to schema + unique indexes
2. Update ingestion service for profile-aware upsert
3. Update conversation service for profile filtering
4. Update IRC connector to pass profile ID
5. **Verify**: Schema compiles, migration works

### Phase 2: Error Handling Audit (INT-012) — 8 hrs
1. Audit error logging in IRC connector
2. Verify DLQ integration picks up failures
3. Verify correlation ID propagation
4. Defer rate limiting to Phase 2
5. **Verify**: Error scenarios covered in tests

### Phase 3: Backend Unit Tests (INT-013) — 14 hrs
1. Expand IRC connector tests to 90%+ coverage
2. Add ingestion service tests for profile-aware upsert
3. Add conversation service tests for filtering
4. Run coverage report
5. **Verify**: Coverage ≥ 90% connector, ≥ 85% overall

### Phase 4: Backend Integration Tests (INT-014) — 18 hrs
1. Design mock IRC server (EventEmitter pattern)
2. Implement E2E test scenarios (connect → ingest → DLQ)
3. Test multi-profile channel mapping
4. Verify DB consistency
5. **Verify**: All E2E flows pass, no regressions

### Phase 5: Frontend Types & Hooks (FE-Sidebar) — 4 hrs
1. Create sidebar types file
2. Implement useSidebarState hook
3. Implement useProfileConversations hook
4. **Verify**: Hooks export correctly, types validate

### Phase 6: Frontend Sidebar Component (FE-Sidebar) — 8 hrs
1. Refactor Sidebar to profile-grouped layout
2. Integrate hooks for state + data
3. Add mobile support (collapse to icons)
4. Add real-time WebSocket updates for badges
5. **Verify**: Component renders, all interactions work

### Phase 7: Frontend E2E Tests (FE-Sidebar) — 6 hrs
1. Write Playwright tests for sidebar expansion
2. Test channel/DM navigation
3. Test mobile responsive behavior
4. Test unread badge updates
5. **Verify**: All E2E tests pass

### Phase 8: Documentation + Final Verification (2 hrs)
1. Update `.docs/plans/00-INDEX.md`
2. Update `.docs/02-api-and-data-model.md`
3. Run full test suite
4. Prepare PR description
5. **Verify**: All commands pass

---

## ✅ VERIFICATION COMMANDS (Pre-Merge)

### Backend
```bash
pnpm --filter @yacc/backend test                  # All tests pass (240+)
pnpm --filter @yacc/backend test:coverage         # 90%+ connector, 85%+ overall
pnpm --filter @yacc/backend lint                  # No errors, no warnings
pnpm --filter @yacc/backend build                 # TypeScript compiles
```

### Frontend
```bash
pnpm --filter @yacc/frontend test                 # All tests pass (95+)
pnpm --filter @yacc/frontend lint                 # No errors, no warnings
pnpm --filter @yacc/frontend build                # TypeScript compiles
```

### Full Workspace
```bash
pnpm install                                      # All deps installed
pnpm build                                        # All packages build
pnpm test                                         # All tests pass
```

---

## 📝 GIT WORKFLOW

### One Branch Strategy
```bash
git checkout -b task/INT-011-014-irc-completion-with-sidebar

# 9 commits:
# 1. INT-011: Schema + migration
# 2. INT-011: Backend ingestion + services
# 3. INT-012: Error handling verification
# 4. INT-013: Unit tests (backend)
# 5. INT-014: Integration tests (backend)
# 6. FE-Sidebar: Types + hooks
# 7. FE-Sidebar: Component refactor
# 8. FE-Sidebar: E2E tests
# 9. docs: Update status + API docs

git push origin task/INT-011-014-irc-completion-with-sidebar
# Create PR: target=dev, squash-merge on approval
```

---

## 📋 DELIVERABLES CHECKLIST

### Code
- [ ] Schema: `ircProfileId` added + unique indexes
- [ ] Ingestion: Profile-aware conversation upsert
- [ ] Services: Profile filtering in queries
- [ ] Connector: Pass `ircProfileId` to ingestion
- [ ] Unit tests: 90%+ connector, 85%+ overall
- [ ] Integration tests: E2E scenarios with mock IRC
- [ ] Sidebar: Profile-grouped accordion layout
- [ ] Sidebar hooks: State management + data fetching
- [ ] E2E tests: Sidebar UX flows (Playwright)
- [ ] Zero `any` types, flat structure, one-def-per-file

### Testing
- [ ] All backend tests pass (240+)
- [ ] All frontend tests pass (95+)
- [ ] Coverage reports meet targets
- [ ] No regressions in INT-001-010 tests

### Documentation
- [ ] `.docs/plans/00-INDEX.md`: INT-011-014 COMPLETED
- [ ] `.docs/02-api-and-data-model.md`: Schema updated
- [ ] `.docs/03-implementation-guide.md`: Architecture documented
- [ ] PREP file: Summary of changes

### PR
- [ ] Title: `INT-011-014: IRC profile-aware conversations + sidebar UX`
- [ ] Description: All 4 tasks + sidebar summarized
- [ ] Test results: Coverage report included
- [ ] No breaking changes

---

## 🚀 KICKOFF CHECKLIST

Before starting Phase 1, ensure:

- [ ] This document reviewed + approved by Architect
- [ ] Requirements clearly understood (profile uniqueness + sidebar UX)
- [ ] Task breakdown aligns with team capacity
- [ ] No blockers or external dependencies
- [ ] Local environment ready: `docker-compose up -d` running
- [ ] Branch strategy agreed: one branch with 9 commits

**Then**: Start Phase 1 (INT-011 schema + backend mapping)

---

## 📞 DECISION POINTS (If Unclear)

| Question | Recommendation |
|----------|---|
| Rate limiting (INT-012)? | Defer to Phase 2 (not MVP blocker) |
| DLQ already works? | Yes, verify via integration tests |
| Mock IRC server approach? | Use EventEmitter pattern (simpler, faster) |
| Sidebar state storage? | localStorage (simple, persistent) |
| Telegram profile section? | Optional; for MVP, ungrouped is fine |
| Mobile sidebar collapse? | Hamburger menu (standard pattern) |

---

## 🎯 SUCCESS CRITERIA

✅ **Implementation Complete When**:
1. All schema changes deployed + migrations tested
2. Profile-aware conversation upsert working end-to-end
3. Unit tests: 90%+ coverage for IRC connector
4. Integration tests: E2E scenarios passing with mock IRC
5. Sidebar: Profile-grouped accordion rendering correctly
6. Sidebar: Mobile responsive + real-time badge updates
7. All existing tests pass (zero regressions)
8. Documentation updated
9. Single PR created to `dev` with all changes
10. Architect review approved

---

**Next Step**: Begin Phase 1 implementation (INT-011 schema + backend mapping)

For detailed specs, see:
- `PREP_INT_011_014_UPDATED.md` (this directory) — complete task breakdown
- `.docs/02-api-and-data-model.md` — API contract
- `.docs/01-product-specification.md` — product requirements
