# QA-002: E2E Test Cases for Frontend UI (FE-008-011)

**Issue**: #196  
**Status**: Ready for Implementation  
**Scope**: End-to-end user workflows for inbox, conversation view, and message reply  
**Framework**: Playwright  
**Target Coverage**: All user journeys + edge cases

---

## Test Scenarios

### Scenario 1: User Views Inbox
```
Test ID: E2E-001-001
Description: User logs in and views the inbox list
Steps:
  1. Navigate to /login
  2. Enter valid credentials
  3. Click Login button
  4. Verify redirected to /inbox
  5. Verify conversation list displays 20 items
  6. Verify pagination controls visible
  7. Verify sort and filter dropdowns visible
Expected Result: Inbox page loads with conversations
Pass Criteria: All UI elements rendered correctly
```

### Scenario 2: User Filters Conversations
```
Test ID: E2E-002-001
Description: User filters inbox by channel
Steps:
  1. From inbox page, click Channel filter dropdown
  2. Select "Telegram"
  3. Verify list refreshes and shows only Telegram conversations
  4. Verify count reflects filtered results
  5. Click Channel dropdown again, select "IRC"
  6. Verify list shows only IRC conversations
Expected Result: Filters apply immediately
Pass Criteria: UI updates to reflect filter selections
```

### Scenario 3: User Searches Conversations
```
Test ID: E2E-002-002
Description: User searches for conversation by keyword
Steps:
  1. Click search input on inbox page
  2. Type "refund"
  3. Press Enter or click Search button
  4. Verify results show only conversations containing "refund"
  5. Clear search and verify full list returns
Expected Result: Search filters conversations
Pass Criteria: Search results appear within 2 seconds
```

### Scenario 4: User Opens Conversation
```
Test ID: E2E-003-001
Description: User clicks conversation to view details
Steps:
  1. From inbox, click first conversation card
  2. Verify conversation detail page loads
  3. Verify conversation title/ID displays
  4. Verify all messages visible in timeline
  5. Verify sender names and timestamps visible
  6. Verify message status badges visible (sent/pending/failed)
Expected Result: Conversation detail page displays all info
Pass Criteria: Timeline loads and messages visible
```

### Scenario 5: User Sends Reply
```
Test ID: E2E-004-001
Description: User sends reply in conversation
Steps:
  1. Open conversation detail page
  2. Click message composer input
  3. Type "Thank you for your inquiry"
  4. Click Send button
  5. Verify message appears in timeline
  6. Verify message status shows "pending" then "sent"
  7. Verify composer input clears
Expected Result: Message sent and displayed
Pass Criteria: Message appears with correct status
```

### Scenario 6: User Assigns Conversation
```
Test ID: E2E-005-001
Description: User assigns conversation to team member
Steps:
  1. Open conversation detail page
  2. Click Assign dropdown in header
  3. Select team member from list
  4. Verify assignment updated in UI
  5. Verify notification sent to assigned user (mock)
Expected Result: Conversation assigned successfully
Pass Criteria: UI reflects assignment immediately
```

### Scenario 7: User Changes Conversation Status
```
Test ID: E2E-006-001
Description: User changes conversation status
Steps:
  1. Open conversation
  2. Click Status dropdown (currently "open")
  3. Select "resolved"
  4. Verify status updates in UI
  5. Verify status reflected in conversation header
  6. Navigate back to inbox
  7. Verify resolved status shows in list view
Expected Result: Status changes applied
Pass Criteria: Status persists across views
```

### Scenario 8: User Adds Tag
```
Test ID: E2E-007-001
Description: User adds tag to conversation
Steps:
  1. Open conversation
  2. Click Add Tag button
  3. Select tag from dropdown or create new
  4. Verify tag appears in conversation
  5. Navigate back to inbox
  6. Verify tag visible in conversation card
Expected Result: Tags add and persist
Pass Criteria: Tags visible in all views
```

### Scenario 9: User Paginates Inbox
```
Test ID: E2E-008-001
Description: User navigates between pages
Steps:
  1. From inbox showing page 1
  2. Click "Next" pagination button
  3. Verify page 2 conversations load
  4. Verify different conversations displayed
  5. Click "Previous"
  6. Verify page 1 conversations return
Expected Result: Pagination works correctly
Pass Criteria: Correct data loaded per page
```

### Scenario 10: User Handles Failed Message
```
Test ID: E2E-009-001
Description: User sees and retries failed message
Steps:
  1. Open conversation with failed message (mock)
  2. Verify failed status indicator visible
  3. Hover over failed message
  4. Click Retry button
  5. Verify status changes to pending then sent
  6. Verify retry notification appears
Expected Result: Retry mechanism works
Pass Criteria: Failed message recovers on retry
```

### Scenario 11: Real-Time Message Arrives
```
Test ID: E2E-010-001
Description: User receives new message in real-time
Steps:
  1. Open conversation
  2. In another browser/tab, send message to same conversation
  3. Verify new message appears immediately in timeline (no refresh)
  4. Verify unread count updates
  5. Verify notification badge appears in inbox
Expected Result: Real-time updates work
Pass Criteria: Message appears within 1 second
```

### Scenario 12: Accessibility - Keyboard Navigation
```
Test ID: E2E-011-001
Description: User can navigate UI with keyboard only
Steps:
  1. From inbox, Tab to first conversation
  2. Press Enter to open conversation
  3. Tab to message composer
  4. Type message
  5. Press Ctrl+Enter to send
  6. Verify message sent
Expected Result: Full keyboard navigation works
Pass Criteria: All actions achievable via keyboard
```

---

## Browser Compatibility

- ✅ Chrome/Chromium (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest - on macOS)
- ✅ Mobile Safari (iOS latest)
- ✅ Chrome Mobile (Android latest)

---

## Performance Expectations

- Inbox load: < 2 seconds
- Conversation open: < 1 second
- Message send: < 1 second
- Search results: < 2 seconds
- Real-time update: < 500ms

---

## Success Criteria

✅ All scenarios pass on all browsers  
✅ All performance targets met  
✅ No console errors  
✅ Accessibility score WCAG 2.1 AA or higher  
✅ Mobile responsive verified
