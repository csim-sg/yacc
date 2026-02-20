# Implementation Prep Plan: INT-011..INT-014 (UPDATED WITH NEW REQUIREMENTS)

**Date**: 2026-02-20  
**Status**: ✅ **READY FOR IMPLEMENTATION** (New requirements confirmed)  
**Target Tasks**: INT-011, INT-012, INT-013, INT-014  
**Integration Scope**: Backend channel mapping, error handling, comprehensive tests, **+ Frontend sidebar UX**

---

## 📋 EXECUTIVE SUMMARY

### New Requirements (Confirmed)
1. **IRC Conversation Uniqueness** (INT-011 scope change):
   - **Per `ircProfile + channel`**: Each IRC profile's channels map to unique conversations
   - **Per `ircProfile + user`**: DM conversations are unique per profile and user combination
   - Example: `(profile_id=p1, channel='#chat')` ≠ `(profile_id=p2, channel='#chat')` — **DIFFERENT conversations**

2. **Frontend Sidebar UX** (NEW scope for FE):
   - **Each IRC profile** appears as a **main tab or accordion** in the sidebar
   - **Expands to show**:
     - Joined channels (from that profile)
     - Ongoing DMs (from that profile)
   - **Profile-grouped conversations** instead of flat list
   - Mobile behavior: collapsible/expandable per profile

### Deliverables
- ✅ **Backend**: Channel mapping with `ircProfileId + channel` uniqueness
- ✅ **Backend**: Error handling & DLQ integration
- ✅ **Backend**: Unit tests (90%+ coverage)
- ✅ **Backend**: Integration tests (E2E with mock IRC server)
- ✅ **Frontend**: Sidebar component with profile-grouped conversations
- ✅ **Common**: Updated types for `ircProfileId` in conversation model
- ✅ **QA**: Unit/integration tests + E2E tests for new sidebar UX

---

## 🎯 REQUIREMENT DETAILS

### INT-011: IRC Channel Mapping (Backend + Common Types)

**Description**: Map IRC channels to conversations with profile-aware uniqueness

**Acceptance Criteria**:
- Conversation uniqueness constraint: `UNIQUE(ircProfileId, externalThreadId)` for channels
- Conversation uniqueness constraint: `UNIQUE(ircProfileId, externalUserId)` for DMs (future)
- Channel joins create/update conversations
- `externalThreadId` = channel name (e.g., '#general')
- `ircProfileId` stored in conversation for profile tracking
- No duplicate conversations per profile+channel combo

**Current State**:
- ✅ `irc-ingestion.service.ts` already creates conversations per channel
- ⏳ **Gap**: `ircProfileId` not yet stored in conversation model or ingestion

**Implementation Areas**:

| File | Changes | Priority |
|------|---------|----------|
| `packages/common/src/db/schema.ts` | Add `ircProfileId` (optional UUID) to `conversations` table; add unique index `(ircProfileId, externalThreadId)` | P0 |
| `packages/backend/src/services/irc-ingestion.service.ts` | Pass `ircProfileId` to upsert logic; filter conversations by profile in queries | P0 |
| `packages/backend/src/services/conversation.service.ts` | Add `ircProfileId` filter in conversation list/detail queries | P0 |
| `packages/backend/src/connectors/irc.connector.ts` | Pass `ircProfileId` when calling ingestion service | P0 |

---

### INT-012: Error Handling & DLQ Integration (Backend)

**Description**: Handle IRC connection errors, DLQ for failed messages, rate limiting

**Acceptance Criteria** (unchanged):
- Connection errors logged with correlation ID ✅ (already done)
- Failed messages moved to DLQ ✅ (already exists via BE-015)
- DLQ processing works ✅ (already exists)
- Rate limiting enforced (scope clarification needed; recommend MVP = no-op)

**Current State**:
- ✅ Error logging with correlation IDs exists
- ✅ DLQ integration via `messageRetryWorker.ts` exists
- ⏳ **Gap**: No rate limiting enforcement; deferred to Phase 2 (recommend)

**Implementation Areas**:

| File | Changes | Priority |
|------|---------|----------|
| `packages/backend/src/connectors/irc.connector.ts` | Verify error handling covers all scenarios; add tests | P0 |
| `packages/backend/src/services/irc-ingestion.service.ts` | Verify DLQ error handling in message ingestion | P0 |
| (NO NEW FILE) | Rate limiting deferred to Phase 2 (not MVP blocker) | P2 |

**Recommendation**: Mark INT-012 rate limiting as **deferred**; focus on verification of existing error handling + DLQ integration.

---

### INT-013: Unit Tests for IRC Connector (Backend)

**Description**: Comprehensive unit test coverage for IRC connector and ingestion

**Acceptance Criteria**:
- 90%+ code coverage for IRC connector
- All code paths tested
- Edge cases covered (CRLF injection, message truncation, self-echo, profile-aware upserts)

**Implementation Areas**:

| File | Changes | Priority |
|------|---------|----------|
| `packages/backend/src/connectors/__tests__/irc.connector.test.ts` | Expand existing skeleton to 90%+ coverage | P0 |
| `packages/backend/src/services/__tests__/irc-ingestion.service.test.ts` | Add tests for profile-aware upsert logic, DM handling | P0 |
| `packages/backend/src/services/__tests__/conversation.service.test.ts` | Add tests for profile-based filtering | P0 |

---

### INT-014: Integration Tests for IRC Connector (Backend)

**Description**: End-to-end integration tests using mock IRC server

**Acceptance Criteria**:
- E2E flows working (connect → inbound msg → DB updated)
- All scenarios covered
- Integration with DB validated
- Profile-aware conversation creation tested

**Implementation Areas**:

| File | Changes | Priority |
|------|---------|----------|
| `packages/backend/src/__tests__/irc-integration.test.ts` | E2E tests with mock IRC server, profile-based scenarios | P0 |

---

## 🎨 FRONTEND SIDEBAR UX (NEW SCOPE)

### FE-Sidebar: IRC Profile-Grouped Conversations

**Description**: Redesign sidebar to group conversations by IRC profile

**Current State**:
- ✅ Sidebar shows flat list of conversations
- ⏳ **Gap**: No profile-aware grouping for IRC

**Acceptance Criteria**:
- Each IRC profile appears as a **collapsible section** (accordion or tab)
- Within each profile section:
  - List of joined channels (e.g., `#general`, `#random`)
  - List of ongoing DMs (e.g., `@user1`, `@user2`)
- Click on channel/DM opens conversation detail
- Collapsed/expanded state persists in localStorage
- Mobile: sidebar collapses to icons; expand on tap
- Telegram conversations: appear under "Telegram" (default profile or ungrouped)
- Badge shows unread count per profile + per conversation

**Implementation Areas**:

| File/Component | Changes | Priority |
|---|---|---|
| `packages/frontend/src/components/Sidebar.tsx` | Refactor to profile-grouped layout with accordion/expandable sections | P0 |
| `packages/frontend/src/types/sidebar.types.ts` (NEW) | Types: `ProfileSection`, `ConversationItem`, accordion state | P0 |
| `packages/frontend/src/hooks/useSidebarState.ts` (NEW) | Hook: manage accordion open/closed state per profile (localStorage) | P0 |
| `packages/frontend/src/hooks/useProfileConversations.ts` (NEW) | Hook: fetch conversations grouped by profile (via existing API + local grouping) | P0 |
| `packages/frontend/src/api/conversations.ts` | Add query filter for `ircProfileId` (if backend supports); or group locally | P0 |
| Playwright E2E | Add test: expand IRC profile, click channel, verify conversation loaded | P1 |

---

## 📊 IMPLEMENTATION MAPPING (COMPLETE)

### Files to Create

| File | Task | Purpose |
|------|------|---------|
| `packages/backend/src/services/__tests__/irc-ingestion.service.test.ts` | INT-013 | Unit tests for profile-aware upsert |
| `packages/backend/src/__tests__/irc-integration.test.ts` | INT-014 | E2E integration tests with mock server |
| `packages/frontend/src/types/sidebar.types.ts` | FE-Sidebar | Sidebar component types |
| `packages/frontend/src/hooks/useSidebarState.ts` | FE-Sidebar | Sidebar accordion state management |
| `packages/frontend/src/hooks/useProfileConversations.ts` | FE-Sidebar | Profile-grouped conversation fetching |

### Files to Modify

| File | Task | Changes |
|------|------|---------|
| `packages/common/src/db/schema.ts` | INT-011 | Add `ircProfileId` (optional) to conversations; add unique index |
| `packages/backend/src/services/irc-ingestion.service.ts` | INT-011, INT-012, INT-013 | Implement profile-aware upsert; verify error handling |
| `packages/backend/src/services/conversation.service.ts` | INT-011 | Add `ircProfileId` filter in list/detail queries |
| `packages/backend/src/connectors/irc.connector.ts` | INT-011, INT-012, INT-013 | Pass `ircProfileId` to ingestion; verify error handling |
| `packages/backend/src/connectors/__tests__/irc.connector.test.ts` | INT-013 | Expand existing skeleton to 90%+ coverage |
| `packages/frontend/src/components/Sidebar.tsx` | FE-Sidebar | Refactor to profile-grouped layout |
| `packages/frontend/src/api/conversations.ts` | FE-Sidebar | Add support for profile-based filtering (if needed) |

### No Changes Needed (Already Complete)

- ✅ `packages/backend/src/services/messageRetryWorker.ts` — DLQ infrastructure exists
- ✅ `packages/backend/src/workers/messageRetryWorker.ts` — retry worker functional
- ✅ Error logging with correlation IDs in IRC connector

---

## 🔄 UPDATED DATA MODEL

### Conversation Schema Changes

```typescript
// In packages/common/src/db/schema.ts

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    channel: conversationChannelEnum('channel').notNull(), // 'telegram', 'irc'
    externalThreadId: text('external_thread_id'), // Channel name for IRC, thread ID for Telegram
    externalUserId: text('external_user_id'), // For DMs: user ID on platform
    ircProfileId: uuid('irc_profile_id'), // NEW: Links to integration_configs (irc) profile
    telegramChatId: bigint('telegram_chat_id'), // Existing: Links to Telegram chat
    status: conversationStatusEnum('status').default('open'), // open, pending, resolved
    priority: conversationPriorityEnum('priority').default('normal'), // low, normal, high, urgent
    assignedUserId: uuid('assigned_user_id'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    // UNIQUE constraints for profile-aware conversation identity
    ircChannelUnique: uniqueIndex('ix_irc_channel_unique').on(table.ircProfileId, table.externalThreadId),
    ircDMUnique: uniqueIndex('ix_irc_dm_unique').on(table.ircProfileId, table.externalUserId),
    // Existing indexes
    assignedUserIdx: index('ix_conversations_assigned_user_id').on(table.assignedUserId),
    statusIdx: index('ix_conversations_status').on(table.status),
  })
);
```

**Migration needed**: Add `ircProfileId` column + unique indexes (INT-011 backend task)

---

## 🛠️ BACKEND TASK BREAKDOWN (INT-011..INT-014)

### Phase 1: INT-011 (Backend + Common) — 8-10 hours

#### 1.1 Schema Update (2 hours)
```bash
# Task: Add ircProfileId to conversation schema
# File: packages/common/src/db/schema.ts
# Changes:
# - Add optional ircProfileId: uuid('irc_profile_id')
# - Add unique index: (ircProfileId, externalThreadId)
# - Add unique index: (ircProfileId, externalUserId) — reserved for future DM support
# Tests: No tests for schema; verify Drizzle compilation
```

#### 1.2 Ingestion Service Update (3-4 hours)
```bash
# Task: Implement profile-aware conversation upsert
# File: packages/backend/src/services/irc-ingestion.service.ts
# Changes:
# - Accept ircProfileId in InboundIRCMessageDTO
# - Update upsertConversation(channel, ircProfileId) signature
# - Filter conversations by BOTH ircProfileId AND externalThreadId
# - Update unique constraint checks to include ircProfileId
# Tests: Unit tests for profile-aware upsert (INT-013)
```

#### 1.3 Conversation Service Update (2 hours)
```bash
# Task: Add profile filtering to conversation queries
# File: packages/backend/src/services/conversation.service.ts
# Changes:
# - Update list/detail queries to filter by ircProfileId (if provided)
# - Ensure conversations are scoped to profile
# Tests: Unit tests for profile-filtered queries
```

#### 1.4 IRC Connector Update (2 hours)
```bash
# Task: Pass ircProfileId to ingestion service
# File: packages/backend/src/connectors/irc.connector.ts
# Changes:
# - Retrieve ircProfileId from connector config
# - Pass ircProfileId to ircIngestionService.ingestMessage()
# Tests: Unit tests for profile passing (INT-013)
```

---

### Phase 2: INT-012 (Backend) — 6-8 hours

#### 2.1 Error Handling Audit (3-4 hours)
```bash
# Task: Verify error handling covers all scenarios
# Files:
# - packages/backend/src/connectors/irc.connector.ts
# - packages/backend/src/services/irc-ingestion.service.ts
# - packages/backend/src/workers/messageRetryWorker.ts
# Changes: Verify (no new code likely needed)
# - Correlation IDs propagated in all error paths
# - Failed messages reach DLQ correctly
# - Error logs are structured + actionable
# Tests: Unit + integration tests for error scenarios (INT-013/014)
```

#### 2.2 DLQ Integration Verification (2-3 hours)
```bash
# Task: Verify DLQ picks up IRC failures
# Files:
# - packages/backend/src/workers/messageRetryWorker.ts
# Changes: Verify (no new code likely needed)
# - IRC delivery failures trigger retry queue
# - 3 failed retries move message to DLQ
# - DLQ entries readable via management endpoint
# Tests: Integration test for DLQ flow (INT-014)
```

#### 2.3 Rate Limiting (DEFERRED to Phase 2)
```bash
# Recommendation: Mark as NOT MVP blocker
# Rationale: Current IRC connector does not enforce rate limits
# Phase 2 task: Implement token bucket or sliding window per profile
# For now: Assume IRC server handles rate limiting
```

---

### Phase 3: INT-013 (Backend) — 12-14 hours

#### 3.1 Expand IRC Connector Unit Tests (6-8 hours)
```bash
# File: packages/backend/src/connectors/__tests__/irc.connector.test.ts
# Current: Existing skeleton with 28/28 tests from INT-001-010
# Expand to cover:
# - Connection states (connected, retrying, disconnected, failed)
# - Message send/receive
# - Authentication (nick + password)
# - Error scenarios (timeout, connection reset, auth failure)
# - Reconnection logic (exponential backoff, incident ID)
# - Edge cases (CRLF injection, message length, self-echo, UNICODE)
# - Profile ID passing to ingestion
# Coverage target: 90%+
```

#### 3.2 Ingestion Service Unit Tests (4-5 hours)
```bash
# File: packages/backend/src/services/__tests__/irc-ingestion.service.test.ts
# New file (or expand existing)
# Tests:
# - Profile-aware conversation upsert (unique constraint validation)
# - Self-echo detection
# - Channel vs DM detection
# - Message body sanitization
# - Auto-reopen resolved conversations
# - WebSocket event emission
# - Error handling (DB errors, concurrent inserts)
# Coverage target: 85%+
```

#### 3.3 Conversation Service Profile Filtering Tests (2-3 hours)
```bash
# File: packages/backend/src/services/__tests__/conversation.service.test.ts
# Expand existing or new tests:
# - List conversations filtered by ircProfileId
# - Detail conversation respects profile scope
# - Query performance (no N+1 joins)
# Coverage target: 85%+
```

#### 3.4 Measure Coverage & Fix Gaps (2 hours)
```bash
# Command: pnpm --filter @yacc/backend test:coverage
# Target: 90%+ for IRC connector, 85%+ overall
# Fix any untested branches
```

---

### Phase 4: INT-014 (Backend) — 15-18 hours

#### 4.1 Design Integration Test Setup (2-3 hours)
```bash
# Task: Plan mock IRC server approach
# Decision: Use irc-framework mock (EventEmitter pattern from unit tests)
# Rationale: Faster, simpler, sufficient for MVP validation
# Design:
# - Mock IRC server class that extends EventEmitter
# - Emulates channel join, message send, disconnect events
# - No real TCP; entirely in-memory
```

#### 4.2 Implement Integration Tests (8-10 hours)
```bash
# File: packages/backend/src/__tests__/irc-integration.test.ts
# Scenarios:
# 1. Connect to mock IRC → Channel join → conversation created in DB with ircProfileId
# 2. Receive inbound message → ingestion → message stored with conversation reference
# 3. Send message from UI → IRC delivery worker → message sent to mock IRC channel
# 4. Disconnect from IRC → status updated in memory → auto-reconnect scheduled
# 5. Connection error → message fails → DLQ entry created
# 6. Max retries exhausted → incident logged, status = failed
# 7. Multi-profile scenario: Two profiles, same channel → Different conversations created
# Tests:
# - Setup: Create test users, profiles, conversations
# - Cleanup: Tear down mock server, DB state
# - Assertions: DB consistency, message ordering, status transitions
# Coverage: Critical paths only (integration tests are high-level)
```

#### 4.3 Verify End-to-End Flows (3-4 hours)
```bash
# Tasks:
# - Connect IRC connector in test environment
# - Simulate channel join → verify conversation created
# - Simulate inbound message → verify ingestion + WebSocket event
# - Simulate send message → verify delivery to mock IRC
# - Simulate disconnect/reconnect → verify status tracking
# - Simulate profile-aware scenarios → verify unique conversations per profile
```

#### 4.4 Run Full Test Suite & Coverage (2 hours)
```bash
# Commands:
pnpm --filter @yacc/backend test              # All tests pass
pnpm --filter @yacc/backend test:coverage     # 90%+ connector, 85%+ overall
pnpm --filter @yacc/backend lint              # No errors
pnpm --filter @yacc/backend build             # TypeScript compiles
```

---

## 🎨 FRONTEND TASK BREAKDOWN (FE-Sidebar)

### Phase 5: FE-Sidebar (Frontend) — 16-20 hours

#### 5.1 Types & Hooks Setup (3-4 hours)
```bash
# File: packages/frontend/src/types/sidebar.types.ts (NEW)
# Types:
# - ProfileSection: { profileId, profileName, isExpanded, channels, dms, unreadCount }
# - ConversationItem: { conversationId, name, unreadCount, isSelected }
# - SidebarState: { expandedProfiles: Map<profileId, boolean> }

# File: packages/frontend/src/hooks/useSidebarState.ts (NEW)
# Hook:
# - Load/save sidebar state from localStorage
# - Toggle profile accordion open/close
# - Export as context provider for Sidebar component

# File: packages/frontend/src/hooks/useProfileConversations.ts (NEW)
# Hook:
# - Fetch conversations via existing API (GET /conversations)
# - Filter/group locally by (channel, ircProfileId)
# - Return grouped structure: { telegram: [...], irc_profiles: { profile1: {...}, ... } }
```

#### 5.2 Sidebar Component Refactor (6-8 hours)
```bash
# File: packages/frontend/src/components/Sidebar.tsx (MODIFY)
# Current: Flat list of conversations
# New: Profile-grouped accordion layout
# Changes:
# - Render Telegram section (ungrouped or default profile)
# - For each IRC profile: render collapsible section with channels + DMs
# - Use useSidebarState for accordion state
# - Use useProfileConversations for conversation list
# - Add loading/error states
# - Add badge for unread count per profile + per conversation
# - Mobile: collapse sidebar to icons; expand on tap
# - Click on channel/DM: emit navigation event or navigate directly

# Styling: Tailwind CSS (leverage existing brand colors)
# Accessibility: ARIA labels for accordion, keyboard navigation
```

#### 5.3 API Integration (2-3 hours)
```bash
# File: packages/frontend/src/api/conversations.ts (MODIFY if needed)
# Evaluate:
# - Can existing GET /conversations support ircProfileId filter?
# - If yes: add optional param to API call
# - If no: fetch all and group locally (simpler MVP approach)
# Recommendation: Group locally (no backend change needed)
```

#### 5.4 State Management Integration (2-3 hours)
```bash
# Task: Connect sidebar to WebSocket real-time updates
# Files:
# - useSidebarState.ts: Listen to conversation.updated events
# - Sidebar.tsx: Re-render on conversation changes
# - Update unread badges in real-time
```

#### 5.5 Mobile & Responsive Design (2-3 hours)
```bash
# Task: Ensure sidebar works on mobile
# Changes:
# - Sidebar collapses to icon bar on small screens
# - Tap icon to expand profile section
# - Swipe/gesture to close sidebar
# - Profile name visible on hover/focus
# - Test on mobile device or responsive mode
```

---

## 📋 QA TASK BREAKDOWN

### QA Tasks: Unit & Integration Tests

#### QA-INT-011: Unit Tests for Profile-Aware Upsert (3-4 hours)

```bash
# File: packages/backend/src/services/__tests__/irc-ingestion.service.test.ts
# Tests:
# - Given same channel but different ircProfileId → different conversations created
# - Given same ircProfileId + channel → same conversation fetched/updated
# - Verify unique constraint enforced (attempt to create duplicate fails)
# - Verify profile ID stored in conversation
# - Edge case: NULL ircProfileId (Telegram) handled correctly
# Coverage: 85%+
```

#### QA-INT-012: Error Handling Unit Tests (3-4 hours)

```bash
# Files: 
# - packages/backend/src/connectors/__tests__/irc.connector.test.ts
# - packages/backend/src/services/__tests__/irc-ingestion.service.test.ts
# Tests:
# - Connection timeout → error logged with correlationId
# - Connection reset → auto-reconnect triggered
# - Message delivery failure → DLQ entry created
# - Max retries exhausted → status = failed
# Coverage: 85%+
```

#### QA-INT-013: Integration Tests for Profile-Aware Flow (8-10 hours)

```bash
# File: packages/backend/src/__tests__/irc-integration.test.ts
# Scenarios:
# - E2E: Two IRC profiles, same channel name → different conversations
# - E2E: Inbound message in profile1 → ingests to profile1 conversation only
# - E2E: Multi-profile full lifecycle (connect, ingest, reply, DLQ)
# Coverage: Critical paths
```

#### QA-FE-Sidebar: E2E Tests for Sidebar UX (5-6 hours)

```bash
# File: packages/frontend/e2e/sidebar.spec.ts (NEW)
# Tests (Playwright):
# - Sidebar renders with Telegram + IRC profiles
# - Click IRC profile → expands to show channels
# - Click channel → navigates to conversation
# - Unread badges update in real-time
# - Profile collapsed/expanded state persists
# - Mobile: sidebar collapses to icons; expand on tap
# Happy path: Login → sidebar visible → expand profile → click channel → conversation opens
```

---

## 🚀 GIT WORKFLOW & PR STRATEGY

### Recommended Approach: One Branch, Multiple Commits, One PR

```bash
# Create feature branch
git checkout dev
git pull origin dev
git checkout -b task/INT-011-014-irc-completion-with-sidebar

# Commit 1: Schema + common types (INT-011)
# Changes: packages/common/src/db/schema.ts + migration
git add -A
git commit -m "INT-011: Add ircProfileId to conversation schema with unique indexes"

# Commit 2: Backend ingestion + services (INT-011)
# Changes: irc-ingestion.service.ts, conversation.service.ts, irc.connector.ts
git add -A
git commit -m "INT-011: Implement profile-aware conversation mapping and filtering"

# Commit 3: Backend error handling (INT-012)
# Changes: Audit error handling in irc.connector.ts, irc-ingestion.service.ts
git add -A
git commit -m "INT-012: Verify error handling, DLQ integration, add correlation ID propagation"

# Commit 4: Backend unit tests (INT-013)
# Changes: irc.connector.test.ts, irc-ingestion.service.test.ts, conversation.service.test.ts
git add -A
git commit -m "INT-013: Add comprehensive unit tests for IRC connector and ingestion (90%+ coverage)"

# Commit 5: Backend integration tests (INT-014)
# Changes: irc-integration.test.ts
git add -A
git commit -m "INT-014: Add end-to-end integration tests with mock IRC server and profile scenarios"

# Commit 6: Frontend sidebar types and hooks (FE-Sidebar)
# Changes: sidebar.types.ts, useSidebarState.ts, useProfileConversations.ts
git add -A
git commit -m "FE-Sidebar: Add types and hooks for profile-grouped conversation display"

# Commit 7: Frontend sidebar component (FE-Sidebar)
# Changes: Sidebar.tsx, conversations.ts API adjustments
git add -A
git commit -m "FE-Sidebar: Refactor sidebar to profile-grouped accordion layout with mobile support"

# Commit 8: Frontend E2E tests (FE-Sidebar)
# Changes: sidebar.spec.ts
git add -A
git commit -m "FE-Sidebar: Add Playwright E2E tests for profile-grouped sidebar and navigation"

# Commit 9: Documentation updates
# Changes: .docs/plans/00-INDEX.md, .docs/02-api-and-data-model.md, PREP file
git add -A
git commit -m "docs: Update implementation status and sidebar architecture for INT-011-014"

# Push and create PR
git push origin task/INT-011-014-irc-completion-with-sidebar
# Create PR on GitHub: target = dev, description includes all 4 tasks + sidebar
```

---

## ✅ VERIFICATION COMMANDS

### Pre-Merge Checklist (MUST ALL PASS)

```bash
# 1. Run all backend tests
pnpm --filter @yacc/backend test
# Expected: All tests pass (28+ existing + new INT-011-014 tests)
# Expected: Coverage ≥ 85% overall, ≥ 90% for IRC connector

# 2. Run all frontend tests
pnpm --filter @yacc/frontend test
# Expected: All tests pass (including new sidebar E2E tests)

# 3. Check backend coverage report
pnpm --filter @yacc/backend test:coverage
# Expected: 90%+ coverage for:
# - packages/backend/src/connectors/irc.connector.ts
# - packages/backend/src/services/irc-ingestion.service.ts
# - packages/backend/src/services/conversation.service.ts

# 4. Run linter
pnpm --filter @yacc/backend lint
pnpm --filter @yacc/frontend lint
# Expected: No errors, no warnings
# Expected: No `any` types used
# Expected: Flat folder structure

# 5. Type check
pnpm --filter @yacc/backend build
pnpm --filter @yacc/frontend build
# Expected: TypeScript compiles without errors

# 6. Full workflow test (clean state)
rm -rf packages/backend/dist packages/backend/node_modules/.vitest
rm -rf packages/frontend/dist packages/frontend/node_modules/.vitest
pnpm --filter @yacc/backend test && \
pnpm --filter @yacc/backend lint && \
pnpm --filter @yacc/backend build && \
pnpm --filter @yacc/frontend test && \
pnpm --filter @yacc/frontend lint
# Expected: All steps complete successfully

# 7. Verify migration exists
ls -la packages/backend/src/db/migrations/ | grep ircProfileId
# Expected: Migration file created for schema changes

# 8. Run from project root
pnpm install
pnpm build
pnpm test
# Expected: All workspaces build and test successfully
```

### Example SUCCESS Output

```
✓ Backend Tests (INT-011-014 + existing)
  ✓ src/connectors/__tests__/irc.connector.test.ts (45 tests) 1.2s
  ✓ src/services/__tests__/irc-ingestion.service.test.ts (18 tests) 900ms
  ✓ src/services/__tests__/conversation.service.test.ts (12 tests) 650ms
  ✓ src/__tests__/irc-integration.test.ts (15 tests) 2.5s
  ✓ ... (other existing tests)

Test Files  28 passed (28)
     Tests  240 passed (240)
  Duration  48.3s

Coverage summary:
- irc.connector.ts: 92% (37/40 branches)
- irc-ingestion.service.ts: 88% (42/47 statements)
- conversation.service.ts: 86% (31/36 statements)
Overall: 87.5%

✓ Backend Linter: 0 errors, 0 warnings
✓ Backend TypeScript: No errors

✓ Frontend Tests
  ✓ src/components/__tests__/Sidebar.test.tsx (12 tests) 800ms
  ✓ e2e/sidebar.spec.ts (8 tests) 3.2s
  ... (other frontend tests)

Test Files  15 passed (15)
     Tests  95 passed (95)
  Duration  12.5s

✓ Frontend Linter: 0 errors, 0 warnings
✓ Frontend TypeScript: No errors
```

---

## 📈 IMPLEMENTATION TIMELINE

### Recommended Sequential Execution

| Phase | Tasks | Duration | Assignee | Dependencies |
|-------|-------|----------|----------|--------------|
| **1** | INT-011: Schema + Backend mapping | 8-10 hrs | Backend Dev | Arch review |
| **2** | INT-012: Error handling verification | 6-8 hrs | Backend Dev | INT-011 |
| **3** | INT-013: Unit tests (backend) | 12-14 hrs | Backend Dev + QA | INT-011, INT-012 |
| **4** | INT-014: Integration tests (backend) | 15-18 hrs | Backend Dev + QA | INT-013 |
| **5** | FE-Sidebar: Types + hooks | 3-4 hrs | Frontend Dev | Schema finalized |
| **6** | FE-Sidebar: Component refactor | 6-8 hrs | Frontend Dev | Types + hooks |
| **7** | FE-Sidebar: E2E tests | 5-6 hrs | Frontend Dev + QA | Component done |
| **8** | Docs + verification | 2-3 hrs | Backend/Frontend Dev | All tasks |
| **PR & Review** | Arch review + feedback loop | 4-6 hrs | All | All tasks done |

**Total**: ~60-75 hours (distributed across backend + frontend)

---

## 🎯 DELIVERABLES CHECKLIST

### Backend (INT-011..INT-014)
- [ ] Schema migration: `ircProfileId` added to conversations
- [ ] Unique indexes: `(ircProfileId, externalThreadId)` and `(ircProfileId, externalUserId)`
- [ ] IRC ingestion service: Profile-aware conversation upsert
- [ ] Conversation service: Profile filtering in list/detail queries
- [ ] IRC connector: Pass `ircProfileId` to ingestion
- [ ] Error handling verified: Correlation IDs propagated, DLQ integration working
- [ ] Unit tests: 90%+ coverage for IRC connector and ingestion
- [ ] Integration tests: E2E flows with mock IRC server
- [ ] Migration file created and tested
- [ ] Zero `any` types, flat folder structure, one-def-per-file
- [ ] All existing tests still pass (no regressions)
- [ ] Lint passes, TypeScript compiles

### Frontend (FE-Sidebar)
- [ ] Sidebar types file created (ProfileSection, ConversationItem, etc.)
- [ ] useSidebarState hook: localStorage persistence for accordion state
- [ ] useProfileConversations hook: Profile-grouped conversation fetching
- [ ] Sidebar component: Refactored to profile-grouped accordion layout
- [ ] Mobile support: Collapsible sidebar, responsive design
- [ ] Real-time updates: WebSocket integration for unread badges
- [ ] E2E tests: Playwright tests for sidebar UX
- [ ] Zero `any` types, componentized, accessible
- [ ] All existing tests still pass (no regressions)
- [ ] Lint passes, TypeScript compiles

### Common
- [ ] Conversation schema: `ircProfileId` added + unique indexes
- [ ] Types updated for frontend usage (if needed)

### QA
- [ ] Unit tests for profile-aware upsert and error handling
- [ ] Integration tests for multi-profile scenarios
- [ ] E2E tests for sidebar UX
- [ ] Coverage ≥ 85% for new code, ≥ 90% for connector
- [ ] Regression tests: All existing tests pass

### Documentation
- [ ] `.docs/plans/00-INDEX.md`: INT-011..INT-014 marked as COMPLETED
- [ ] `.docs/02-api-and-data-model.md`: Updated conversation schema with `ircProfileId`
- [ ] `.docs/03-implementation-guide.md`: IRC profile-aware architecture documented
- [ ] PREP file updated with completion summary
- [ ] ADR reference (if new pattern introduced)

---

## 🔄 RISK MITIGATION

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Migration complexity (schema change) | 🟡 Medium | Test migration in dev env first; rollback plan ready |
| Profile filtering breaks existing queries | 🟡 Medium | Scope filtering to IRC only; Telegram unaffected (NULL ircProfileId) |
| Sidebar UX change breaks mobile | 🟡 Medium | Test on mobile devices; fallback to flat list if needed |
| DLQ integration already works, no gap | 🟢 Low | Verify via integration tests; document if no changes needed |
| Regression in INT-001-010 tests | 🔴 High | Run full test suite after each commit; fix immediately |
| Profile-aware upsert race condition | 🟡 Medium | Use transaction; add retry logic; test with concurrent inserts |

---

## 📝 QUESTIONS FOR ARCH/PO (If Clarification Needed)

1. **Rate limiting (INT-012)**: Should we implement now or defer to Phase 2?
   - **Recommendation**: Defer (not MVP blocker)

2. **DLQ verification (INT-012)**: Should integration tests specifically test DLQ flow?
   - **Recommendation**: Yes, add scenario to INT-014

3. **Sidebar state (FE-Sidebar)**: Persist in localStorage or Zustand?
   - **Recommendation**: localStorage (survives page reload, simple)

4. **Telegram profile grouping**: Should Telegram also appear as a "profile" section?
   - **Recommendation**: Optional; for MVP, can stay ungrouped or under "Telegram" default

5. **Mobile sidebar**: Collapse to icon bar or hamburger menu?
   - **Recommendation**: Hamburger menu (standard pattern)

---

## ✨ FINAL STATUS

🟢 **READY FOR IMPLEMENTATION**

- ✅ Requirements confirmed (profile uniqueness, sidebar UX)
- ✅ Files mapped (backend, frontend, common)
- ✅ Tasks broken down (INT-011..INT-014 + FE-Sidebar)
- ✅ QA plan defined
- ✅ Verification commands ready
- ✅ Risk mitigation identified

**Next Step**: Start with INT-011 (schema + backend mapping), follow sequential plan above, one PR to `dev` when all tasks complete.

---

**Prepared by**: FullStack Developer (Claude Code)  
**Date**: 2026-02-20  
**Time Estimate**: 60-75 hours total  
**Target Merge**: Single PR to `dev` with 8-9 logical commits  
