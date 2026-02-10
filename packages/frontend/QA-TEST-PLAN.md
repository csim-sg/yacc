# QA Test Plan: FE-008/009/010 & FE-013/014/015

**Prepared for**: PR #243 (API Integration) & PR #244 (WebSocket Listeners)  
**Date**: February 10, 2026  
**Prepared by**: Development Team  
**QA Lead**: To be assigned  

---

## Overview

This document provides comprehensive QA test cases for:
- **PR #243**: FE-008/009/010 - Frontend API Integration & Reply Composer
- **PR #244**: FE-013/014/015 - WebSocket Real-Time Message Listeners

### Prerequisites

Before running tests:
- [ ] Backend running at `http://localhost:3000`
- [ ] Frontend running at `http://localhost:5173`
- [ ] Test database seeded with fixtures
- [ ] Test user account: `test-user@yacc.local` / `TestPassword123`
- [ ] WebSocket server accessible at `ws://localhost:3000`
- [ ] Playwright browsers installed

### Test Execution

```bash
# Install dependencies (if needed)
pnpm install

# Run E2E tests
pnpm --filter @yacc/frontend test

# Run with UI mode for debugging
pnpm --filter @yacc/frontend exec playwright test --ui

# Run specific test file
pnpm --filter @yacc/frontend exec playwright test FE-008-009-010-api-integration.spec.ts
```

---

## Part 1: FE-008/009/010 API Integration & Reply Composer

### FE-008: Inbox List Page - API Integration

#### Test Suite 1: Conversation List Loading

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| FE-008-001 | Load conversations from API | 1. Navigate to `/` <br> 2. Wait for network idle | Conversations display with real API data (not mock) | ⚪ |
| FE-008-002 | Display conversation cards with fields | 1. Navigate to inbox <br> 2. Verify card structure | Each card shows: channel icon, status badge, message preview, assigned user, unread count | ⚪ |
| FE-008-003 | Display correct channel information | 1. Load inbox <br> 2. Check channel displays | Channels display correctly (Telegram, IRC) | ⚪ |
| FE-008-004 | Display conversation status badges | 1. Load inbox <br> 2. Inspect status badges | Statuses show as badges: open (green), pending (yellow), resolved (gray) | ⚪ |
| FE-008-005 | Show message preview text | 1. Load inbox <br> 2. Check message previews | Latest message body truncated to ~100 characters | ⚪ |
| FE-008-006 | Display assigned user information | 1. Load inbox <br> 2. Check assigned user field | Shows assigned user name or "Unassigned" | ⚪ |
| FE-008-007 | Display unread count badge | 1. Load inbox <br> 2. Check unread badge | Unread count displays on card (e.g., "3" badge) | ⚪ |

#### Test Suite 2: Filtering & Sorting

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| FE-008-008 | Filter by channel | 1. Select "Telegram" from filter <br> 2. Observe results | Only Telegram conversations display | ⚪ |
| FE-008-009 | Filter by status | 1. Select "open" status <br> 2. Observe results | Only open conversations display | ⚪ |
| FE-008-010 | Filter by priority | 1. Select "high" priority <br> 2. Observe results | Only high priority conversations display | ⚪ |
| FE-008-011 | Search conversations | 1. Enter search term in search box <br> 2. Press Enter | Results filtered by keyword match | ⚪ |
| FE-008-012 | Sort by latest activity | 1. Load inbox <br> 2. Verify order | Conversations sorted by lastActivity DESC (newest first) | ⚪ |
| FE-008-013 | Multiple filters combined | 1. Apply channel=Telegram + status=open <br> 2. Observe results | Results show only Telegram conversations with open status | ⚪ |
| FE-008-014 | Clear filters | 1. Apply filters <br> 2. Click "Clear all filters" | All conversations reappear | ⚪ |

#### Test Suite 3: Pagination

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| FE-008-015 | Display pagination controls | 1. Load inbox with many conversations <br> 2. Check pagination UI | Pagination shows: "Page 1 of X", prev/next buttons | ⚪ |
| FE-008-016 | Navigate to next page | 1. Load page 1 <br> 2. Click next button <br> 3. Verify new results | Different conversations load on page 2 | ⚪ |
| FE-008-017 | Navigate to previous page | 1. On page 2 <br> 2. Click previous button | Returns to page 1 conversations | ⚪ |
| FE-008-018 | Disable prev on first page | 1. Load page 1 | Previous button is disabled | ⚪ |
| FE-008-019 | Disable next on last page | 1. Navigate to last page | Next button is disabled | ⚪ |

#### Test Suite 4: Loading States & Error Handling

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| FE-008-020 | Show loading skeleton | 1. Navigate to inbox <br> 2. Observe before API response | Loading skeletons appear while fetching | ⚪ |
| FE-008-021 | Hide loading after data arrives | 1. Skeleton visible <br> 2. Wait for API <br> 3. Observe | Skeletons replaced with real data | ⚪ |
| FE-008-022 | Handle API error gracefully | 1. Mock API failure <br> 2. Navigate to inbox | Error message displays: "Failed to load conversations" | ⚪ |
| FE-008-023 | Show retry button on error | 1. API returns error <br> 2. Look for retry button | Retry button visible and clickable | ⚪ |
| FE-008-024 | Retry fetches data | 1. Error displayed <br> 2. Click retry button | API called again, data loads on success | ⚪ |
| FE-008-025 | Handle empty list | 1. Mock empty response <br> 2. Navigate to inbox | "No conversations" message displays | ⚪ |

#### Test Suite 5: User Interactions

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| FE-008-026 | Navigate to conversation on click | 1. Click conversation card <br> 2. Observe URL | Navigates to `/conversations/{id}` | ⚪ |
| FE-008-027 | Mark conversation as read | 1. Click unread conversation <br> 2. Navigate to detail | Unread badge removed from card | ⚪ |
| FE-008-028 | Update UI after filter change | 1. Change filter <br> 2. Observe results update | No page reload needed, results update dynamically | ⚪ |
| FE-008-029 | Preserve filter state on back | 1. Apply filter <br> 2. Navigate to conversation <br> 3. Click back <br> 4. Check filter | Filter state preserved | ⚪ |

---

### FE-009: Conversation Detail Page - API Integration

#### Test Suite 6: Conversation Detail Loading

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| FE-009-001 | Load conversation detail | 1. From inbox, click conversation <br> 2. Wait for load | Conversation detail page loads with real API data | ⚪ |
| FE-009-002 | Display conversation header | 1. Open conversation detail | Header shows: channel, status, priority, assigned user | ⚪ |
| FE-009-003 | Display conversation metadata | 1. Open conversation detail <br> 2. Check info panel | Shows: created date, last activity, assigned user | ⚪ |
| FE-009-004 | Load message timeline | 1. Open conversation <br> 2. Wait for messages | Message timeline loads with all messages | ⚪ |
| FE-009-005 | Display message count | 1. Open conversation <br> 2. Count message items | Message count matches API response | ⚪ |

#### Test Suite 7: Message Display

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| FE-009-006 | Display message sender | 1. Open conversation <br> 2. Check message items | Each message shows sender name | ⚪ |
| FE-009-007 | Display message body | 1. Open conversation <br> 2. Check message items | Each message shows full text body | ⚪ |
| FE-009-008 | Display message timestamp | 1. Open conversation <br> 2. Check timestamps | Each message shows ISO8601 datetime | ⚪ |
| FE-009-009 | Show message direction | 1. Open conversation <br> 2. Inspect messages | Inbound messages (left) vs outbound (right) aligned correctly | ⚪ |
| FE-009-010 | Display outbound message status | 1. Open conversation <br> 2. Find outbound message | Status badge shows: "pending", "sent", or "failed" | ⚪ |
| FE-009-011 | Show message with attachments | 1. Find message with attachment <br> 2. Open conversation | Attachment preview/download link visible | ⚪ |
| FE-009-012 | Order messages chronologically | 1. Open conversation <br> 2. Check order | Messages ordered from oldest (top) to newest (bottom) | ⚪ |

#### Test Suite 8: Navigation & Interactions

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| FE-009-013 | Back button returns to inbox | 1. In conversation <br> 2. Click back button | Navigates to `/` (inbox) | ⚪ |
| FE-009-014 | URL reflects conversation ID | 1. Open conversation <br> 2. Check URL | URL is `/conversations/{uuid}` | ⚪ |
| FE-009-015 | Load conversation by direct URL | 1. Paste URL directly <br> 2. Navigate | Conversation loads correctly from URL | ⚪ |

#### Test Suite 9: Error Handling

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| FE-009-016 | Handle invalid conversation ID | 1. Open `/conversations/invalid` | Error message displays or redirects to inbox | ⚪ |
| FE-009-017 | Handle API error loading conversation | 1. Mock API failure <br> 2. Open conversation | Error message with retry button shows | ⚪ |
| FE-009-018 | Handle API error loading messages | 1. Mock messages API failure | Error displays in message area | ⚪ |

---

### FE-010: Reply Composer Component

#### Test Suite 10: Composer UI & Input

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| FE-010-001 | Display reply composer | 1. Open conversation detail <br> 2. Scroll to bottom | Reply composer textarea visible | ⚪ |
| FE-010-002 | Display placeholder text | 1. View empty textarea | Placeholder text: "Type your reply here..." | ⚪ |
| FE-010-003 | Display character counter | 1. View composer | Counter shows "0 / 5000" | ⚪ |
| FE-010-004 | Update counter while typing | 1. Type "Hello" <br> 2. Check counter | Counter shows "5 / 5000" | ⚪ |
| FE-010-005 | Display send button | 1. View composer | Send button with icon visible | ⚪ |

#### Test Suite 11: Input Validation

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| FE-010-006 | Enforce character limit | 1. Try pasting 6000 chars | Text truncated to 5000 chars | ⚪ |
| FE-010-007 | Show warning at limit | 1. Fill 5000 chars <br> 2. Check counter | Counter shows in red: "5000 / 5000" (limit reached) | ⚪ |
| FE-010-008 | Prevent empty submission | 1. Leave textarea empty <br> 2. Check send button | Send button is disabled | ⚪ |
| FE-010-009 | Prevent whitespace-only submission | 1. Type only spaces/tabs <br> 2. Check send button | Send button is disabled | ⚪ |
| FE-010-010 | Trim whitespace before send | 1. Type "  Hello  " <br> 2. Send <br> 3. Verify message | Message sent as "Hello" (trimmed) | ⚪ |

#### Test Suite 12: Sending Messages

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| FE-010-011 | Send message on button click | 1. Type message <br> 2. Click send button <br> 3. Wait | Message appears in timeline with "pending" status | ⚪ |
| FE-010-012 | Send message with Ctrl+Enter | 1. Type message <br> 2. Press Ctrl+Enter | Message sent (same as button click) | ⚪ |
| FE-010-013 | Clear textarea after send | 1. Send message <br> 2. Check textarea | Textarea cleared and ready for next message | ⚪ |
| FE-010-014 | Show loading state during send | 1. Type message <br> 2. Click send <br> 3. Observe button | Button shows "Sending..." with spinner | ⚪ |
| FE-010-015 | Disable send during submission | 1. Click send <br> 2. Try clicking again | Second click ignored (button disabled) | ⚪ |

#### Test Suite 13: Error Handling

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| FE-010-016 | Show error on send failure | 1. Mock API error <br> 2. Send message <br> 3. Wait | Error alert displays: "Failed to send message" | ⚪ |
| FE-010-017 | Show error reason | 1. Mock specific API error <br> 2. Send | Error message includes reason | ⚪ |
| FE-010-018 | Keep text on error | 1. Send message <br> 2. Fails <br> 3. Check textarea | Message text remains in textarea for editing | ⚪ |
| FE-010-019 | Show dismiss button on error | 1. Error displays <br> 2. Look for dismiss button | Dismiss button visible and clickable | ⚪ |
| FE-010-020 | Dismiss error message | 1. Click dismiss button | Error alert hidden | ⚪ |
| FE-010-021 | Handle network timeout | 1. Set short timeout <br> 2. Send message <br> 3. Wait for timeout | Error displayed after timeout period | ⚪ |

#### Test Suite 14: Accessibility

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| FE-010-022 | Textarea has aria-label | 1. Inspect textarea element | aria-label attribute present | ⚪ |
| FE-010-023 | Send button has aria-label | 1. Inspect button element | aria-label attribute present | ⚪ |
| FE-010-024 | Counter has aria-live | 1. Inspect counter element | aria-live="polite" for screen readers | ⚪ |

---

## Part 2: FE-013/014/015 WebSocket Real-Time Listeners

### FE-013: message.received Listener

#### Test Suite 15: Receiving Inbound Messages

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| FE-013-001 | Receive inbound message in real-time | 1. Open conversation <br> 2. Backend sends `message.received` event <br> 3. Observe | New message appears instantly without page refresh | ⚪ |
| FE-013-002 | Message appears at bottom | 1. Receive message <br> 2. Check position | New message added to end of timeline (bottom) | ⚪ |
| FE-013-003 | Display message details | 1. Receive message <br> 2. Check content | Sender, body, timestamp all visible | ⚪ |
| FE-013-004 | Mark message as inbound | 1. Receive message <br> 2. Check direction | Message appears on left side (inbound style) | ⚪ |
| FE-013-005 | Set message status to sent | 1. Receive message <br> 2. Check status | Message status shows "sent" | ⚪ |

#### Test Suite 16: Unread Count Updates

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| FE-013-006 | Increment unread count | 1. In conversation <br> 2. Receive message <br> 3. Check inbox | Unread badge on conversation card increments | ⚪ |
| FE-013-007 | Update in background | 1. Switch to different conversation <br> 2. Receive message in first conversation | Unread count updates even when not viewing | ⚪ |
| FE-013-008 | Multiple messages update count correctly | 1. Receive 3 messages <br> 2. Check badge | Unread count shows "3" | ⚪ |

#### Test Suite 17: Latest Message Preview

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| FE-013-009 | Update message preview on new message | 1. In inbox <br> 2. Receive message <br> 3. Check card | Message preview shows latest message body | ⚪ |
| FE-013-010 | Update timestamp on new message | 1. Check conversation card <br> 2. Receive message | Timestamp updates to current time | ⚪ |

#### Test Suite 18: Event Deduplication

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| FE-013-011 | Handle duplicate events | 1. Send same event twice (same eventId) <br> 2. Check message count | Message appears only once (deduplication works) | ⚪ |
| FE-013-012 | Process different events | 1. Send 2 events with different eventIds <br> 2. Check messages | Both messages appear | ⚪ |

---

### FE-014: message.sent Listener

#### Test Suite 19: Message Status Updates

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| FE-014-001 | Update status pending → sent | 1. Send message <br> 2. Backend emits `message.sent` | Message status changes from "pending" to "sent" | ⚪ |
| FE-014-002 | Remove loading spinner | 1. Message showing spinner <br> 2. Sent event received | Spinner removed, "sent" badge appears | ⚪ |
| FE-014-003 | Reconcile temp ID → server ID | 1. Send message with temp ID <br> 2. Receive message.sent with serverId | Message ID updated to server ID | ⚪ |

#### Test Suite 20: Real-Time Updates

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| FE-014-004 | Update in background | 1. Send message <br> 2. Switch to different conversation <br> 3. Sent event received | Status updates even when not viewing | ⚪ |
| FE-014-005 | Update multiple messages | 1. Send 2 messages <br> 2. Receive 2 sent events | Both update to "sent" status | ⚪ |

#### Test Suite 21: Error Handling

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| FE-014-006 | Handle duplicate sent events | 1. Send same sent event twice <br> 2. Check UI state | Status updated once (no flickering) | ⚪ |
| FE-014-007 | Handle missing message | 1. Receive sent event for non-existent message | No error, graceful handling | ⚪ |

---

### FE-015: message.failed Listener

#### Test Suite 22: Failed Message Handling

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| FE-015-001 | Update status pending → failed | 1. Send message <br> 2. Backend emits `message.failed` | Status changes to "failed" with error styling | ⚪ |
| FE-015-002 | Display error reason | 1. Receive failed event with error | Error message displays in message tooltip | ⚪ |
| FE-015-003 | Show error styling | 1. Message fails <br> 2. Check visual | Message appears with red/error styling | ⚪ |

#### Test Suite 23: Retry Capability

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| FE-015-004 | Show retry button when canRetry=true | 1. Message fails with canRetry:true <br> 2. Check UI | Retry button appears (for FE-011 implementation) | ⚪ |
| FE-015-005 | Hide retry when canRetry=false | 1. Message fails with canRetry:false | No retry button | ⚪ |

#### Test Suite 24: Error Deduplication

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| FE-015-006 | Handle duplicate failed events | 1. Send same failed event twice | Message shows as failed once (not re-processed) | ⚪ |

---

## WebSocket Resilience Tests

### Test Suite 25: Connection & Reconnection

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| WS-001 | Handle WebSocket disconnect | 1. In conversation <br> 2. Simulate network disconnect | App detects disconnect, shows reconnecting indicator | ⚪ |
| WS-002 | Reconnect successfully | 1. After disconnect <br> 2. Network comes back | App reconnects, indicators disappear | ⚪ |
| WS-003 | Backfill missed events on reconnect | 1. Disconnect <br> 2. Messages sent while offline <br> 3. Reconnect | Missed messages appear after reconnection | ⚪ |
| WS-004 | Deduplicate backfill events | 1. Events sent before/after disconnect <br> 2. Reconnect | No duplicates, all events processed once | ⚪ |
| WS-005 | Work across multiple tabs | 1. Open 2 tabs with conversation <br> 2. Receive message <br> 3. Both tabs should update | Both tabs show new message | ⚪ |

### Test Suite 26: Performance & Load

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PERF-001 | Handle rapid messages | 1. Send 10 messages in quick succession | All appear in order, no lag | ⚪ |
| PERF-002 | Handle many listeners | 1. 5 conversations open <br> 2. Messages in all | All update correctly | ⚪ |

---

## Integration Tests

### Test Suite 27: End-to-End Flows

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| E2E-001 | Send and receive message flow | 1. Load inbox <br> 2. Open conversation <br> 3. Send message <br> 4. Verify appears as pending <br> 5. Backend confirms send <br> 6. Status updates to sent | Complete flow works correctly | ⚪ |
| E2E-002 | Receive message flow | 1. In conversation <br> 2. External message arrives <br> 3. Appears in timeline <br> 4. Unread count updates <br> 5. Inbox preview updates | Complete flow works | ⚪ |
| E2E-003 | Failed message retry flow | 1. Send message <br> 2. Fails with canRetry=true <br> 3. Click retry <br> 4. Succeeds | Complete retry flow | ⚪ |
| E2E-004 | Navigation flow | 1. Inbox → Conversation → Send → Back to Inbox | All transitions work, state preserved | ⚪ |

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] Backend running at `http://localhost:3000`
- [ ] Frontend running at `http://localhost:5173`
- [ ] Test database seeded with fixtures (min 10 conversations, 50+ messages)
- [ ] WebSocket connectivity verified
- [ ] Test user authenticated
- [ ] Playwright configured and browsers installed
- [ ] Network monitoring tools ready (for throttling tests)

### During Testing
- [ ] Execute test suites in order (FE-008 → FE-009 → FE-010 → FE-013 → FE-014 → FE-015)
- [ ] Record results (✓/✗) in Status column
- [ ] Screenshot failures for analysis
- [ ] Note any unexpected behaviors
- [ ] Check browser console for errors
- [ ] Monitor network tab for API calls

### Post-Testing
- [ ] Summarize pass/fail counts
- [ ] Document any bugs found
- [ ] Create GitHub issues for bugs
- [ ] Report test coverage metrics
- [ ] Recommend go/no-go decision

---

## Bug Report Template

```
**Bug Title**: [Concise description]

**Severity**: Critical | High | Medium | Low

**Steps to Reproduce**:
1. [Step]
2. [Step]
3. [Step]

**Expected Result**: 
[What should happen]

**Actual Result**: 
[What actually happened]

**Screenshots**: 
[Attach screenshots]

**Environment**:
- Browser: [Chrome, Firefox, Safari]
- OS: [macOS, Windows, Linux]
- Backend: [Running/Version]
- Frontend: [Running/Version]

**Related Test Case**: [FE-008-001, etc.]
```

---

## Test Success Criteria

### PR #243 (API Integration)
- ✅ All 29 tests in FE-008/009/010 suites pass
- ✅ No console errors
- ✅ API calls observed in Network tab
- ✅ Real data (not mock) displayed
- ✅ Error handling verified
- ✅ No TypeScript warnings

### PR #244 (WebSocket)
- ✅ All 26 tests in FE-013/014/015 suites pass
- ✅ Real-time updates verified
- ✅ Event deduplication confirmed
- ✅ Reconnection handling verified
- ✅ Performance acceptable (sub-100ms updates)
- ✅ Multi-tab functionality working

---

## Regression Testing

After both PRs pass, run these regression tests:

| Area | Test | Command |
|------|------|---------|
| Login | Authentication flow | `pnpm test -- login.spec.ts` |
| Inbox Filters | Filter persistence | Manual test |
| Conversation Detail | Message loading | Manual test |
| Navigation | All routes accessible | Manual test |
| Error States | Error messages display | Manual test |

---

## Approval Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| QA Lead | _____ | _____ | _____ |
| Developer | _____ | _____ | _____ |
| Product Owner | _____ | _____ | _____ |
| Architect | _____ | _____ | _____ |

---

## Notes

- Store test results and screenshots in `.docs/qa/` folder
- Reference this test plan in QA tickets/issues
- Update this document after each test cycle
- Maintain test case traceability to requirements

