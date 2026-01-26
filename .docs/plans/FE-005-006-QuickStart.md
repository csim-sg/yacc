# FE-005 & FE-006 Quick Start Guide

**Last Updated:** 2026-01-26  
**For:** Frontend Developers  
**Time to Read:** 5-10 minutes

---

## 🚀 Start Here

### Step 1: Understand the Big Picture (5 min)

Read **FE-005-006-Summary.md** for:
- What you're building (2 features with 42 tasks)
- Timeline (6-8 weeks with parallelization)
- Key design decisions
- Dependencies + blockers

### Step 2: Choose Your Path (1 min)

**If starting FE-005 (WebSocket/Real-Time):**
→ Go to "FE-005 Developer Checklist" below

**If starting FE-006 (Timeline & Advanced):**
→ Go to "FE-006 Developer Checklist" below

**If working on both:**
→ Start FE-005 Phase 1 first, then FE-006 Phase 1 in parallel

---

## 📝 FE-005 Developer Checklist

### Pre-Implementation (Do This First)

- [ ] Read FE-005-WebSocket-RealTime-TodoList.md (section 1-3)
- [ ] Review Architecture diagrams (section 3)
- [ ] Read integration guide: FE-005-006-Integration-Guide.md (section 1-4)
- [ ] Set up mock Socket.io server
- [ ] Create feature branch: `feature/fe-005-websocket`

### Phase 1 Tasks (Start Here)

#### T01: WebSocket Client Initialization (6-8h)
```bash
# Acceptance Criteria Checklist:
- [ ] Socket.io client initialized with JWT auth
- [ ] Error handlers registered (connect_error, disconnect)
- [ ] Heartbeat working (60s ping/pong)
- [ ] Reconnection logic with exponential backoff
- [ ] Connection state in Zustand store
- [ ] TypeScript types for all WebSocket events
- [ ] Unit tests (80%+ coverage)
- [ ] E2E test verifies connection
```

**Resources:**
- API contract: `.docs/02-api-and-data-model.md` (Section 6: WebSocket Events)
- Code patterns: `.docs/03-implementation-guide.md` (Section 3.5)

#### T02: Zustand WebSocket Store (6-8h)
```bash
# Acceptance Criteria Checklist:
- [ ] useWebSocketStore() hook exported
- [ ] State: connected, connecting, disconnected, lastConnectTime
- [ ] Subscribed conversations tracked (Set<string>)
- [ ] Typing state per conversation
- [ ] Presence per user
- [ ] localStorage persistence
- [ ] All mutations tested
- [ ] No memory leaks
```

#### T03: WebSocket Event Listeners (10-12h)
```bash
# Acceptance Criteria Checklist:
- [ ] Listener for conversation.updated
- [ ] Listener for message.sent / message.failed
- [ ] Listener for typing.started / typing.stopped
- [ ] Listener for presence.updated
- [ ] Listener for notification.received
- [ ] Listener for conversation.reopened
- [ ] Event deduplication implemented
- [ ] TanStack Query cache invalidated
- [ ] Error handling for malformed events
- [ ] Unit + E2E tests pass
```

#### T04: Real-Time Conversation Cache (12-14h)
```bash
# Acceptance Criteria Checklist:
- [ ] Conversation list updates via WebSocket
- [ ] Conversation details update when opened
- [ ] Message timeline appends new messages
- [ ] Conversation sort order preserved
- [ ] Unread count updated correctly
- [ ] Filter state persisted
- [ ] No race conditions
- [ ] Optimistic updates for user actions
- [ ] Rollback on error
- [ ] E2E test: verify <500ms latency
```

#### T05: Typing Indicators (8-10h)
```bash
# Acceptance Criteria Checklist:
- [ ] Component <TypingIndicator /> renders
- [ ] Single user: "Alice is typing..."
- [ ] Two users: "Alice and Bob are typing..."
- [ ] Three+ users: "Alice, Bob and 2 others..."
- [ ] Animated dots/pulse
- [ ] Disappears after 5s inactivity
- [ ] Max 3 users shown explicitly
- [ ] Accessible (ARIA labels)
- [ ] No layout shift
- [ ] Unit + E2E tests
```

### After Phase 1 Complete

- [ ] All Phase 1 tests passing (≥85% coverage)
- [ ] Code review approved
- [ ] Merge to dev branch
- [ ] Update `.docs/plans/00-INDEX.md` with completion status

**Next:** Proceed to Phase 2 (Offline Mode)

---

## 📝 FE-006 Developer Checklist

### Pre-Implementation (Do This First)

- [ ] Read FE-006-ConversationTimeline-TodoList.md (section 1-3)
- [ ] Review Architecture diagrams & component hierarchy (section 3)
- [ ] Read integration guide: FE-005-006-Integration-Guide.md (section 1-4)
- [ ] **WAIT FOR:** FE-005-T05 complete (Typing indicators)
- [ ] Create feature branch: `feature/fe-006-timeline`

### Phase 1 Tasks (Start Here)

#### T01: Timeline Message Display (12-14h)
```bash
# Acceptance Criteria Checklist:
- [ ] Messages displayed oldest first
- [ ] Message grouping: same sender within 5 min
- [ ] Sender avatar, name, timestamp visible
- [ ] Message status visible (pending/sent/failed)
- [ ] Unread marker visible
- [ ] Auto-scroll to newest on open
- [ ] Pagination loads 50 at a time
- [ ] No duplicate messages
- [ ] 100+ messages without jank
- [ ] Mobile-responsive
- [ ] Accessible (ARIA labels)
- [ ] Unit + E2E tests
```

**Resources:**
- API: GET `/api/conversations/:id/messages`
- TanStack Query: `.docs/03-implementation-guide.md`

#### T02: Message Edit & Delete (10-12h)
```bash
# Acceptance Criteria Checklist:
- [ ] Edit button visible on own messages
- [ ] Delete button visible on own messages + admin
- [ ] Edit mode shows inline editor
- [ ] Original text in editor
- [ ] Save sends PUT request
- [ ] Cancel closes without saving
- [ ] "Edited" label appears with timestamp
- [ ] Delete shows confirmation modal
- [ ] Deleted message placeholder
- [ ] Actions logged in audit trail
- [ ] WebSocket broadcasts changes
- [ ] Unit + E2E tests
```

#### T03: System Events in Timeline (8-10h)
```bash
# Acceptance Criteria Checklist:
- [ ] Assignment event displayed
- [ ] Tag addition event displayed
- [ ] Status change event displayed
- [ ] Note creation event displayed
- [ ] All events styled consistently
- [ ] Timestamp visible
- [ ] User info (avatar, name) visible
- [ ] No events missing
- [ ] Persist across refresh
- [ ] Real-time updates via WebSocket
- [ ] Unit + E2E tests
```

#### T04: Attachment Preview & Download (10-12h)
```bash
# Acceptance Criteria Checklist:
- [ ] Images display as thumbnails (150x150px)
- [ ] Click thumbnail opens lightbox
- [ ] PDF shows embed or download
- [ ] Documents show icon + name + size
- [ ] Download link opens in new tab
- [ ] File info visible
- [ ] Unsupported types show generic icon
- [ ] No loading delay (cached on R2)
- [ ] Mobile-friendly
- [ ] Lightbox works on mobile
- [ ] Accessibility (alt text)
- [ ] Unit + E2E tests
```

#### T05: Unread Marker & Status (4-6h)
```bash
# Acceptance Criteria Checklist:
- [ ] Unread marker visible
- [ ] Shows "X unread messages"
- [ ] Updates when conversation opened
- [ ] First unread highlighted
- [ ] Auto-scroll to unread on open
- [ ] Disappears when all read
- [ ] Unit + E2E tests
```

#### T06: Message Search (8-10h)
```bash
# Acceptance Criteria Checklist:
- [ ] Search box visible in header
- [ ] Searches message body + sender name
- [ ] Results highlighted in timeline
- [ ] Result count shown
- [ ] Previous/next navigation
- [ ] Clear button resets
- [ ] <500ms response time
- [ ] Case-insensitive
- [ ] Mobile-friendly
- [ ] Unit + E2E tests
```

### After Phase 1 Complete

- [ ] All Phase 1 tests passing (≥80% coverage)
- [ ] Code review approved
- [ ] Merge to dev branch
- [ ] Basic timeline working

**Next:** Proceed to Phase 2 (Interactions)

---

## 🧪 Testing Essentials

### Unit Tests

```bash
# Required coverage per task
- Components: ≥80%
- Stores: ≥90%
- Utilities: ≥85%
- Hooks: ≥90%

# Run tests
pnpm --filter @yacc/frontend test

# Check coverage
pnpm --filter @yacc/frontend test -- --coverage
```

### E2E Tests (Playwright)

```bash
# Start dev servers
pnpm dev

# Run E2E tests
pnpm --filter @yacc/frontend test:e2e

# Debug single test
pnpm --filter @yacc/frontend test:e2e -- timeline.spec.ts --debug
```

### Mock Setup

```typescript
// Mock Socket.io for unit tests
import { mockSocket } from '@/__mocks__/socket.io-client';

test('listens to message.sent event', () => {
  mockSocket.emit('message.sent', {
    conversationId: '123',
    messageId: 'msg-1',
    status: 'sent'
  });
  
  expect(store.messages[0].status).toBe('sent');
});

// Mock TanStack Query
import { QueryClient } from '@tanstack/react-query';
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
});
```

---

## 🔍 Common Patterns

### Using WebSocket in Components (FE-006)

```typescript
import { useWebSocketStatus } from '@/hooks/useWebSocket';
import { useTyping } from '@/hooks/useTyping';
import { useUserPresence } from '@/hooks/usePresence';

export function ConversationHeader({ conversationId }) {
  const { connected } = useWebSocketStatus();
  const { typingUsers } = useTyping(conversationId);
  const { status: presenceStatus } = useUserPresence(conversationId);
  
  return (
    <div>
      {!connected && <ReconnectingUI />}
      {typingUsers.length > 0 && <TypingIndicator users={typingUsers} />}
      {conversationParticipants.map(user => (
        <PresenceIndicator key={user.id} userId={user.id} />
      ))}
    </div>
  );
}
```

### Optimistic Updates

```typescript
const mutation = useMutation({
  mutationFn: (data) => api.post('/endpoint', data),
  onMutate: async (data) => {
    // Cancel ongoing queries
    await queryClient.cancelQueries({ queryKey: ['messages'] });
    
    // Save old data
    const old = queryClient.getQueryData(['messages']);
    
    // Update optimistically
    queryClient.setQueryData(['messages'], (prev) => [
      ...prev,
      { id: tempId, ...data, status: 'pending' }
    ]);
    
    return old;
  },
  onError: (err, data, context) => {
    // Rollback on error
    queryClient.setQueryData(['messages'], context);
  }
});
```

### Real-Time Cache Update

```typescript
// In Socket.io listener
function handleMessageSent(event) {
  // Update TanStack Query cache
  queryClient.setQueryData(
    ['conversations', event.conversationId, 'messages'],
    (old) => {
      const messages = [...old];
      const index = messages.findIndex(m => m.id === event.messageId);
      if (index >= 0) {
        messages[index] = { ...messages[index], status: 'sent' };
      }
      return messages;
    }
  );
  
  // Also update Zustand store
  conversationCacheStore.updateMessage(event.messageId, {
    status: 'sent'
  });
}
```

---

## 📚 Key Documentation

| Document | What's Inside | When to Read |
|----------|---------------|--------------|
| **FE-005-WebSocket-RealTime-TodoList.md** | 20 tasks, acceptance criteria, test scenarios | Before starting FE-005 |
| **FE-006-ConversationTimeline-TodoList.md** | 22 tasks, acceptance criteria, test scenarios | Before starting FE-006 |
| **FE-005-006-Integration-Guide.md** | Data flows, shared components, testing examples | During implementation |
| **FE-005-006-Summary.md** | Executive summary, timeline, key decisions | Start here |
| **.docs/02-api-and-data-model.md** | API endpoints, WebSocket events, data models | When implementing API calls |
| **.docs/03-implementation-guide.md** | Architecture, code organization, best practices | Before writing code |

---

## 🚨 Common Pitfalls

### FE-005 Pitfalls

- ❌ Using `any` types for WebSocket events → ✅ Define all event types
- ❌ Memory leaks from WebSocket listeners → ✅ Cleanup in useEffect
- ❌ Race conditions with reconnection → ✅ Use event deduplication
- ❌ Offline queue doesn't persist → ✅ Use localStorage + Zustand persist
- ❌ Polling fallback not working → ✅ Test with network mocked offline

### FE-006 Pitfalls

- ❌ Timeline jank with 1000+ messages → ✅ Use virtual scrolling (react-window)
- ❌ XSS from markdown → ✅ Use DOMPurify sanitization
- ❌ Images don't load from R2 → ✅ Check CORS + CDN URL
- ❌ Edit mode loses focus → ✅ Use `autoFocus` + `useRef`
- ❌ Scroll position lost on update → ✅ Track scrollTop, restore after update

---

## ✅ Definition of Done (Per Task)

### Code Quality
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] No `any` types
- [ ] Passes linting (`npm run lint`)
- [ ] No console errors or warnings

### Testing
- [ ] Unit tests passing (≥80-90% coverage)
- [ ] E2E tests passing (relevant scenarios)
- [ ] Edge cases tested
- [ ] Error scenarios tested

### Performance
- [ ] Lighthouse score ≥85
- [ ] Performance benchmarks met
- [ ] No memory leaks (DevTools Profiler)
- [ ] Bundle size reasonable

### Documentation
- [ ] Acceptance criteria all checked
- [ ] Code comments for complex logic
- [ ] Type annotations complete
- [ ] README updated if needed

### Review & Merge
- [ ] Code review approved
- [ ] All CI checks passing
- [ ] No conflicts with main
- [ ] Merge to dev branch
- [ ] Update 00-INDEX.md with status

---

## 🔗 Helpful Commands

```bash
# Install dependencies
pnpm install

# Run dev server
pnpm dev

# Run tests (with watch mode)
pnpm --filter @yacc/frontend test -- --watch

# Check type errors
pnpm type-check

# Lint code
pnpm lint

# Build bundle
pnpm build

# View bundle size
pnpm analyze

# Run E2E tests
pnpm --filter @yacc/frontend test:e2e

# Debug E2E test
pnpm --filter @yacc/frontend test:e2e -- --debug

# Check code coverage
pnpm --filter @yacc/frontend test -- --coverage
```

---

## 📞 Getting Help

**Questions about requirements?**
- Check the detailed todo list (Section 1: Requirements)
- Ask Product Owner or check `.docs/01-product-specification.md`

**Questions about architecture?**
- Check integration guide (Section 3: Data Flows)
- Ask Architect or check `.docs/03-implementation-guide.md`

**Questions about test strategy?**
- Check todo list (Section 5: Testing Requirements)
- Check integration guide (Section 7: Testing Across Features)

**Questions about API?**
- Check `.docs/02-api-and-data-model.md`
- Check Postman collection or API sandbox
- Ask Backend Dev

**Stuck on a task?**
- Check acceptance criteria (testable requirements)
- Review code examples in integration guide
- Check existing code patterns in project
- Ask team lead or architect

---

## 🎉 Ready to Start?

1. ✅ Read FE-005-006-Summary.md
2. ✅ Choose FE-005 or FE-006 path
3. ✅ Read relevant detailed todo list
4. ✅ Read integration guide (understand data flows)
5. ✅ Set up mock server
6. ✅ Create feature branch
7. ✅ Start Task 1 of chosen feature
8. ✅ Follow acceptance criteria in todo list
9. ✅ Write tests as you code
10. ✅ Create PR + request review

**You've got this! 🚀**

---

**Last Updated:** 2026-01-26  
**Status:** READY FOR DEVELOPMENT
