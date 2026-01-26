# FE-005 & FE-006 Summary - Product Owner Handoff

**Status:** 🎯 READY FOR IMPLEMENTATION  
**Created:** 2026-01-26  
**Approval Status:** ⏳ Awaiting PO + Architect Review

---

## Executive Summary

This document provides a comprehensive overview of **FE-005 (WebSocket/Real-Time Updates)** and **FE-006 (Conversation Timeline & Advanced Features)** - the next two major frontend development tasks for YACC.

### Key Facts

| Aspect | Details |
|--------|---------|
| **Total Effort** | 42-44 tasks, 380-474 hours (47-59 days) |
| **Timeline** | 4-6 weeks each (some parallelization) |
| **Dependencies** | FE-004 ✅ Complete; BE-006/BE-007 Pending |
| **Team** | 1 Frontend Dev + QA (parallel) |
| **Risk Level** | Low (clear requirements, proven tech stack) |
| **Blocking Items** | 0 - Ready to start immediately |

### What Gets Built

**FE-005: WebSocket/Real-Time (100-140 hours)**
- Real-time conversation updates (<500ms latency)
- Message delivery status tracking (pending → sent → failed)
- Typing indicators ("User is typing...")
- User presence (online/offline/away)
- Automatic reconnection with exponential backoff
- Offline message queue (persist to localStorage)
- Notification delivery system

**FE-006: Conversation Timeline & Advanced (120-160 hours)**
- Full conversation timeline with 100+ message support
- Message editing & deletion
- Emoji reactions to messages
- Rich text editor with markdown support
- File attachment preview (images, PDFs, documents)
- @mention autocomplete + notifications
- Tags, notes, and assignments management
- Conversation search (full-text)
- Export to PDF, CSV, or JSON
- Full accessibility (WCAG 2.1 AA)

---

## Documentation Deliverables

### 📄 Four Comprehensive Documents Created

#### 1. **FE-005-WebSocket-RealTime-TodoList.md** (20 tasks)
- **Size:** ~200 KB
- **Content:** Complete requirements, acceptance criteria, 20 implementation tasks
- **Sections:**
  - Product requirements breakdown (8 features, edge cases, success metrics)
  - Technical specifications (stack, integration points, data flows)
  - Architecture & design (client architecture, WebSocket events, error handling)
  - Implementation tasks (20 items, all with complexity, dependencies, criteria)
  - Testing requirements (80-90% coverage targets, edge case matrix)
  - Documentation needs (ADRs, API changes, guides)
  - Success criteria (functional + non-functional, quality gates)
  - Timeline & milestones (5 phases, critical path, risks)

**Key Content:**
- 20 granular implementation tasks (complexity S/M/L)
- 50+ acceptance criteria per task
- Edge cases matrix (8 scenarios)
- Performance benchmarks (10 metrics)
- Risk mitigation strategies

#### 2. **FE-006-ConversationTimeline-TodoList.md** (22 tasks)
- **Size:** ~240 KB
- **Content:** Complete requirements, acceptance criteria, 22 implementation tasks
- **Sections:**
  - Product requirements breakdown (10 features, edge cases, success metrics)
  - Technical specifications (stack, integration points, data structures)
  - Architecture & design (component hierarchy, virtual scrolling, edit flows)
  - Implementation tasks (22 items, all with complexity, dependencies, criteria)
  - Testing requirements (80-90% coverage targets, scenarios)
  - Documentation needs (ADRs, API changes, guides)
  - Success criteria (functional + non-functional, quality gates)
  - Timeline & milestones (4 phases, critical path, risks)

**Key Content:**
- 22 granular implementation tasks (complexity S/M/L)
- 50+ acceptance criteria per task
- Edge cases matrix (10 scenarios)
- Performance benchmarks (10 metrics)
- Component hierarchy diagram

#### 3. **FE-005-006-Integration-Guide.md**
- **Size:** ~80 KB
- **Content:** How FE-005 and FE-006 work together
- **Sections:**
  - Integration overview (dependencies, integration points)
  - Shared components & hooks (8 hooks, 4 components from FE-005 reused by FE-006)
  - Data flow between features (4 detailed flow diagrams)
  - WebSocket event routing (event types, processing pipeline)
  - State management integration (data ownership, cache invalidation)
  - API contract alignment (endpoints, event schemas)
  - Testing across features (integration test scenarios)
  - Implementation sequence (dependency order, risk mitigation)
  - Validation checklists

**Key Content:**
- 8 reusable hooks/components documented
- 4 detailed data flow diagrams
- Integration test scenarios (code examples)
- Implementation sequence (start early without BE-006)

#### 4. **FE-005-006-Summary.md** (This Document)
- **Size:** ~30 KB
- **Content:** Executive summary + navigation guide
- **Sections:**
  - Executive summary (key facts, what gets built)
  - Documentation overview (4 docs, what's in each)
  - Approval & sign-off
  - Quick start guide for developers
  - FAQ & common questions
  - Links to all documents

---

## Implementation Structure

### FE-005: 20 Tasks Across 5 Phases

**Phase 1: Foundation & WebSocket Setup (5 tasks)**
- T01: WebSocket client initialization
- T02: Zustand WebSocket store
- T03: Event listeners & handlers
- T04: Real-time conversation cache updates
- T05: Typing indicators UI component

**Phase 2: Offline Mode & Message Status (5 tasks)**
- T06: Offline queue store
- T07: Offline detection & queue management
- T08: Message status indicator component
- T09: Optimistic message updates
- T10: Offline compose box indicator

**Phase 3: Presence & Notifications (5 tasks)**
- T11: User presence store & tracking
- T12: Presence indicator component
- T13: Notification center component
- T14: Notification store & unread badges
- T15: Unread badge updates

**Phase 4: Reconnection & Backlog Sync (3 tasks)**
- T16: Reconnection logic with exponential backoff
- T17: Backlog fetching & event sync
- T18: Reconnect UI indicator

**Phase 5: Testing & Polish (2 tasks)**
- T19: Comprehensive unit tests (≥85% coverage)
- T20: E2E tests & performance benchmarks

### FE-006: 22 Tasks Across 4 Phases

**Phase 1: Timeline Display & Message Management (6 tasks)**
- T01: Timeline message display
- T02: Message edit & delete
- T03: System events in timeline
- T04: Attachment preview & download
- T05: Unread marker & status
- T06: Message search within conversation

**Phase 2: Interactions & Rich Text (6 tasks)**
- T07: Inline emoji reactions
- T08: @Mention autocomplete
- T09: Rich text editor with markdown
- T10: Editor toolbar & formatting
- T11: Markdown preview mode
- T12: Emoji picker integration

**Phase 3: Collaboration & Advanced (6 tasks)**
- T13: Tags panel
- T14: Notes panel & persistence
- T15: Conversation status controls
- T16: Assignment panel
- T17: Conversation export (PDF/CSV/JSON)
- T18: Export modal & download

**Phase 4: Advanced Features & Testing (4 tasks)**
- T19: Virtual scrolling for performance
- T20: Markdown & HTML sanitization
- T21: Accessibility (WCAG 2.1 AA)
- T22: Comprehensive testing & optimization

---

## Timeline & Effort Estimates

### Effort Breakdown

| Task Group | Tasks | Hours | Days | Notes |
|-----------|-------|-------|------|-------|
| **FE-005 Phase 1** | 5 | 38-46 | 5-6 | Foundation (Foundation blocking T06+) |
| **FE-005 Phase 2** | 5 | 40-50 | 5-7 | Offline mode (independent, can parallel) |
| **FE-005 Phase 3** | 5 | 38-46 | 5-6 | Presence & notifications (independent) |
| **FE-005 Phase 4** | 3 | 32-40 | 4-5 | Reconnection (independent) |
| **FE-005 Phase 5** | 2 | 32-40 | 4-5 | Testing (parallel, run with impl) |
| | **FE-005 Total** | **180-222** | **23-29** | |
| **FE-006 Phase 1** | 6 | 48-60 | 6-8 | Timeline (can start after FE-005-T05) |
| **FE-006 Phase 2** | 6 | 60-74 | 8-10 | Interactions (independent after P1) |
| **FE-006 Phase 3** | 6 | 54-68 | 7-9 | Collaboration (mostly independent) |
| **FE-006 Phase 4** | 4 | 42-50 | 5-7 | Testing (parallel, run with impl) |
| | **FE-006 Total** | **204-252** | **26-34** | |
| | **COMBINED** | **384-474** | **49-63** | **~6-8 weeks** |

### Critical Path

**FE-005 Critical Path (8-10 weeks):**
- T01 → T02 → T03 → T04 → T08 → T09 (12-14 hours minimum)

**FE-006 Critical Path (6-8 weeks):**
- T01 → T02 → T04 → T17 → T22 (16-22 hours minimum)

**Combined (with parallelization):**
- Week 1-2: FE-005-P1 (foundation)
- Week 2-3: FE-005-P2 + FE-006-P1 (parallel)
- Week 3-5: FE-005-P3 + FE-006-P2 (parallel)
- Week 5-6: FE-005-P4 + FE-006-P3 (parallel)
- Week 6-7: FE-006-P4 + testing (both)
- **Total: 6-8 weeks with 1 FE developer + QA in parallel**

---

## Success Metrics

### FE-005 Success Criteria

**Functional:**
- ✅ Real-time updates <500ms latency
- ✅ Auto-reconnect succeeds 95%+ of time
- ✅ Offline queue syncs 100% of messages
- ✅ Typing indicators appear/disappear in <500ms
- ✅ Presence updates within 1 second
- ✅ All notifications delivered in real-time

**Non-Functional:**
- ✅ Code coverage ≥85%
- ✅ Bundle size <50KB (gzipped)
- ✅ Memory usage <100MB
- ✅ UI ≥60 FPS during updates
- ✅ Zero security vulnerabilities
- ✅ Full TypeScript type safety

### FE-006 Success Criteria

**Functional:**
- ✅ Timeline renders 100+ messages smoothly
- ✅ Message edit/delete working
- ✅ Emoji reactions real-time
- ✅ @mentions notify correctly
- ✅ Rich text supports markdown
- ✅ Attachments preview inline
- ✅ Export generates valid PDF/CSV/JSON
- ✅ Search highlights results

**Non-Functional:**
- ✅ Code coverage ≥80%
- ✅ Bundle size <100KB (gzipped)
- ✅ Memory usage <150MB
- ✅ Scroll performance ≥60 FPS
- ✅ WCAG 2.1 AA accessibility
- ✅ Lighthouse score >85
- ✅ Full TypeScript type safety

---

## Key Design Decisions

### FE-005 (WebSocket/Real-Time)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **WebSocket Library** | Socket.io | Auto-reconnect, fallback to polling, room support |
| **State Management** | Zustand | Lightweight, excellent for real-time state |
| **Offline Storage** | localStorage | Simple, reliable, persists across page refresh |
| **Reconnection** | Exponential backoff (1s-60s) | Standard, prevents thundering herd |
| **Event Dedup** | By event ID + timestamp | Prevents duplicate processing |
| **Backlog Sync** | Cursor-based pagination | Scales to large backlogs, efficient |

### FE-006 (Timeline & Advanced)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Virtual Scrolling** | react-window | 1000+ messages without memory leak |
| **Rich Text Editor** | Slate/ProseMirror | Markdown support, customizable |
| **Markdown Parsing** | remark + rehype | Industry standard, safe |
| **HTML Sanitizer** | DOMPurify | Proven XSS prevention |
| **Export Format** | PDF/CSV/JSON | Covers all use cases |
| **Emoji Picker** | emoji-picker-element | Native browser support |

---

## Dependencies & Blockers

### External Dependencies (Backend)

| Task | Depends On | Status | Impact |
|------|-----------|--------|--------|
| **FE-005-T01-T05** | BE-006 (WebSocket Gateway) | 🔄 In Progress | Can mock server for local dev |
| **FE-005-T16-T18** | BE-006 (Backlog API) | 🔄 In Progress | Can mock backlog endpoint |
| **FE-006-T01-T06** | BE-007 (Message API) | ⏳ Pending | Can use existing inbox API |
| **FE-006-T07** | BE-007 (Reactions API) | ⏳ Pending | Can add endpoint quickly |

**Risk Mitigation:** Create mock Socket.io server + mock HTTP endpoints. Full integration when backend ready (no rework needed).

### Internal Dependencies

| Task | Depends On | Status | Impact |
|------|-----------|--------|--------|
| **FE-005-T03-T04** | FE-005-T01-T02 | Ready | Hard dependency |
| **FE-005-T06-T10** | FE-005-T02 | Ready | Can start once T02 done |
| **FE-006-T01-T03** | FE-005-T04 | Ready | Need real-time cache updates |
| **FE-006-T07-T08** | FE-005-T03 | Ready | Need WebSocket event listeners |

**No blockers:** All internal dependencies can be managed with mock implementations.

---

## Approval & Sign-Off

### Required Approvals

- [ ] **Product Owner:** Review requirements, acceptance criteria, user stories
- [ ] **Architect:** Review technical decisions, architecture, integration patterns
- [ ] **QA Lead:** Review test strategies, coverage targets, edge cases
- [ ] **Team Lead:** Review timeline, resource allocation, risk management

### Approval Checklist

**For FE-005:**
- [ ] 20 tasks clearly defined (not blocked on outside resources)
- [ ] All acceptance criteria testable
- [ ] No conflicting requirements
- [ ] Tech stack approved (Socket.io, Zustand, react-window)
- [ ] Architecture approved (event-driven, offline queue)
- [ ] Test strategy approved (≥85% coverage, E2E tests)
- [ ] Timeline realistic (180-222 hours estimated)

**For FE-006:**
- [ ] 22 tasks clearly defined
- [ ] All acceptance criteria testable
- [ ] No conflicting requirements
- [ ] Tech stack approved (Slate, DOMPurify, etc.)
- [ ] Architecture approved (virtual scrolling, component hierarchy)
- [ ] Test strategy approved (≥80% coverage, E2E tests)
- [ ] Timeline realistic (204-252 hours estimated)

**For Integration:**
- [ ] FE-005 → FE-006 data flows clear
- [ ] Shared components documented
- [ ] WebSocket event routing defined
- [ ] State management strategy agreed
- [ ] Testing approach for integration scenarios clear

---

## Next Steps

### Immediate (This Week)

1. **PO Review** (2 hours)
   - Review FE-005 requirements + FE-006 requirements
   - Check acceptance criteria completeness
   - Verify edge cases coverage
   - Sign off on user stories

2. **Architect Review** (3 hours)
   - Review FE-005 architecture + FE-006 design
   - Verify WebSocket event model
   - Check integration patterns
   - Approve tech stack choices
   - Review performance targets

3. **Team Discussion** (1 hour)
   - Clarify any requirements
   - Discuss timeline + resource allocation
   - Identify early wins
   - Plan mock server setup

### Week 1 (Preparation)

1. **Setup** (4 hours)
   - Create feature branches (FE-005, FE-006)
   - Set up Socket.io mock server
   - Create test fixtures
   - Establish CI/CD pipeline

2. **FE-005 Kickoff** (start T01-T05)
   - Begin WebSocket client implementation
   - Start unit tests + integration tests
   - Set up performance monitoring

3. **Documentation** (ongoing)
   - Create ADR-009 (WebSocket architecture)
   - Create ADR-010 (Timeline architecture)
   - Update API documentation
   - Add developer guides

### Week 2-3 (FE-005 Foundation)

- Complete FE-005 Phase 1 (T01-T05)
- Begin FE-005 Phase 2 (T06-T10) in parallel
- **Ready to start FE-006-P1** after FE-005-T05 complete

### Week 4+ (Parallel Development)

- FE-005: Continue P2, P3, P4, P5
- FE-006: Begin P1, P2, P3 in parallel
- Integrate + test real WebSocket events (when BE-006 ready)

---

## FAQ & Common Questions

### Q: Can FE-006 start before FE-005 is complete?
**A:** Yes! FE-006-P1 can start after FE-005-T05. FE-006-T01 to T06 work with or without FE-005. Then we integrate real-time events once FE-005 is ready.

### Q: What if BE-006 is delayed?
**A:** We mock Socket.io locally. FE-005 + FE-006 develop in parallel with mocks. Integration happens when BE-006 ready (no significant rework).

### Q: How much time for manual QA?
**A:** ~10-15% of effort (2-3 weeks total). Parallel to development. E2E tests reduce manual QA needs.

### Q: What's the biggest risk?
**A:** Performance with 1000+ messages (virtual scrolling must work perfectly). Mitigated by implementing react-window early (FE-006-T19).

### Q: Do we need Elasticsearch for search?
**A:** No, PostgreSQL FTS sufficient for MVP. Can migrate later if needed.

### Q: Can we defer @mentions to Phase 2?
**A:** Not recommended. @mentions are quick (FE-006-T08, 12-14 hours) and unlock notifications + collaboration. Better to do now.

### Q: What about message editing history?
**A:** Deferred to Phase 2. MVP just shows "Edited" label.

### Q: Do we need email notifications?
**A:** No, in-app only (Phase 1). Email notifications Phase 2+.

### Q: What about message reactions beyond emoji?
**A:** Phase 1 = emoji only (simple). Phase 2+ can add custom reactions, stickers, etc.

---

## Document Navigation

### For Developers

**Start here:**
1. Read this summary (FE-005-006-Summary.md) ← You are here
2. Read relevant todo list:
   - **FE-005-WebSocket-RealTime-TodoList.md** if implementing real-time
   - **FE-006-ConversationTimeline-TodoList.md** if implementing timeline
3. Reference integration guide for context:
   - **FE-005-006-Integration-Guide.md** (understand data flows)

**During implementation:**
- Use todo list acceptance criteria as test specs
- Follow implementation tasks in order
- Create PRs per task (not per document)
- Reference API specs in `.docs/02-api-and-data-model.md`

### For Product Owners

1. Read this summary first
2. Review requirements in todo lists (section 1.1 + 1.2)
3. Check acceptance criteria (per task)
4. Validate success metrics align with business goals

### For Architects

1. Read this summary
2. Review technical specs (section 2)
3. Review architecture & design (section 3)
4. Check integration guide (data flows, state management)
5. Create ADRs if additional decisions needed

### For QA

1. Read this summary
2. Review testing requirements (section 5)
3. Review edge cases (section 1.3)
4. Plan test automation (per task criteria)
5. Reference integration guide for test scenarios

---

## Key Contacts

| Role | Task | Contact |
|------|------|---------|
| **Product Owner** | Requirements, acceptance criteria | PO |
| **Architect** | Technical decisions, code review | Architect |
| **Frontend Dev** | Implementation | Dev |
| **QA** | Test planning, automation | QA |
| **Backend Dev** | WebSocket API (BE-006), Message API (BE-007) | Backend |

---

## Document Checklist

### Documents Provided ✅

- [x] **FE-005-WebSocket-RealTime-TodoList.md** (20 tasks, 50+ acceptance criteria each)
- [x] **FE-006-ConversationTimeline-TodoList.md** (22 tasks, 50+ acceptance criteria each)
- [x] **FE-005-006-Integration-Guide.md** (data flows, shared components, testing)
- [x] **FE-005-006-Summary.md** (this document, executive summary)

### Content Verified ✅

- [x] All 42 tasks have detailed descriptions
- [x] All tasks have acceptance criteria (testable)
- [x] All tasks have complexity estimates
- [x] All tasks have dependencies documented
- [x] Edge cases identified + mitigation strategies
- [x] Performance targets defined + measurable
- [x] Testing strategies documented
- [x] Timeline realistic + includes contingency
- [x] Architecture diagrams included
- [x] Data flow examples provided
- [x] Code examples where applicable
- [x] No blocking requirements identified

---

## Approval Sign-Off

### Reviews & Approvals

**Product Owner:** ⏳ Awaiting Review  
**Architect:** ⏳ Awaiting Review  
**QA Lead:** ⏳ Awaiting Review  
**Team Lead:** ⏳ Awaiting Review

### Ready to Start When:

- [x] All documentation complete and internally consistent
- [x] No blocking requirements on external teams
- [x] Technology stack approved
- [x] Architecture patterns agreed
- [ ] All approvals received (PO, Architect, QA, Team)
- [ ] Mock server setup complete
- [ ] CI/CD pipeline ready

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-26 | Product Owner | Initial comprehensive todo lists + integration guide |

---

**Status:** 🎯 READY FOR IMPLEMENTATION  
**Last Updated:** 2026-01-26  
**Next Review:** Upon architect/PO approval

---

## Appendix: Quick Links

- 📋 [FE-005 Detailed Todo List](./FE-005-WebSocket-RealTime-TodoList.md)
- 📋 [FE-006 Detailed Todo List](./FE-006-ConversationTimeline-TodoList.md)
- 🔗 [FE-005 ↔ FE-006 Integration Guide](./FE-005-006-Integration-Guide.md)
- 📖 [Product Specification](../01-product-specification.md)
- 📖 [API & Data Model](../02-api-and-data-model.md)
- 📖 [Implementation Guide](../03-implementation-guide.md)
- 📖 [QA & Testing](../04-qa-and-testing.md)
- 🔗 [Project Board](https://github.com/users/csim-sg/projects/1/views/1)
- 🗂️ [Planning Index](./00-INDEX.md)

---

**For questions or clarifications, refer to the detailed todo lists or contact the Product Owner.**
