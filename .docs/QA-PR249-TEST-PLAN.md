# QA Test Plan: PR #249 Phase 2 Frontend Implementation

**PR**: https://github.com/csim-sg/yacc/pull/249  
**Branch**: `feature/FE-P2-frontend-ui`  
**Target**: `dev`  
**Scope**: Phase 2 Frontend (Admin Pages, Right Panel, Bulk Actions)  
**Test Framework**: Playwright E2E  
**Coverage Target**: 40+ test scenarios  
**Timeline**: Feb 13-14, 2026

---

## 📋 Test Environment Setup

### Prerequisites
```bash
# Start backend services
docker-compose up -d

# Install dependencies
pnpm install

# Start frontend dev server
pnpm --filter @yacc/frontend dev

# Run tests
pnpm --filter @yacc/frontend test:e2e
```

### Test Users Required
- **Super Admin**: `super_admin@test.com` (full access)
- **Admin**: `admin@test.com` (audit export, routing rules, user management)
- **Manager**: `manager@test.com` (view audit logs, assign conversations)
- **User**: `user@test.com` (reply, view assigned conversations only)

### Test Data Setup
- At least 5 conversations with various statuses (open, pending, resolved)
- At least 5 users created
- At least 3 tags existing
- At least 2 audit log entries

---

## 🎯 Test Scenarios by Feature

### A. RBAC & Authentication (8 scenarios)

#### A1: Super Admin Full Access
- [ ] Super Admin can view Audit Logs page
- [ ] Super Admin can export audit logs to CSV
- [ ] Super Admin can view Routing Rules page
- [ ] Super Admin can create/edit/delete routing rules
- [ ] Super Admin can access all admin panels

**Expected**: All admin features accessible

---

#### A2: Admin Access
- [ ] Admin can view Audit Logs page
- [ ] Admin can export audit logs to CSV
- [ ] Admin can view Routing Rules page
- [ ] Admin can create/edit/delete routing rules
- [ ] Admin cannot access super admin functions

**Expected**: Full admin access except super admin functions

---

#### A3: Manager Limited Access
- [ ] Manager can view Audit Logs page (list only, no export)
- [ ] Manager cannot see Export button or it shows "Admin only" tooltip
- [ ] Manager cannot view Routing Rules page (404 or access denied)
- [ ] Manager can see left sidebar navigation without routing rules link
- [ ] Manager can assign conversations to users

**Expected**: Audit view allowed, export blocked, routing rules inaccessible

---

#### A4: User No Admin Access
- [ ] User cannot access Audit Logs page (403 or redirect)
- [ ] User cannot access Routing Rules page (403 or redirect)
- [ ] User cannot assign conversations (no access to assignment panel)
- [ ] User cannot view admin navigation items

**Expected**: Admin pages completely blocked

---

#### A5: Unauthenticated Access
- [ ] Unauthenticated user cannot access Audit Logs
- [ ] Unauthenticated user cannot access Routing Rules
- [ ] Redirects to login page

**Expected**: Access denied, redirect to login

---

#### A6: Role Persistence After Refresh
- [ ] Admin logs in, then page refresh
- [ ] Roles persist correctly (no downgrade)
- [ ] Auth header includes correct user role

**Expected**: Role unchanged after refresh

---

#### A7: Logout & Access Denied
- [ ] Admin logs out
- [ ] Attempting to access Audit Logs returns 401
- [ ] Redirects to login page
- [ ] Cannot access even with manually editing URL

**Expected**: Complete access denial after logout

---

#### A8: Token Refresh During Admin Operation
- [ ] Admin starts export operation
- [ ] Token expires mid-operation
- [ ] System automatically refreshes token (background)
- [ ] Export completes successfully

**Expected**: Token refresh handled transparently; export succeeds

---

### B. Audit Logs Page (8 scenarios)

#### B1: Audit Logs Load & Display
- [ ] Page loads successfully for admin+
- [ ] List of audit logs displays with all columns: Actor, Action, Entity Type, Entity ID, Timestamp
- [ ] At least 5 logs visible in initial load
- [ ] Loading spinner shows while fetching

**Expected**: Audit logs displayed with correct columns

---

#### B2: Audit Logs Pagination
- [ ] First page shows 20 logs
- [ ] "Next" button enabled when more logs exist
- [ ] "Next" button disabled on last page
- [ ] Clicking "Next" loads next 20 logs
- [ ] Previous/First/Last buttons work correctly

**Expected**: Pagination controls work; 20 per page

---

#### B3: Audit Logs Filtering
- [ ] Filter by Action dropdown shows available actions
- [ ] Filter by Entity Type dropdown shows types (conversation, user, tag, etc.)
- [ ] Filters combine: Action + Entity Type + Date range
- [ ] Applying filter resets pagination to page 1
- [ ] Clearing filters shows all logs

**Expected**: Filters reduce result set correctly; pagination resets

---

#### B4: Audit Logs Date Range
- [ ] Date from/to pickers work
- [ ] Setting date range filters logs
- [ ] Invalid date range (from > to) shows error
- [ ] Clearing dates shows all results

**Expected**: Date filtering works; validation on invalid ranges

---

#### B5: Export Audit Logs (Admin Only)
- [ ] Admin sees "Export CSV" button
- [ ] Clicking export triggers download
- [ ] Downloaded file has `.csv` extension
- [ ] CSV contains headers: Actor, Action, Entity Type, Entity ID, Timestamp, Metadata
- [ ] CSV includes all logs matching current filters

**Expected**: CSV downloaded successfully; file contains correct data

---

#### B6: Export RBAC (Manager Blocked)
- [ ] Manager views Audit Logs page
- [ ] Export button shows "Admin only" tooltip
- [ ] Export button is disabled (greyed out)
- [ ] Clicking disabled button does nothing

**Expected**: Export blocked for manager; UX explains why

---

#### B7: Export Error Handling
- [ ] Network error during export shows user-visible error (not just console)
- [ ] Error message: "Failed to export audit logs. Please try again."
- [ ] Can retry export after error
- [ ] 403 error shows: "You do not have permission to export"

**Expected**: All errors visible to user; can retry

---

#### B8: Audit Logs Search/Filter Performance
- [ ] Filtering on 1000+ logs completes in <2 seconds
- [ ] No UI lag when typing in filters
- [ ] Results update as you type (debounced)

**Expected**: Sub-2 second query performance

---

### C. Routing Rules Page (6 scenarios)

#### C1: Routing Rules Load & Display
- [ ] Admin can view Routing Rules page
- [ ] List shows all rules: Name, Conditions, Actions, Status, Last Run
- [ ] Rules display correctly with human-readable conditions/actions
- [ ] Loading spinner shows while fetching

**Expected**: Rules loaded and displayed

---

#### C2: Create New Routing Rule
- [ ] Admin clicks "New Rule" button
- [ ] Form opens with fields: Name, Conditions (builder), Actions (builder), Status
- [ ] Can add multiple conditions (AND logic)
- [ ] Can add multiple actions
- [ ] Saving rule creates it in database

**Expected**: Rule creation works; saves to database

---

#### C3: Edit Routing Rule
- [ ] Admin clicks edit on existing rule
- [ ] Form pre-fills with rule data
- [ ] Can modify any field
- [ ] Saving updates rule in database

**Expected**: Rule editing works; updates persist

---

#### C4: Delete Routing Rule
- [ ] Admin clicks delete on rule
- [ ] Confirmation dialog appears
- [ ] Confirming deletes rule
- [ ] Rule disappears from list

**Expected**: Rule deletion works

---

#### C5: Toggle Rule Status
- [ ] Admin can toggle rule between Active/Disabled
- [ ] Disabled rules show with different styling (greyed out)
- [ ] Status change persists on page refresh

**Expected**: Status toggling works; persists

---

#### C6: Routing Rules Access Control
- [ ] Super Admin can access page
- [ ] Admin can access page
- [ ] Manager cannot access page (404 or denied)
- [ ] User cannot access page (404 or denied)

**Expected**: Admin+ only access

---

### D. Right Panel - Assignment Section (10 scenarios)

#### D1: Open Assignment Section
- [ ] Conversation page shows Right Panel (lg+ screens)
- [ ] Assignment section visible in Right Panel
- [ ] Shows current assignee (or "Unassigned")
- [ ] Shows user list dropdown to select assignee

**Expected**: Assignment UI displays correctly

---

#### D2: Assign Conversation (Manager)
- [ ] Manager user opens conversation
- [ ] Clicks "Assign" or selects user from dropdown
- [ ] Assignment mutation sends POST `/api/conversations/:conversationId/assign`
- [ ] Conversation updates to show new assignee
- [ ] Cache updates immediately (optimistic)

**Expected**: Assignment succeeds for manager

---

#### D3: Assign Conversation (Admin)
- [ ] Admin user opens conversation
- [ ] Can assign to user
- [ ] Can also reassign to different user
- [ ] Assignment sends correct HTTP request
- [ ] UI updates immediately

**Expected**: Admin can assign

---

#### D4: No Unassign Option (MVP)
- [ ] Manager views assigned conversation
- [ ] No "Unassigned" button shown
- [ ] Cannot send null assignedUserId
- [ ] Reassigning to different user works as alternative

**Expected**: Unassign not exposed in MVP

---

#### D5: Admin Unassign (Future)
- [ ] **Deferred to Phase 3** - not testable in MVP
- [ ] Document as "Phase 3: Implement admin-only unassign"

**Expected**: Mark as future work

---

#### D6: Assignment Error Handling
- [ ] Network error during assignment shows user error
- [ ] 403 error (user lacks role) shows: "You do not have permission to assign"
- [ ] Can retry assignment after error

**Expected**: Errors visible; can retry

---

#### D7: Assignment Cache Invalidation
- [ ] After assigning conversation A to User X
- [ ] Conversation details immediately reflect new assignee
- [ ] Inbox list also shows updated assignment
- [ ] No manual refresh needed

**Expected**: Cache updates automatically

---

#### D8: Assign to Non-Existent User
- [ ] Trying to assign to non-existent user ID
- [ ] API returns 404 or validation error
- [ ] UI shows error: "User not found"
- [ ] Assignment not sent

**Expected**: Validation prevents invalid assignment

---

#### D9: Empty User List
- [ ] User list is empty (Phase 3 - API not yet implemented)
- [ ] Dropdown shows: "User list coming in Phase 3"
- [ ] Cannot assign without users available
- [ ] UI handles gracefully

**Expected**: Graceful degradation when user list empty

---

#### D10: Assignment Permissions (User Role)
- [ ] User (non-manager) cannot assign conversations
- [ ] Assignment section shows "No permissions" or similar
- [ ] User can only view which user conversation is assigned to

**Expected**: Assignment blocked for non-manager

---

### E. Right Panel - Tags Section (6 scenarios)

#### E1: View Existing Tags
- [ ] Conversation page shows Tags section
- [ ] Existing tags on conversation display with colored badges
- [ ] Tags show with delete (X) button

**Expected**: Tags display correctly

---

#### E2: Add Tag to Conversation
- [ ] Click "Add Tag" or dropdown
- [ ] Select tag from list
- [ ] Tag appears in conversation immediately
- [ ] Mutation sends correct request to backend
- [ ] Cache updates (no page refresh needed)

**Expected**: Tag added successfully

---

#### E3: Remove Tag from Conversation
- [ ] Click X button next to tag
- [ ] Confirmation: "Remove tag?"
- [ ] Confirming removes tag from conversation
- [ ] UI updates immediately

**Expected**: Tag removed from conversation

---

#### E4: Create New Tag Inline
- [ ] Dropdown has "Create new tag" option
- [ ] Entering tag name and color
- [ ] New tag created and immediately applied to conversation
- [ ] New tag appears in tag list for future use

**Expected**: Inline tag creation works

---

#### E5: Tag Error Handling
- [ ] Duplicate tag error shows user-visible message
- [ ] Max tag limit (if exists) shows error
- [ ] Network error during tag operation shows error

**Expected**: Errors visible to user

---

#### E6: Tag Persistence
- [ ] After tagging conversation
- [ ] Page refresh shows tag still applied
- [ ] Archive/restore conversation preserves tags

**Expected**: Tags persist across sessions

---

### F. Right Panel - Notes Section (6 scenarios)

#### F1: View Existing Notes
- [ ] Notes section displays all notes on conversation
- [ ] Each note shows: Author name, timestamp, content
- [ ] Notes ordered by newest first

**Expected**: Notes displayed correctly

---

#### F2: Create New Note
- [ ] Click "Add Note" button
- [ ] Text field opens for input
- [ ] Type note content
- [ ] Click "Save" button
- [ ] Note appears in list immediately
- [ ] Backend receives note create request

**Expected**: Note created and saved

---

#### F3: Note with @Mentions
- [ ] Type "@" in note field
- [ ] Mention suggestions appear (user list)
- [ ] Select user to @mention
- [ ] @mention appears as `@username` in note
- [ ] Backend parses mentions and sends notifications

**Expected**: @mention parsing works; notifications sent

---

#### F4: Edit Note
- [ ] Click edit button on existing note
- [ ] Note becomes editable
- [ ] Modify content
- [ ] Save updates note
- [ ] Backend receives PATCH request

**Expected**: Note editing works

---

#### F5: Delete Note
- [ ] Click delete button on note
- [ ] Confirmation: "Delete this note?"
- [ ] Confirming removes note
- [ ] Note disappears from UI immediately

**Expected**: Note deletion works

---

#### F6: Note Permissions
- [ ] Only creator can edit/delete own notes
- [ ] Others see notes but no edit/delete buttons
- [ ] Non-conversation participants cannot see notes (if applicable)

**Expected**: Note ownership enforced

---

### G. Right Panel - Status Section (4 scenarios)

#### G1: Change Conversation Status
- [ ] Status dropdown shows options: Open, Pending, Resolved
- [ ] Select new status
- [ ] Conversation updates immediately
- [ ] Status change appears in audit log

**Expected**: Status change works; logged to audit

---

#### G2: Status Auto-Reopen
- [ ] Resolved conversation receives new inbound message
- [ ] Status automatically changes to Open
- [ ] UI reflects reopened status
- [ ] Audit log shows "auto-reopened"

**Expected**: Auto-reopen works

---

#### G3: Status Prevents Certain Actions
- [ ] Resolved conversation: can still reply (if needed)
- [ ] Status doesn't prevent viewing/searching

**Expected**: Status is informational; doesn't block core functions

---

#### G4: Status Permissions
- [ ] Manager+ can change status
- [ ] Users cannot change status (read-only)

**Expected**: Status changes gated by role

---

### H. Bulk Actions Bar (8 scenarios)

#### H1: Bulk Actions Bar Display
- [ ] Select checkbox on first conversation
- [ ] Bulk Actions Bar appears below inbox header
- [ ] Shows: "1 selected" + action buttons
- [ ] Clear selection button available

**Expected**: Bulk bar appears when items selected

---

#### H2: Select Multiple Conversations
- [ ] Select 5 conversations
- [ ] Bulk bar shows: "5 selected"
- [ ] Select All button selects all visible conversations
- [ ] Deselect All button clears all selections

**Expected**: Multi-select works

---

#### H3: Bulk Assign
- [ ] Select 3 conversations
- [ ] Click "Assign" button
- [ ] User dropdown opens
- [ ] Select user
- [ ] All 3 conversations assigned to that user
- [ ] Mutations batched into single operation

**Expected**: Bulk assign works; applied to all selected

---

#### H4: Bulk Assign - No Unassign Option
- [ ] Bulk Assign dropdown
- [ ] No "Unassigned" option shown (MVP)
- [ ] Placeholder: "User list coming in Phase 3"
- [ ] Cannot bulk assign to null

**Expected**: Unassign not exposed in bulk

---

#### H5: Bulk Tag
- [ ] Select 2 conversations
- [ ] Click "Tag" button
- [ ] Select/create tag
- [ ] Both conversations tagged
- [ ] Tag appears on both in inbox list

**Expected**: Bulk tagging works

---

#### H6: Bulk Status Change
- [ ] Select 3 conversations
- [ ] Click "Status" button
- [ ] Select new status (Pending, Resolved, etc.)
- [ ] All 3 updated
- [ ] List reflects status change

**Expected**: Bulk status works

---

#### H7: Bulk Actions Error Handling
- [ ] Network error during bulk operation
- [ ] Shows error: "Failed to update 3 conversations. X succeeded, Y failed."
- [ ] Can retry failed items
- [ ] Partially successful operations show: "2 succeeded, 1 failed"

**Expected**: Partial success handled gracefully

---

#### H8: Bulk Actions Limit (Max 100)
- [ ] Select more than 100 items
- [ ] System shows: "Maximum 100 conversations at a time"
- [ ] Cannot bulk select >100
- [ ] Performing bulk action on exactly 100 works

**Expected**: 100-item limit enforced

---

### I. Conversation Page Integration (5 scenarios)

#### I1: Right Panel Displays on Desktop
- [ ] Open conversation on desktop (lg+ screen)
- [ ] Right Panel visible on right side
- [ ] All sections (Assignment, Tags, Notes, Status) visible
- [ ] Layout responsive and readable

**Expected**: Right Panel visible on desktop

---

#### I2: Right Panel Hidden on Mobile
- [ ] Open conversation on mobile (<lg screen)
- [ ] Right Panel hidden or in drawer
- [ ] Can expand to view if desired
- [ ] Main conversation view takes full width on mobile

**Expected**: Right Panel responsive

---

#### I3: Right Panel Cache Updates
- [ ] Change assignment in Right Panel
- [ ] Send new message in conversation
- [ ] Add/remove tags in Right Panel
- [ ] All changes reflected in both UI and backend

**Expected**: Cache stays in sync

---

#### I4: Conversation Page Load Performance
- [ ] Open conversation with 50+ messages
- [ ] Page loads in <2 seconds
- [ ] Right Panel renders without lag
- [ ] Scrolling conversation smooth (60 FPS)

**Expected**: Performance acceptable

---

#### I5: Switch Conversations in Right Panel
- [ ] Viewing conversation A with assignment
- [ ] Click conversation B from list
- [ ] Right Panel updates to show B's assignment, tags, notes
- [ ] No stale data from A shown

**Expected**: Right Panel state updates with conversation

---

### J. Error Scenarios & Edge Cases (5 scenarios)

#### J1: Network Error During Critical Operation
- [ ] Simulate network failure (DevTools offline)
- [ ] Click "Export" button
- [ ] Error shown: "Network error. Please try again."
- [ ] Enabling network + retry works

**Expected**: Network errors handled gracefully

---

#### J2: API Timeout
- [ ] Simulate slow API (>30 second response)
- [ ] Request times out
- [ ] Error shown: "Request timed out"
- [ ] User can retry

**Expected**: Timeout handled; user notified

---

#### J3: Malformed Response
- [ ] Backend returns invalid JSON
- [ ] Frontend shows error: "Failed to parse response"
- [ ] Does not crash UI

**Expected**: Malformed response handled

---

#### J4: 401 Unauthorized (Token Expired)
- [ ] Token expires during operation
- [ ] System refreshes token automatically
- [ ] Operation completes if possible
- [ ] If refresh fails, user redirected to login

**Expected**: Token refresh handled transparently

---

#### J5: 403 Forbidden (Permission Denied)
- [ ] User without admin role tries to export
- [ ] 403 response received
- [ ] Error shown: "You do not have permission to export"
- [ ] User not presented with broken UI

**Expected**: Permission errors handled gracefully

---

### K. UI/UX Checks (5 scenarios)

#### K1: Visual Consistency
- [ ] Right Panel matches overall app theme
- [ ] Buttons consistent with rest of app
- [ ] Colors and spacing follow design system
- [ ] No misaligned elements

**Expected**: Consistent UI across app

---

#### K2: Accessibility
- [ ] All buttons have proper `aria-label` or text
- [ ] Form fields have labels
- [ ] Can navigate with keyboard (Tab key)
- [ ] Can open dropdowns with keyboard
- [ ] Color contrast meets WCAG AA standard

**Expected**: App is accessible

---

#### K3: Loading States
- [ ] When fetching audit logs, spinner shows
- [ ] When exporting, spinner shows + "Generating..."
- [ ] When assigning, mutation state shows loading
- [ ] Loading states prevent duplicate clicks

**Expected**: Clear feedback during async operations

---

#### K4: Empty States
- [ ] Audit logs page with no logs shows: "No audit logs found"
- [ ] Routing rules page with no rules shows: "No rules created yet"
- [ ] Conversation with no notes shows: "No notes yet"
- [ ] Conversation with no tags shows: "No tags added"

**Expected**: Clear empty state messages

---

#### K5: Success Feedback
- [ ] After creating rule: "Rule created successfully"
- [ ] After exporting: Download starts + toast: "Export started"
- [ ] After assigning: "Conversation assigned to [User]"
- [ ] Toast messages auto-dismiss after 3 seconds

**Expected**: User gets clear feedback on success

---

---

## 📊 Test Summary Template

### Defects Found
- [ ] Defect ID: `<number>`
- [ ] Title: `<brief title>`
- [ ] Severity: `<Critical | High | Medium | Low>`
- [ ] Steps to reproduce: `<steps>`
- [ ] Expected: `<expected result>`
- [ ] Actual: `<actual result>`
- [ ] Environment: `<browser, OS, resolution>`

### Test Results
```
Total Scenarios: 80
Passed: ___
Failed: ___
Blocked: ___
Skipped: ___

Pass Rate: ____%
Coverage: ____%
```

### Sign-Off
- [ ] QA Lead: __________ Date: __________
- [ ] Product Owner: __________ Date: __________
- [ ] Ready for merge: [ ] Yes [ ] No

---

## 🚀 Next Steps After QA

1. **If All Pass**: Merge PR #249 to dev (squash and merge)
2. **If Defects Found**: File issues, prioritize by severity
   - Critical/High: Fix before merge
   - Medium: Fix in Phase 3 or post-MVP
   - Low: Document as tech debt
3. **Update `.docs/plans/00-INDEX.md`**: Mark Phase 2 Frontend COMPLETE

---

**QA Test Execution**: Start Feb 13, 2026  
**Target Completion**: Feb 14, 2026  
**Merge Target**: Feb 14-15, 2026  
**MVP Completion**: Feb 20, 2026
