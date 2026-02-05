# FE-006: Conversation Timeline & Advanced Features - Comprehensive Todo List

**Status:** 🎯 READY FOR IMPLEMENTATION  
**Created:** 2026-01-26  
**Dependencies:** FE-004 (✅ Complete), FE-005 (In Progress)  
**Estimated Duration:** 3-4 weeks (120-160 hours)  
**Team:** Frontend Developer (Primary) + Designer (Collaboration)

---

## Table of Contents

1. [Product Requirements Breakdown](#1-product-requirements-breakdown)
2. [Technical Specifications](#2-technical-specifications)
3. [Architecture & Design](#3-architecture--design)
4. [Implementation Tasks (22 Items)](#4-implementation-tasks-22-items)
5. [Testing Requirements](#5-testing-requirements)
6. [Documentation Needs](#6-documentation-needs)
7. [Success Criteria](#7-success-criteria)
8. [Timeline & Milestones](#8-timeline--milestones)

---

## 1. Product Requirements Breakdown

### 1.1 User-Facing Features

**Feature: Full Conversation Timeline**
- Messages displayed in chronological order (oldest first, scroll to newest)
- Message details visible: sender name, avatar, timestamp, status
- System events shown inline: assignments, tag additions, status changes, notes
- Message grouping: messages from same sender within 5 minutes grouped together
- Auto-scroll to newest message when opened
- Infinite scroll or pagination for performance (load 50 at a time)
- Thread replies visible under parent message (if applicable)
- Search within conversation (highlight matching text)

**Feature: Message Editing & Deletion**
- Edit button visible on user's own messages
- Click edit opens inline editor with original message text
- Submit saves edited message, shows "edited" label
- Delete button removes message permanently
- Deleted message shows placeholder: "This message was deleted"
- Edit history optional (Phase 2)
- Edit/delete only works for own messages (or admin)
- Actions logged in audit trail

**Feature: Inline Reactions/Emojis**
- Hover on message reveals reaction picker
- Click emoji adds reaction to message (e.g., 👍)
- Reaction count visible (👍 3)
- Click reaction count shows who reacted
- Remove own reaction by clicking it again
- Max 10 different reactions per message
- Real-time reaction updates via WebSocket
- Reactions sync across tabs

**Feature: File Attachment Preview**
- Images displayed inline in timeline (thumbnails + full-size on click)
- PDFs shown as embed or download link
- Documents (Word, Excel, etc.) show icon + download link
- Videos show play button + metadata
- Unsupported files show generic file icon + download
- File info displayed: name, size, upload time
- Download link opens in new tab or starts download
- Preview modal (lightbox) for full-size images
- No loading delay (cached on R2)

**Feature: @Mentions with Notifications**
- Type @ in message/note triggers autocomplete dropdown
- Autocomplete shows matching users
- Click user inserts @username mention
- Mentioned user receives notification
- @mention rendered as highlighted link (clickable → user profile)
- Mentions tracked in timeline (system event)
- Multiple mentions in single message supported
- @mentions in notes separate from message mentions

**Feature: Tags and Notes System**
- Tags panel visible in right sidebar
- Add tags from existing list or create new inline
- Tag colors customizable
- Tags filterable in inbox
- Remove tags with X button
- Notes section shows all internal notes
- Add note button opens text editor
- Note author + timestamp displayed
- @mentions in notes trigger notifications
- Notes persist with conversation (visible on reopen)

**Feature: Conversation Search**
- Search box within conversation (not global search)
- Search message bodies + sender names
- Highlight matching text in timeline
- Date range filter (optional)
- Result count displayed
- Navigate between results (next/prev)
- Clear search returns to full timeline
- Performance: <500ms for typical queries

**Feature: Read Receipts & Delivery Status**
- Outbound message shows delivery status: pending → sent → failed
- Inbound message shows read/unread state (visual distinction)
- Typing indicator shows user is composing
- Message read timestamp (when conversation opened by another user)
- "Seen by X people" indicator (optional, Phase 2)
- Retry button for failed messages

**Feature: Conversation Export**
- Export button in conversation header
- Export options: PDF, CSV, JSON
- PDF: formatted timeline with timestamps + sender info
- CSV: structured table (date, sender, message, type)
- JSON: raw message objects + metadata
- Export includes only message body (not audit log)
- File naming: `conversation-{id}-{date}.{ext}`
- Background job for large exports (1000+ messages)

**Feature: Rich Text Editor**
- Markdown support for message composition
- Preview mode (optional)
- Formatting toolbar: bold, italic, code, link
- Inline code: backticks → monospace
- Code blocks: triple backticks → formatted code
- Lists: dash/asterisk → bullet points
- Links: [text](url) syntax
- Emoji picker
- Paste images → upload + embed
- Character limit: 4000 characters
- Draft auto-save (localStorage)

### 1.2 Business Acceptance Criteria

**Acceptance Criteria for Timeline:**
- [ ] Timeline renders 100+ messages smoothly (no jank)
- [ ] Messages ordered chronologically (newest last)
- [ ] Infinite scroll/pagination loads incrementally
- [ ] Auto-scroll to newest on open
- [ ] System events inline (assignments, tags, status)
- [ ] Unread marker visible
- [ ] Search within conversation works
- [ ] Export generates valid PDF/CSV
- [ ] Timeline persists across navigation
- [ ] No duplicate messages

**Acceptance Criteria for Message Editing:**
- [ ] Edit button visible on own messages only
- [ ] Edit mode shows original text
- [ ] Submit saves edited message
- [ ] "Edited" label shows edit timestamp
- [ ] Deleted message shows placeholder
- [ ] Audit log tracks edits
- [ ] No edit history visible (Phase 2)
- [ ] Changes broadcast via WebSocket

**Acceptance Criteria for Attachments:**
- [ ] Images display inline (thumbnail)
- [ ] Click image opens lightbox (full-size)
- [ ] PDFs embeddable or download link
- [ ] File info visible (name, size, time)
- [ ] Download works without page reload
- [ ] No loading delay (R2 CDN cached)
- [ ] Unsupported files show icon + download
- [ ] Mobile-friendly (responsive)

**Acceptance Criteria for @Mentions:**
- [ ] @ triggers autocomplete
- [ ] Dropdown shows matching users
- [ ] Click inserts @username
- [ ] Mentioned user gets notification
- [ ] Multiple mentions in message supported
- [ ] Mentions highlighted in timeline
- [ ] Mentions work in notes separately
- [ ] Notification delivery <500ms

**Acceptance Criteria for Tags:**
- [ ] Add/remove tags in right panel
- [ ] Create new tags inline
- [ ] Tag colors visible
- [ ] Tags filter inbox
- [ ] Tags persist with conversation
- [ ] Max 10 tags per conversation

**Acceptance Criteria for Search:**
- [ ] Search box visible in conversation
- [ ] Results highlight in timeline
- [ ] Date range filter (optional)
- [ ] <500ms response time
- [ ] Clear search returns to full timeline

**Acceptance Criteria for Export:**
- [ ] PDF export formatted + readable
- [ ] CSV export structured + importable
- [ ] Export button visible in header
- [ ] File naming includes conversation ID + date
- [ ] Large exports (1000+ messages) handled async
- [ ] Export includes timestamp + sender + message

**Acceptance Criteria for Rich Text:**
- [ ] Markdown syntax supported
- [ ] Preview mode shows rendered text
- [ ] Toolbar buttons work (bold, italic, code)
- [ ] Paste images uploads + embeds
- [ ] Character limit enforced (4000)
- [ ] Draft auto-save works
- [ ] Emoji picker available
- [ ] Mobile-friendly

### 1.3 Edge Cases to Handle

1. **Very Long Messages**: Message >4000 characters
   - Expected: Truncated in timeline, full text on expand
   - Mitigation: Truncate to 200 chars, add "Read more" button

2. **Images with Unknown MIME Type**: 
   - Expected: Show as generic file, still downloadable
   - Mitigation: Fallback to file icon

3. **Large Timeline (5000+ messages)**:
   - Expected: Renders smoothly without memory leak
   - Mitigation: Virtual scrolling (react-window)

4. **Simultaneous Edit by Multiple Users**:
   - Expected: Last edit wins, conflicting edits show warning
   - Mitigation: Timestamp comparison, server-side conflict resolution

5. **Edit Window Closed Without Save**:
   - Expected: Draft saved, user can re-edit
   - Mitigation: Auto-save to localStorage

6. **Failed Export for Large Conversation**:
   - Expected: Show progress, retry on failure
   - Mitigation: Background job + polling

7. **Attachment Upload During Offline**:
   - Expected: Queued, uploaded on reconnect
   - Mitigation: Offline queue (FE-005)

8. **Rich Text with Special Characters**:
   - Expected: Characters escaped, no XSS
   - Mitigation: Sanitize HTML output (DOMPurify)

9. **Deleted User Editing Message**:
   - Expected: Message shows "User deleted" + content still editable
   - Mitigation: Store user info at message time

10. **Reaction Spam (1000+ reactions)**:
    - Expected: Renders efficiently
    - Mitigation: Paginate reactions (show top 10, click to see all)

### 1.4 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Timeline Render Performance** | >60 FPS | Frame rate during scroll |
| **Search Response Time** | <500ms | Time from query to results |
| **Image Load Time** | <1s | Time from click to display |
| **Export Generation** | <5s | Time to generate PDF (100 msgs) |
| **Scroll Smoothness** | 100% | No frame drops during scroll |
| **Memory Usage** | <150MB | Heap with 1000 messages |
| **Bundle Size** | <100KB | Code + dependencies (gzipped) |
| **Test Coverage** | ≥80% | Lines covered by tests |
| **Accessibility** | WCAG 2.1 AA | All components accessible |
| **Mobile Performance** | >85 Lighthouse | LCP, FID, CLS scores |

---

## 2. Technical Specifications

### 2.1 Technology Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Virtual Scrolling** | react-window or TanStack Virtual | 1000+ messages without jank |
| **Rich Text Editor** | Slate or ProseMirror | Markdown support, custom extensions |
| **Markdown Parser** | remark + rehype | Parse markdown to HTML |
| **HTML Sanitizer** | DOMPurify | Prevent XSS from user input |
| **Image Lightbox** | PhotoSwipe or react-medium-image-zoom | Full-size image view |
| **Emoji Picker** | emoji-picker-element | Native emoji picker |
| **Export Library** | html2pdf (PDF), papaparse (CSV) | Generate export files |
| **Autocomplete** | react-autocomplete or Downshift | @mention suggestions |
| **Performance Profiling** | React DevTools Profiler | Monitor render performance |
| **Testing** | Vitest + Playwright | Unit + E2E coverage |
| **Type Safety** | TypeScript strict mode | Full type checking |

### 2.2 Integration Points

**API Endpoints:**
- GET `/api/conversations/:id/messages` (paginated timeline)
- PUT `/api/conversations/:id/messages/:messageId` (edit message)
- DELETE `/api/conversations/:id/messages/:messageId` (delete message)
- GET `/api/conversations/:id/messages/search?q=query` (search)
- POST `/api/conversations/:id/export?format=pdf|csv|json` (export)
- GET `/api/conversations/:id/attachments/:attachmentId` (download)
- GET `/api/users` (for @mention autocomplete)
- POST `/api/conversations/:id/messages/:messageId/reactions` (add reaction)

**WebSocket Events (from FE-005):**
- `message.edited` - Message edited
- `message.deleted` - Message deleted
- `reaction.added` - Reaction added
- `reaction.removed` - Reaction removed

**State Management:**
- TanStack Query for message timeline cache
- Zustand for UI state (edit mode, search query, export progress)
- React Context for timeline context (selected message, scroll position)

### 2.3 Data Structures

**Message Timeline Item:**
```typescript
type TimelineMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  body: string;
  bodyHtml?: string;  // rendered markdown
  direction: 'inbound' | 'outbound';
  status: 'pending' | 'sent' | 'failed';
  attachments: Attachment[];
  reactions: Record<string, string[]>;  // emoji → [userIds]
  mentions: string[];  // @usernames
  createdAt: ISO8601;
  editedAt?: ISO8601;
  deletedAt?: ISO8601;
};

type TimelineSystemEvent = {
  type: 'assignment' | 'tag' | 'status' | 'note' | 'mention';
  actor: { id: string; name: string };
  action: string;
  metadata: object;
  createdAt: ISO8601;
};
```

---

## 3. Architecture & Design

### 3.1 Component Hierarchy

```
ConversationView/
├── ConversationHeader
│   ├── ConversationTitle
│   ├── ParticipantList
│   ├── PresenceIndicators
│   └── ActionMenu (export, etc.)
├── TimelineContainer
│   ├── UnreadMarker
│   ├── VirtualScrollView (react-window)
│   │   ├── MessageItem (grouped)
│   │   │   ├── MessageAvatar
│   │   │   ├── MessageBody (markdown rendered)
│   │   │   ├── MessageAttachments
│   │   │   │   ├── ImageThumbnail
│   │   │   │   └── FileDownloadLink
│   │   │   ├── MessageReactions
│   │   │   │   ├── EmojiPill (count)
│   │   │   │   └── EmojiReactionPicker
│   │   │   ├── MessageStatus
│   │   │   ├── MessageActions (edit, delete, react)
│   │   │   └── MessageTimestamp
│   │   └── SystemEventItem
│   ├── SearchBar
│   ├── SearchResults (highlights)
│   └── TimelineFooter (loading indicator)
├── ComposerArea
│   ├── RichTextEditor
│   │   ├── EditorToolbar
│   │   ├── EmojiPicker
│   │   ├── CharacterCounter
│   │   └── MarkdownPreview
│   ├── AttachmentUpload
│   └── SendButton
├── RightPanel
│   ├── TagsPanel
│   │   ├── TagList
│   │   └── AddTagInput
│   ├── NotesPanel
│   │   ├── NoteList
│   │   └── AddNoteEditor
│   ├── AssignmentPanel
│   └── StatusPanel
└── ExportModal
    ├── FormatSelector (PDF, CSV, JSON)
    ├── ProgressBar
    └── DownloadLink
```

### 3.2 Timeline Virtual Scrolling

```
Timeline with 1000+ messages:
├── Visible area (100 messages at once)
├── Virtualized above/below (don't render)
├── Buffer zone (render 20 extra on each side)
└── Dynamic row height (calculate per message)

Implementation: react-window
- Fixed row height for performance
- Estimate row size for better UX
- Scroll to bottom on new message
- Bidirectional scroll (up = load older)
```

### 3.3 Message Edit Flow

```
User clicks "Edit":
├── Show inline editor with original text
├── User modifies text
├── Click "Save" or press Ctrl+Enter
├── POST /api/conversations/:id/messages/:messageId
├── Server validates + saves
├── Server emits WebSocket "message.edited"
├── Client updates cache + re-renders
├── Show "Edited" label + timestamp
└── Close editor

User clicks "Cancel":
└── Close editor without saving

Server side validation:
├── User owns message (or admin)
├── Message not older than 24 hours
├── Body under 4000 chars
└── Audit log entry
```

### 3.4 Rich Text Editor Implementation

```
Input → Markdown Parser → HTML → Sanitizer → Display

Example:
User types: **bold** _italic_ `code`
Parser: Convert to <strong>, <em>, <code>
Sanitizer: Remove dangerous HTML
Display: Rendered with Tailwind styles
```

---

## 4. Implementation Tasks (22 Items)

### Phase 1: Timeline Display & Message Management (Tasks 1-6)

#### Task FE-006-T01: Timeline Message Display
**Complexity:** Large (12-14 hours)  
**Dependency:** FE-004, FE-005  
**Description:**  
Build message timeline component. Display messages in chronological order with sender info, timestamps, status. Handle message grouping by sender.

**Acceptance Criteria:**
- [ ] Messages displayed oldest first
- [ ] Message grouping: same sender within 5 min grouped together
- [ ] Sender avatar, name, timestamp visible
- [ ] Message status visible (pending/sent/failed)
- [ ] Unread marker visible
- [ ] Auto-scroll to newest on conversation open
- [ ] Pagination or infinite scroll loads 50 at a time
- [ ] No duplicate messages
- [ ] Performance: 100+ messages without jank
- [ ] Mobile-responsive
- [ ] Accessible (ARIA labels, keyboard nav)
- [ ] Unit tests cover grouping + ordering
- [ ] E2E test verifies render performance

**Implementation Notes:**
- Use react-window for virtual scrolling (1000+ messages)
- Message grouping logic: `group by (senderId, createdAt - 5min window)`
- Pagination: cursor-based (createdAt), load older on scroll up
- Status icon: pending (spinner), sent (checkmark), failed (X)

---

#### Task FE-006-T02: Message Edit & Delete
**Complexity:** Large (10-12 hours)  
**Dependency:** FE-006-T01  
**Description:**  
Implement edit and delete functionality. Show edit button for own messages, allow inline editing with save/cancel.

**Acceptance Criteria:**
- [ ] Edit button visible on own messages only
- [ ] Delete button visible on own messages + admin
- [ ] Edit button opens inline editor
- [ ] Editor shows original message text
- [ ] Save button sends PUT request
- [ ] Cancel button closes editor without saving
- [ ] "Edited" label appears with timestamp
- [ ] Delete button shows confirmation modal
- [ ] Deleted message placeholder: "This message was deleted"
- [ ] Actions logged in audit trail
- [ ] Changes broadcast via WebSocket
- [ ] Keyboard shortcut: Ctrl+Enter to save
- [ ] Undo button (optional, Phase 2)
- [ ] Unit tests cover edit/delete flows
- [ ] E2E test verifies edit persistence

**Implementation Notes:**
- Edit mode: TanStack Query mutation
- Optimistic update: show edited text immediately, rollback on error
- Confirmation modal for delete (prevent accidents)
- API endpoint: PUT /api/conversations/:id/messages/:messageId

---

#### Task FE-006-T03: System Events in Timeline
**Complexity:** Medium (8-10 hours)  
**Dependency:** FE-006-T01  
**Description:**  
Display system events inline in timeline: assignment changes, tag additions, status changes, note creations.

**Acceptance Criteria:**
- [ ] Assignment event: "John assigned Alice to this conversation"
- [ ] Tag event: "Alice added tag 'Urgent'"
- [ ] Status event: "Status changed from Open to Pending"
- [ ] Note event: "Alice added a note" + note preview
- [ ] Events styled consistently with messages
- [ ] Timestamp visible
- [ ] User info (avatar, name) visible
- [ ] No messages/events missing
- [ ] Events persist across refresh
- [ ] Real-time updates via WebSocket
- [ ] Unit tests cover event display
- [ ] E2E test verifies event visibility

**Implementation Notes:**
- System events fetched with message timeline (same API)
- Event types: from API enum (conversation.assigned, etc.)
- Style: lighter background, gray text, icon indicator
- Event preview: truncated (click for full view)

---

#### Task FE-006-T04: Attachment Preview & Download
**Complexity:** Large (10-12 hours)  
**Dependency:** FE-006-T01  
**Description:**  
Display attachments inline in timeline. Show image thumbnails, PDF embeds, file icons. Implement download functionality.

**Acceptance Criteria:**
- [ ] Images display as thumbnails (150x150px)
- [ ] Click thumbnail opens lightbox (full-size)
- [ ] PDF shows embed (if supported) or download link
- [ ] Document files show icon + name + size
- [ ] Download link opens file in new tab or downloads
- [ ] File info visible: name, size, upload time
- [ ] Unsupported file types show generic file icon
- [ ] No loading delay (R2 cached)
- [ ] Mobile-friendly (responsive)
- [ ] Lightbox works on mobile (swipe, zoom)
- [ ] Accessibility (alt text, keyboard nav)
- [ ] Unit tests cover image/file handling
- [ ] E2E test verifies download functionality

**Implementation Notes:**
- Use PhotoSwipe or similar for lightbox
- Image URLs from R2 (already cached)
- MIME type determines display (image/* → thumbnail, etc.)
- Download: `<a href={url} download>` or fetch + blob
- Alt text from attachment metadata or filename

---

#### Task FE-006-T05: Unread Marker & Status
**Complexity:** Small (4-6 hours)  
**Dependency:** FE-006-T01  
**Description:**  
Add visual unread marker in timeline. Show "Unread messages below this point" between read and unread messages.

**Acceptance Criteria:**
- [ ] Unread marker visible between read/unread messages
- [ ] Marker shows "X unread messages"
- [ ] Marker updates when conversation opened
- [ ] First unread message highlighted (subtle)
- [ ] Auto-scroll to unread marker on open
- [ ] Marker disappears when all read
- [ ] Unit tests cover marker positioning
- [ ] E2E test verifies marker placement

**Implementation Notes:**
- Track `lastReadAt` in conversation cache
- Filter messages: before lastReadAt = read, after = unread
- Marker component: divider with text + icon
- Position: between lastMessage with timestamp ≤ lastReadAt and next message

---

#### Task FE-006-T06: Message Search Within Conversation
**Complexity:** Medium (8-10 hours)  
**Dependency:** FE-006-T01, FE-004  
**Description:**  
Search message bodies within conversation. Highlight results, navigate between matches.

**Acceptance Criteria:**
- [ ] Search box visible in conversation header
- [ ] Search queries message body + sender name (on server)
- [ ] Results highlighted in timeline (yellow background)
- [ ] Result count shown ("3 results")
- [ ] Previous/next buttons to navigate results
- [ ] Clear button to reset search
- [ ] Response time <500ms
- [ ] Empty search returns full timeline
- [ ] Mobile-friendly (hidden on small screens or search input style)
- [ ] Case-insensitive search
- [ ] Unit tests cover search flow
- [ ] E2E test verifies highlighting

**Implementation Notes:**
- Search endpoint: GET /api/conversations/:id/messages/search?q=query
- Highlight using `<mark>` tag (Tailwind: highlight color)
- Navigation: scroll to result + focus
- Debounce search input (300ms)

---

### Phase 2: Interactions & Rich Text (Tasks 7-12)

#### Task FE-006-T07: Inline Emoji Reactions
**Complexity:** Large (10-12 hours)  
**Dependency:** FE-006-T01, FE-005  
**Description:**  
Add emoji reaction picker to messages. Allow users to react with emojis, show reaction counts.

**Acceptance Criteria:**
- [ ] Hover message reveals reaction picker button
- [ ] Click picker opens emoji picker
- [ ] Select emoji adds reaction to message
- [ ] Reaction shown as pill: emoji + count (e.g., 👍 3)
- [ ] Click pill shows who reacted
- [ ] Click own reaction again removes it
- [ ] Max 10 different reactions per message
- [ ] Real-time updates via WebSocket
- [ ] Reactions sync across tabs
- [ ] Mobile: long-press → reaction picker
- [ ] Accessibility (ARIA labels, keyboard nav)
- [ ] Unit tests cover reaction flows
- [ ] E2E test verifies add/remove reactions

**Implementation Notes:**
- Reaction data: Record<emoji, userId[]>
- Picker: emoji-picker-element or native emoji input
- Max reactions: enforce on client + server
- WebSocket events: reaction.added, reaction.removed
- Storage: PostgreSQL JSON column or separate table

---

#### Task FE-006-T08: @Mention Autocomplete
**Complexity:** Large (12-14 hours)  
**Dependency:** FE-006-T10 (Rich Text Editor)  
**Description:**  
Implement @mention autocomplete in rich text editor. Trigger on @ key, show user suggestions.

**Acceptance Criteria:**
- [ ] Type @ in editor triggers autocomplete
- [ ] Dropdown shows matching users (filtered)
- [ ] Search users by name/email
- [ ] Click user inserts @username mention
- [ ] Multiple @mentions in single message
- [ ] @mention formatted as highlighted link
- [ ] Mentioned users notified via WebSocket
- [ ] Mentions persist in message
- [ ] Autocomplete escapes HTML (no XSS)
- [ ] Arrow keys navigate suggestions
- [ ] Escape closes dropdown
- [ ] Keyboard shortcut: Ctrl+K to open mention list
- [ ] Mobile-friendly (scrollable dropdown)
- [ ] Unit tests cover autocomplete + insertion
- [ ] E2E test verifies mention notification

**Implementation Notes:**
- Autocomplete library: Downshift or react-autocomplete
- Trigger: detect @ character, run regex
- User list: GET /api/users (cached, debounced search)
- Mention format: `@username` (serialized in message body)
- Notification: parse message body for @mentions, create notification

---

#### Task FE-006-T09: Rich Text Editor with Markdown
**Complexity:** Large (14-16 hours)  
**Dependency:** FE-005  
**Description:**  
Build rich text editor supporting markdown syntax. Include formatting toolbar, preview mode, emoji picker, emoji picker.

**Acceptance Criteria:**
- [ ] Editor accepts plain text + markdown syntax
- [ ] Toolbar buttons: bold, italic, code, link, list
- [ ] Preview mode shows rendered markdown
- [ ] **bold** syntax works (Ctrl+B or ** **)
- [ ] _italic_ syntax works (Ctrl+I or _ _)
- [ ] `code` syntax works (backticks)
- [ ] ```code block``` syntax works (triple backticks)
- [ ] [link](url) syntax works
- [ ] - lists work (dash/asterisk)
- [ ] Emoji picker integrated
- [ ] Paste image uploads + embeds in message
- [ ] Character count visible (limit 4000)
- [ ] Draft auto-saved to localStorage
- [ ] Restore draft on page reload
- [ ] Mobile-friendly (touch-friendly toolbar)
- [ ] Accessibility (ARIA labels, keyboard shortcuts)
- [ ] Unit tests cover markdown parsing
- [ ] E2E test verifies draft save/restore

**Implementation Notes:**
- Editor library: Slate or ProseMirror (or simple textarea + regex)
- Markdown parser: remark + rehype
- HTML sanitizer: DOMPurify (prevent XSS)
- Draft storage: localStorage key `yacc:draft-{conversationId}`
- Auto-save: debounce after 1s inactivity
- Toolbar: DaisyUI buttons

---

#### Task FE-006-T10: Editor Toolbar & Formatting
**Complexity:** Medium (8-10 hours)  
**Dependency:** FE-006-T09  
**Description:**  
Build formatting toolbar for rich text editor. Implement formatting buttons with keyboard shortcuts.

**Acceptance Criteria:**
- [ ] Toolbar visible above editor
- [ ] Bold button (Ctrl+B): `**text**`
- [ ] Italic button (Ctrl+I): `_text_`
- [ ] Code button (Ctrl+`): `` `text` ``
- [ ] Link button: opens URL input modal
- [ ] List button: converts to bullet list
- [ ] Blockquote button: `> text`
- [ ] Heading button: `# text`
- [ ] Emoji picker button
- [ ] Preview toggle button
- [ ] Undo/redo buttons
- [ ] Clear formatting button
- [ ] Character counter
- [ ] All keyboard shortcuts documented
- [ ] Mobile-friendly (icon buttons, no hover)
- [ ] Accessibility (ARIA labels, keyboard nav)
- [ ] Unit tests cover all buttons
- [ ] E2E test verifies formatting

**Implementation Notes:**
- Toolbar: DaisyUI button group
- Button icons: Tailwind icons or heroicons
- Shortcuts: Keyboard event listeners
- Link modal: simple input with validation
- Preview: toggle between edit/render modes

---

#### Task FE-006-T11: Markdown Preview Mode
**Complexity:** Medium (8-10 hours)  
**Dependency:** FE-006-T09  
**Description:**  
Implement side-by-side preview of rendered markdown while editing.

**Acceptance Criteria:**
- [ ] Toggle button to show/hide preview
- [ ] Preview shows rendered markdown
- [ ] Side-by-side layout (edit left, preview right)
- [ ] Preview updates in real-time (debounced)
- [ ] HTML sanitized (DOMPurify)
- [ ] Code blocks formatted with syntax highlighting (optional)
- [ ] Links clickable in preview
- [ ] Images render in preview
- [ ] Responsive: stacked on mobile
- [ ] No performance impact
- [ ] Unit tests cover rendering
- [ ] E2E test verifies preview accuracy

**Implementation Notes:**
- Render library: remark + rehype
- Sanitizer: DOMPurify
- Debounce preview updates (300ms)
- Syntax highlighting: highlight.js (optional)
- CSS classes: Tailwind prose styles

---

#### Task FE-006-T12: Emoji Picker Integration
**Complexity:** Small (6-8 hours)  
**Dependency:** FE-006-T09, FE-006-T07  
**Description:**  
Integrate emoji picker into rich text editor and reaction button.

**Acceptance Criteria:**
- [ ] Emoji picker button in toolbar
- [ ] Click opens native emoji picker
- [ ] Select emoji inserts at cursor
- [ ] Emoji picker also for reactions (FE-006-T07)
- [ ] Recent emojis tracked (localStorage)
- [ ] Search emoji by name (optional)
- [ ] Mobile-friendly
- [ ] Accessible (keyboard nav)
- [ ] No performance impact
- [ ] Unit tests cover insertion
- [ ] E2E test verifies emoji insertion

**Implementation Notes:**
- Library: emoji-picker-element or native input
- Insertion: at cursor position in editor
- Recent emojis: store in Zustand
- Keyboard: type search query, arrows to select

---

### Phase 3: Collaboration & Advanced (Tasks 13-18)

#### Task FE-006-T13: Tags Panel
**Complexity:** Medium (8-10 hours)  
**Dependency:** FE-004  
**Description:**  
Build tags panel in right sidebar. Display existing tags, add/remove tags, create new tags inline.

**Acceptance Criteria:**
- [ ] Tags panel visible in right sidebar
- [ ] Show all tags applied to conversation
- [ ] Add tag: click + search existing tags
- [ ] Create new tag inline (if not found)
- [ ] Remove tag with X button
- [ ] Tag colors visible
- [ ] Max 10 tags per conversation
- [ ] Tags filterable in inbox (from FE-004)
- [ ] Changes persist (API call)
- [ ] Real-time updates via WebSocket
- [ ] Accessible (ARIA labels, keyboard nav)
- [ ] Unit tests cover tag operations
- [ ] E2E test verifies add/remove

**Implementation Notes:**
- Tag list: GET /api/tags (cached in TanStack Query)
- Add tag: POST /api/conversations/:id/tags
- Remove tag: DELETE /api/conversations/:id/tags/:tagId
- Create tag: POST /api/tags (inline in dropdown)

---

#### Task FE-006-T14: Notes Panel & Persistence
**Complexity:** Medium (10-12 hours)  
**Dependency:** FE-004  
**Description:**  
Build notes panel in right sidebar. Create, display, and manage internal notes with @mention support.

**Acceptance Criteria:**
- [ ] Notes panel visible in right sidebar
- [ ] Show all notes for conversation
- [ ] Add note button opens editor
- [ ] Notes display author, timestamp, content
- [ ] Edit own notes (click to edit)
- [ ] Delete own notes (confirmation modal)
- [ ] @mention support in notes
- [ ] Mentioned users notified
- [ ] Notes styled like comments
- [ ] Notes persist (API)
- [ ] Real-time updates via WebSocket
- [ ] Notes visible in timeline as system events
- [ ] Max note length: 2000 characters
- [ ] Accessible (ARIA labels, keyboard nav)
- [ ] Unit tests cover note operations
- [ ] E2E test verifies add/delete

**Implementation Notes:**
- Note storage: DB table `notes`
- Add note: POST /api/conversations/:id/notes
- Edit note: PUT /api/conversations/:id/notes/:noteId
- Delete note: DELETE /api/conversations/:id/notes/:noteId
- Timeline event: note.created (shows note preview)

---

#### Task FE-006-T15: Conversation Status Controls
**Complexity:** Small (4-6 hours)  
**Dependency:** FE-004  
**Description:**  
Add status and priority controls in right panel. Allow changing conversation status (open/pending/resolved) and priority (low/normal/high/urgent).

**Acceptance Criteria:**
- [ ] Status dropdown: open, pending, resolved
- [ ] Priority dropdown: low, normal, high, urgent
- [ ] Current status/priority visible
- [ ] Change triggers API call + update
- [ ] Real-time updates via WebSocket
- [ ] Status change logged in audit trail
- [ ] Changes reflected in inbox (sorting, filtering)
- [ ] Accessible (ARIA labels, keyboard nav)
- [ ] Unit tests cover state changes
- [ ] E2E test verifies status update

**Implementation Notes:**
- Status: enum (open, pending, resolved)
- Priority: enum (low, normal, high, urgent)
- Update: PATCH /api/conversations/:id (status, priority fields)
- Styling: DaisyUI dropdown components

---

#### Task FE-006-T16: Assignment Panel
**Complexity:** Small (4-6 hours)  
**Dependency:** FE-004  
**Description:**  
Add assignment controls in right panel. Show current assignee, allow reassignment.

**Acceptance Criteria:**
- [ ] Current assignee visible with avatar
- [ ] Click to open assignee selector
- [ ] User list shows all active users
- [ ] Search users by name/email
- [ ] Assign/reassign user
- [ ] Unassign (clear assignee)
- [ ] Notification sent to new assignee
- [ ] Real-time updates via WebSocket
- [ ] Assignment logged in audit trail
- [ ] Accessible (ARIA labels, keyboard nav)
- [ ] Unit tests cover assignment
- [ ] E2E test verifies reassignment

**Implementation Notes:**
- User list: GET /api/users (cached)
- Assign: PATCH /api/conversations/:id (assignedUserId)
- Notification: system event + notification entry

---

#### Task FE-006-T17: Conversation Export (PDF/CSV/JSON)
**Complexity:** Large (12-14 hours)  
**Dependency:** FE-006-T01  
**Description:**  
Export conversation as PDF, CSV, or JSON. Generate formatted file with all messages, metadata.

**Acceptance Criteria:**
- [ ] Export button in conversation header
- [ ] Export options: PDF, CSV, JSON
- [ ] PDF: formatted timeline (messages, timestamps, sender)
- [ ] CSV: structured table (Date, Sender, Message, Type)
- [ ] JSON: raw message objects + conversation metadata
- [ ] File naming: `conversation-{id}-{date}.{ext}`
- [ ] Large exports (1000+) handled async (background job)
- [ ] Progress bar shown during generation
- [ ] Download link generated after completion
- [ ] Error handling (retry on failure)
- [ ] No PII exported (optional, redact emails)
- [ ] File size reasonable (<10MB for 1000 messages)
- [ ] Unit tests cover export formatting
- [ ] E2E test verifies export generation

**Implementation Notes:**
- Export endpoint: POST /api/conversations/:id/export?format=pdf|csv|json
- PDF: use html2pdf or similar (client-side for speed)
- CSV: use papaparse or similar
- JSON: simple JSON.stringify(messages)
- Async: server job, poll status endpoint
- Store export files on R2 temporarily

---

#### Task FE-006-T18: Export Modal & Download
**Complexity:** Medium (8-10 hours)  
**Dependency:** FE-006-T17  
**Description:**  
Build export modal UI. Allow format selection, show progress, provide download link.

**Acceptance Criteria:**
- [ ] Export button opens modal dialog
- [ ] Format selector: radio buttons (PDF, CSV, JSON)
- [ ] Download button triggers export
- [ ] Progress bar shows during generation
- [ ] "Generating..." message
- [ ] Error message if export fails
- [ ] Retry button on failure
- [ ] Download link appears on completion
- [ ] Close button dismisses modal
- [ ] Keyboard accessible (Escape to close)
- [ ] Mobile-friendly
- [ ] Unit tests cover modal states
- [ ] E2E test verifies export flow

**Implementation Notes:**
- Modal: DaisyUI modal component
- Radio buttons: HTML input[type=radio]
- Progress: simple percentage (0-100%)
- Download: window.open(url) or fetch + download

---

### Phase 4: Advanced Features & Testing (Tasks 19-22)

#### Task FE-006-T19: Virtual Scrolling for Performance
**Complexity:** Large (10-12 hours)  
**Dependency:** FE-006-T01  
**Description:**  
Implement virtual scrolling (react-window) for timeline with 1000+ messages. Ensure smooth scrolling without memory leaks.

**Acceptance Criteria:**
- [ ] Virtual scrolling implemented (react-window)
- [ ] Timeline renders 100+ messages smoothly
- [ ] Scroll performance: 60 FPS minimum
- [ ] Memory usage reasonable (<150MB)
- [ ] Dynamic row height calculation
- [ ] Scroll to bottom on new message
- [ ] Scroll to unread on open
- [ ] Bidirectional scroll (load older up, newer down)
- [ ] No layout shift during scroll
- [ ] Keyboard navigation (PageUp/PageDown)
- [ ] No memory leaks on component unmount
- [ ] Unit tests cover virtualization
- [ ] Performance test: render 1000 messages <2s

**Implementation Notes:**
- Library: react-window (FixedSizeList or VariableSizeList)
- Row height: estimate or measure dynamically
- Buffer size: render 20 extra rows above/below viewport
- Scroll-to: use scrollToItem() method
- Test: Profiler API to measure renders

---

#### Task FE-006-T20: Markdown & HTML Sanitization
**Complexity:** Medium (8-10 hours)  
**Dependency:** FE-006-T09  
**Description:**  
Ensure markdown rendering is safe. Sanitize HTML output to prevent XSS attacks.

**Acceptance Criteria:**
- [ ] HTML sanitizer integrated (DOMPurify)
- [ ] No script tags in output
- [ ] No onclick handlers preserved
- [ ] URL validation (prevent javascript: URLs)
- [ ] Markdown links validated
- [ ] Images validated (no malicious src)
- [ ] All user input escaped
- [ ] No HTML entities unescaped
- [ ] Security test: attempts XSS injection (blocked)
- [ ] Unit tests cover sanitization
- [ ] E2E test verifies XSS protection

**Implementation Notes:**
- Sanitizer: DOMPurify library
- Config: allow safe tags only (p, div, strong, em, code, a, img, etc.)
- URL validation: whitelist protocols (http, https, mailto)
- Testing: OWASP XSS payloads

---

#### Task FE-006-T21: Accessibility (WCAG 2.1 AA)
**Complexity:** Medium (10-12 hours)  
**Dependency:** All T01-T20  
**Description:**  
Audit and improve accessibility. Ensure all components meet WCAG 2.1 AA standards.

**Acceptance Criteria:**
- [ ] ARIA labels on all interactive elements
- [ ] ARIA live regions for dynamic content (messages, reactions)
- [ ] Keyboard navigation for all UI (Tab, Arrow keys, Enter)
- [ ] Color contrast ≥4.5:1 (AA standard)
- [ ] Focus indicators visible (outline)
- [ ] Screen reader tested (NVDA, JAWS)
- [ ] No keyboard traps
- [ ] Semantic HTML (proper heading hierarchy, lists, etc.)
- [ ] Form labels associated with inputs
- [ ] Error messages linked to inputs
- [ ] Skip links for navigation
- [ ] Lighthouse a11y score ≥95
- [ ] Unit tests cover a11y (axe-core)
- [ ] E2E tests check keyboard navigation

**Implementation Notes:**
- Audit with axe DevTools or Lighthouse
- ARIA roles: main, article, button, link, etc.
- Live regions: aria-live=polite for notifications
- Focus management: focus() on modal open
- Keyboard: Tab, Enter, Space, Arrow keys, Escape
- Testing: axe-core Vitest plugin

---

#### Task FE-006-T22: Comprehensive Testing & Optimization
**Complexity:** Large (14-16 hours)  
**Dependency:** All T01-T21  
**Description:**  
Write unit and E2E tests for all timeline features. Benchmark performance. Optimize bundle size.

**Acceptance Criteria:**
- [ ] Unit tests for all components (≥80% coverage)
- [ ] Unit tests for markdown parsing + sanitization
- [ ] Unit tests for virtual scrolling
- [ ] Integration tests for message edit/delete flow
- [ ] E2E test: view 100+ message timeline
- [ ] E2E test: search conversation
- [ ] E2E test: edit + delete message
- [ ] E2E test: add emoji reaction
- [ ] E2E test: @mention user
- [ ] E2E test: export conversation (PDF/CSV)
- [ ] Performance test: timeline render <2s
- [ ] Performance test: scroll ≥60 FPS
- [ ] Performance test: memory <150MB
- [ ] Bundle size <100KB (gzipped)
- [ ] Lighthouse scores: >85 (all categories)
- [ ] All tests passing
- [ ] No console errors

**Implementation Notes:**
- Test framework: Vitest + Playwright
- Mock markdown parser if slow
- Mock expensive operations (export)
- Performance: React DevTools Profiler
- Bundle: webpack-bundle-analyzer

---

## 5. Testing Requirements

### 5.1 Test Strategy

**Test Pyramid:**
- **Unit Tests:** 60% (components, utilities, stores)
- **Integration Tests:** 25% (component interactions, API calls)
- **E2E Tests:** 15% (user workflows, real-time events)

**Test Coverage Targets:**
- Components: ≥80%
- Utilities: ≥90%
- Stores: ≥90%
- Overall: ≥80%

### 5.2 Test Scenarios

**Timeline Display:**
- Render 100+ messages without jank
- Messages ordered correctly (chronological)
- Sender grouping correct (same sender, <5 min apart)
- Unread marker positioned correctly
- Auto-scroll to newest on open
- Pagination loads older messages on scroll

**Message Operations:**
- Edit message: text changes, label appears
- Delete message: placeholder shown, no other change
- Failed edit shows error + retry button
- Concurrent edits handled correctly (last write wins)

**Reactions:**
- Add reaction: appears immediately (optimistic)
- Multiple reactions per message
- Click own reaction removes it
- Real-time updates from other users
- Reaction counts accurate

**@Mentions:**
- Mention autocomplete triggers on @
- Dropdown filtered by name/email
- Insert mention: formats correctly
- Mentioned user notified within 500ms

**Rich Text:**
- Markdown syntax parsed correctly
- Bold, italic, code rendered
- Links valid + clickable
- XSS attempts blocked

**Export:**
- PDF generated + downloadable
- CSV structured correctly
- JSON valid + parseable
- File naming correct

### 5.3 Edge Cases to Test

1. **Empty Timeline**: Conversation with no messages
2. **Very Long Message**: 4000 characters
3. **Special Characters**: Emojis, unicode, symbols
4. **Network Errors**: Export fails mid-process
5. **Concurrent Operations**: Edit + delete same message
6. **Large Timeline**: 1000+ messages + scroll to bottom
7. **Deleted User**: User who sent message is deleted
8. **XSS Injection**: Malicious HTML in markdown

### 5.4 Performance Benchmarks

| Benchmark | Target | Measurement |
|-----------|--------|-------------|
| **Timeline Render** | <2s | Time to render 100 messages |
| **Scroll Performance** | ≥60 FPS | Frame rate during scroll |
| **Message Edit** | <100ms | Time to show edit mode |
| **Emoji Reaction** | <200ms | Time to add reaction optimistically |
| **Search Response** | <500ms | Time to execute search + highlight |
| **Export Generation** | <5s | Time to generate PDF (100 msgs) |
| **Memory Usage** | <150MB | Heap size with 1000 messages |
| **Bundle Size** | <100KB | Code + dependencies (gzipped) |
| **Lighthouse Score** | >85 | All categories (performance, a11y, etc.) |

---

## 6. Documentation Needs

### 6.1 Architecture ADR

**ADR-010: Conversation Timeline & Rich Text Architecture**

Content:
- Decision: Use react-window for virtual scrolling
- Decision: Slate or ProseMirror for rich text editor
- Markdown strategy: remark + rehype + DOMPurify
- Virtual scrolling implementation details
- Performance optimization decisions

### 6.2 API Changes Documentation

**New Endpoints:**
- GET `/api/conversations/:id/messages` (paginated)
- PUT `/api/conversations/:id/messages/:messageId` (edit)
- DELETE `/api/conversations/:id/messages/:messageId` (delete)
- GET `/api/conversations/:id/messages/search?q=query` (search)
- POST `/api/conversations/:id/export?format=pdf|csv|json` (export)
- POST `/api/conversations/:id/messages/:messageId/reactions` (reactions)

**WebSocket Events:**
- `message.edited` - Message updated
- `message.deleted` - Message removed
- `reaction.added` - Emoji reaction added
- `reaction.removed` - Emoji reaction removed

### 6.3 User Guides

**Guide: Timeline View**
- How to read conversation timeline
- Message grouping explanation
- System events (assignments, tags)
- Unread indicator

**Guide: Rich Text Editing**
- Markdown syntax examples
- Toolbar buttons
- @mention usage
- Emoji picker

**Guide: Message Management**
- Edit message (time limit?)
- Delete message
- React with emoji
- Export conversation

### 6.4 Developer Guides

**Guide: Timeline Performance**
- Virtual scrolling implementation
- React.memo usage
- Cache invalidation
- Debugging performance issues

**Guide: Rich Text Editor**
- Markdown parsing
- HTML sanitization
- XSS prevention
- Testing markdown features

**Guide: Real-Time Updates**
- WebSocket event handlers
- Optimistic updates
- Rollback on error
- Testing async flows

---

## 7. Success Criteria

### 7.1 Functional Success

- ✅ Timeline displays messages chronologically (100+)
- ✅ Message edit/delete working correctly
- ✅ Emoji reactions add/remove correctly
- ✅ @mentions trigger autocomplete + notify
- ✅ Rich text editor supports markdown
- ✅ Attachments preview inline
- ✅ Search highlights results
- ✅ Export generates valid PDF/CSV/JSON
- ✅ Tags/notes manage correctly
- ✅ Status/priority controls work
- ✅ All edge cases handled gracefully

### 7.2 Non-Functional Success

- ✅ Code coverage ≥80%
- ✅ No TypeScript `any` types
- ✅ No console errors during normal operation
- ✅ Timeline scroll ≥60 FPS
- ✅ Memory usage <150MB
- ✅ Bundle size <100KB (gzipped)
- ✅ Lighthouse score >85
- ✅ WCAG 2.1 AA compliant
- ✅ All tests passing (unit + E2E)
- ✅ Zero security vulnerabilities

### 7.3 Quality Gates

**Before Merge to Dev:**
- [ ] All unit tests passing
- [ ] Code coverage ≥80%
- [ ] No TypeScript errors
- [ ] Linting passes
- [ ] No console errors

**Before Merge to Main:**
- [ ] All E2E tests passing
- [ ] Performance benchmarks met
- [ ] Manual QA sign-off
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Architecture review approved
- [ ] Documentation complete

---

## 8. Timeline & Milestones

### 8.1 Estimated Duration

| Phase | Tasks | Hours | Days |
|-------|-------|-------|------|
| **Phase 1: Timeline** | T01-T06 | 48-60 | 6-8 |
| **Phase 2: Interactions** | T07-T12 | 60-74 | 8-10 |
| **Phase 3: Collaboration** | T13-T18 | 54-68 | 7-9 |
| **Phase 4: Testing** | T19-T22 | 42-50 | 5-7 |
| **Total** | 22 tasks | 204-252 | 26-34 |

**Parallel Opportunities:**
- T07-T12 (can start after T01, some overlap)
- T13-T18 (can start after T04, mostly independent)
- T19-T22 (can start after T06, run parallel to T07-T18)

**Critical Path:** T01 → T02 → T04 → T17 → T22 (16-22 weeks minimum)

### 8.2 Weekly Milestones

**Week 1: Timeline Foundation**
- Complete T01-T03 (message display, edit/delete, system events)
- Target: Basic timeline working

**Week 2: Attachments & Search**
- Complete T04-T06 (attachments, unread marker, search)
- Target: Rich timeline with search

**Week 3: Interactions - Reactions & @Mentions**
- Complete T07-T08 (reactions, @mentions)
- Target: Interactive messages

**Week 4: Rich Text Editor**
- Complete T09-T12 (markdown editor, preview, toolbar, emoji)
- Target: Full rich text editing

**Week 5: Collaboration Features**
- Complete T13-T18 (tags, notes, status, export)
- Target: Full collaboration suite

**Week 6: Performance & Testing**
- Complete T19-T22 (virtual scrolling, testing, optimization)
- Target: ≥80% coverage, ≥60 FPS

### 8.3 Blocking Dependencies

- ✅ FE-004 (API Integration) - COMPLETE
- ⏳ FE-005 (WebSocket/Real-Time) - In Progress
  - Needed for real-time message updates, reactions, @mentions
  - Can mock WebSocket events for testing

### 8.4 Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| **FE-005 Delayed** | Medium | Medium | Mock WebSocket events; integrate later |
| **Performance Issues (1000 msgs)** | Medium | High | Profile early; implement virtual scrolling immediately |
| **Memory Leaks** | Low | High | Use React DevTools Profiler regularly |
| **XSS from User Input** | Low | High | Use DOMPurify; security test early |
| **Bundle Size Bloat** | Medium | Medium | Monitor bundle size; tree-shake unused code |
| **Accessibility Overlooked** | Low | Medium | Audit early; use axe-core testing |

---

## 9. Acceptance Sign-Off

**Product Owner Review:** ⏳ Pending  
**Architect Review:** ⏳ Pending  
**Designer Review:** ⏳ Pending  
**Team Lead Approval:** ⏳ Pending  

**Ready to Start:** Once FE-004 merges to dev, FE-005 reaches T05, and this todo list is approved.

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-26  
**Created By:** Product Owner  
**Status:** READY FOR IMPLEMENTATION
