# YACC Documentation

**Yet Another Chat Client — Complete product specification and implementation guide**

---

## 📚 Core Documentation

### **Root Level Documents** (in repository root)

#### **README.md**
**Quick start guide and common commands**

**Contains**:
- 5-minute quick start
- Common commands (dev, build, test, lint)
- Troubleshooting tips
- Tech stack overview

**Audience**: All developers

**When to use**: Daily reference, onboarding

---

#### **03-implementation-guide.md**
**System architecture, components, implementation phases, and technical decisions**

**Contains**:
- High-level system architecture
- Data flows (inbound, outbound, rules, real-time)
- Technology stack breakdown
- 6 core components deep dive:
  - Message Retry Queue (Redis + BullMQ)
  - Full-Text Search (PostgreSQL FTS)
  - Notification Engine
  - Attachment Handling (Cloudflare R2)
  - WebSocket Real-Time Updates
  - Routing Rules Engine
- Architecture diagrams (repository structure, deployment flows, auth flow, real-time data flow)
- Implementation phases (4 phases, 6 weeks)
- Configuration & environment variables
- Key technical decisions with rationale

**Audience**: Backend developers, architects, tech leads

**When to use**: During development, technical reference

---

#### **AGENTS.md**
**Team roles, responsibilities, and project context**

**Contains**:
- Project summary & status
- Team roles & responsibilities
- What to work on by role
- When to ask questions
- Reference guide

**Audience**: All team members

**When to use**: Onboarding, understanding your role

---

### **.docs/ Core Documentation** (in .docs/ directory)

The documentation has been consolidated into core documents plus phase-specific references. Historical and working documents are preserved in subdirectories.

#### **phases/PHASE_1.md** (Phase 1 Scope)
**Authoritative Phase 1 scope, deliverables, and acceptance criteria**

**Contains**:
- Phase 1 scope (Telegram + IRC)
- Phase 2 deferrals (WhatsApp/WeChat/Meta/X)
- Acceptance criteria and UI filter constraints
- High-level Phase 1 timeline

**Audience**: Product Owner, architects, dev leads, QA

**When to use**: Confirming Phase 1 scope and acceptance

#### **01-product-specification.md** (Product Specification)
**Product scope, features, user stories, UI requirements, and acceptance criteria**

**Contains**:
- Product concept & target users (4 roles)
- MVP scope & deferred features
- Core user flows (8 flows)
- Features overview (15 features)
- **20 complete user stories** with acceptance criteria
- Implementation milestones (4 phases, 6 weeks)

**Audience**: Product managers, designers, QA engineers, dev leads

**When to use**: Before kickoff, to align on scope

---

#### **02-api-and-data-model.md** (API & Data Model)
**Complete API contract, database schema, data models, WebSocket events**

**Contains**:
- API conventions (request/response format, pagination, error handling)
- Enums & constants (roles, statuses, priorities, etc.)
- Complete data models (12 models with JSON examples)
- Database schema (11 tables with indexes)
- REST API endpoints (40+ endpoints, full detail)
- WebSocket events (8 event types with payloads)
- WebSocket configuration (heartbeat, backlog, reconnect)

**Audience**: Backend developers, API consumers, database designers

**When to use**: During API implementation, endpoint reference

---

#### **03-implementation-guide.md** (Implementation Guide)
**System architecture, components, implementation phases, and technical decisions**

**Contains**:
- High-level system architecture
- Data flows (inbound, outbound, rules, real-time)
- Technology stack breakdown
- 6 core components deep dive
- Architecture diagrams (repository structure, deployment flows, auth flow, real-time data flow)
- Implementation phases (4 phases, 6 weeks)
- Configuration & environment variables
- Key technical decisions with rationale

**Audience**: Backend developers, architects, tech leads

**When to use**: During development, technical reference

---

#### **04-qa-and-testing.md** (QA & Testing)
**Test cases, acceptance criteria summary, regression suite, testing priorities**

**Contains**:
- Testing overview (types, tools, test data setup)
- Acceptance criteria summary by story
- 10 test case categories (80+ individual test cases)
- **Regression test suite** (12 critical tests for release)
- Testing priorities (🔴 critical, 🟠 important, 🟡 nice-to-have)
- Test naming convention
- Test case template
- Playwright E2E example

**Audience**: QA engineers, test automation, release managers

**When to use**: Setting up test cases, before release, regression testing

---

#### **05-quick-reference.md** (Quick Reference)
**One-page cheat sheet for quick lookup**

**Contains**:
- Project overview (duration, platforms, tech stack)
- Core features checklist (15 features)
- Data flow quick summary (inbound, outbound, search, rules, notifications)
- Technology decisions (12 decisions with rationale)
- API endpoints (core endpoints quick reference)
- Conversation status lifecycle
- Message retry strategy (diagram)
- WebSocket configuration
- Role permissions summary (matrix)
- Implementation roadmap
- Configuration essentials
- Common gotchas & solutions
- Dev kickoff checklist
- Quick links to other documents

**Audience**: Everyone (developers, PMs, QA, leads)

**When to use**: Daily reference, print & pin on wall, during standup meetings

---

#### **06-phase1-execution-guide.md** (Phase 1 Execution Guide)
**Phase 1 P0 execution plan plus condensed testing execution guide**

**Contains**:
- Test environment setup
- Test execution procedures
- Test report templates
- Regression testing workflow
- Bug reporting guidelines

**Audience**: QA engineers, testers

**When to use**: Executing tests, creating test reports

---

#### **06-phase1-execution-guide.md** (Phase 1 P0 Execution Plan)
**Complete execution plan for 22 P0 backend issues with testing execution summary**

**Contains**:
- All 22 P0 Backend issues with dependencies
- Complete dependency graph (Mermaid diagram)
- 3-week execution timeline (15 business days)
- Week-by-Week breakdown with daily tasks
- Technical clarifications for all issues
- High-risk areas with mitigation strategies
- Complete environment variables reference
- Testing strategy (unit, integration, E2E)
- Handoff checklist for Phase 1 completion

**Audience**: Backend developers, tech leads, architects

**When to use**: Starting Phase 1 development, sprint planning, tracking progress

---

### **.docs/ Additional Directories**

#### **adr/** (Architecture Decision Records)
Official ADRs (ADR-001+). Use for architecture scope and decisions.

#### **governance/** (Governance Logs)
Governance logs (GOV-001+) with audit traceability and sign-offs.

#### **phases/** (Phase Documents)
Phase-specific scope and acceptance criteria documents (e.g., Phase 1).

#### **archive/** (Historical & Critical Documents)
Preserved historical documents, critical decisions, and sign-offs.

**Structure**:
- `phase1/` - Phase 1 critical documents (SOW, pending requests, architect decisions)
- `signoffs/` - Official QA and approval sign-offs
- `design/` - Design iterations and UI history

**Audience**: All team members (for historical reference)

**When to use**: Understanding project history, reviewing decisions, auditing sign-offs

---

#### **temp/** (Temporary/Working Documents)
Just-in-time and temporary working documents. May be cleaned up periodically.

**Contents**:
- Phase 1 working notes and summaries
- Integration task tracking
- Quick reference guides for ongoing work

**Audience**: Developers working on current features

**When to use**: Quick lookup during development (may be deleted when no longer needed)

---

## 🚀 Quick Start

### For Everyone (Start Here!)
1. Read **../README.md** (5 minutes) — quick start & common commands
2. Read **../AGENTS.md** (10 minutes) — understand your role

### For Backend Developers
1. Read **../README.md** → Quick start
2. Read **../AGENTS.md** → Backend dev role
3. Read **.docs/03-implementation-guide.md** (30 minutes) — system design & Phase1
4. Read **.docs/02-api-and-data-model.md** (45 minutes) — API contract & database
5. Read **.docs/06-phase1-execution-guide.md** (20 minutes) — Phase 1 execution plan & testing summary
6. Reference **.docs/02-api-and-data-model.md** during implementation

### For Frontend Developers
1. Read **../README.md** → Quick start
2. Read **../AGENTS.md** → Frontend dev role
3. Read **.docs/03-implementation-guide.md** → System design & UI flow
4. Read **.docs/01-product-specification.md** sections 7 (UI requirements) & 8 (user stories)
5. Read **.docs/02-api-and-data-model.md** sections 1–6 (API, data models, WebSocket)

### For QA/Testers
1. Read **../README.md** → Quick start
2. Read **../AGENTS.md** → QA role
3. Read **.docs/01-product-specification.md** section 8 (user stories with acceptance criteria)
4. Read **.docs/04-qa-and-testing.md** (20 minutes) — test cases & regression suite
5. Reference **.docs/04-qa-and-testing.md** for test planning

### For Product Managers & Designers
1. Read **05-quick-reference.md** (5 minutes) — overview
2. Read **01-product-specification.md** (30 minutes) — full scope
3. Reference **05-quick-reference.md** frequently

### For Tech Leads & Architects
1. Read **../AGENTS.md** → Your role
2. Read **.docs/03-implementation-guide.md** (30 minutes) — complete architecture
3. Read **.docs/02-api-and-data-model.md** (45 minutes) — full API & data model
4. Read **.docs/01-product-specification.md** (30 minutes) — complete scope

---

## 📊 Documentation Coverage

### By Content
- ✅ **20 user stories** with **130+ acceptance criteria**
- ✅ **40+ REST API endpoints** fully documented
- ✅ **8 WebSocket events** with payloads
- ✅ **11 database tables** with indexes
- ✅ **12 data models** with JSON examples
- ✅ **80+ test cases** organized by category
- ✅ **12 regression tests** for release validation
- ✅ **6 core components** with code examples
- ✅ **15 architecture diagrams** (ASCII format)
- ✅ **4 implementation phases** with timelines
- ✅ **12 technology decisions** with rationale

### By Document
| Document | Focus | Audience |
|----------|-------|----------|
| **README.md** (root) | Getting started, commands | All developers |
| **AGENTS.md** (root) | Team roles, responsibilities | All team members |
| **.docs/01-product-specification.md** | Product & features | PMs, designers, QA |
| **.docs/02-api-and-data-model.md** | API & data model | Backend, API consumers |
| **.docs/03-implementation-guide.md** | System architecture, components | Backend, architects |
| **.docs/04-qa-and-testing.md** | Testing & QA | QA engineers, testers |
| **.docs/05-quick-reference.md** | Quick reference | Everyone |
| **.docs/06-phase1-execution-guide.md** | Phase 1 execution + testing guide | Backend developers, QA engineers |
| **.docs/week1-day1-development.md** | Week 1 Day 1 implementation guide | Backend developers |
| **.docs/archive/** | Historical & critical documents | All (reference) |
| **.docs/temp/** | Temporary/working docs | Developers (current work) |

---

## 🎯 Key Design Decisions

### Infrastructure
- **Database**: PostgreSQL (ACID, FTS, JSON)
- **Storage**: Cloudflare R2 (payloads, attachments, re-hosting)
- **Queue**: Redis + BullMQ (message retry with exponential backoff)
- **Search**: PostgreSQL FTS (MVP) → Elasticsearch (Phase 2)
- **Real-Time**: Socket.io (WebSocket with 1-hour backlog)
- **Frontend Hosting**: Cloudflare R2 + CDN (static SPA)
- **Backend Hosting**: Docker on VPS (single-tenant MVP)

### Architecture
- **Frontend**: React 18 + TanStack Start (SPA)
- **Backend**: Node.js + Express (API-only)
- **Monorepo**: Turborepo + pnpm (3 packages: common, backend, frontend)
- **Message Threading**: One conversation per group/channel
- **Rules Engine**: First match wins (simple, predictable)
- **Bulk Actions**: Best-effort (partial OK)
- **Retry Strategy**: Exponential backoff (1m, 5m, 30m; 3 attempts max)

### Scope
- **Platforms**: Telegram, IRC (Phase 1); WhatsApp, WeChat, Meta, X (Phase 2)
- **Notifications**: In-app only (email Phase 2)
- **Search**: PostgreSQL FTS (Elasticsearch Phase 2)
- **Multi-Tenant**: Phase 2+ (single-tenant MVP)
- **RTL Support**: Phase 2+ (English default MVP)
- **CI/CD**: GitHub Actions (auto-deploy to S3 + VPS)

---

## 📋 How to Use These Docs

### Understanding the Structure

The documentation is organized into three levels:

1. **Core Documents (01-06)** - The main, authoritative documentation
2. **archive/** - Historical documents, critical decisions, and sign-offs
3. **temp/** - Temporary/working documents (may be cleaned up periodically)

### First Week (Onboarding)
1. Read **../README.md** (quick start)
2. Read **../AGENTS.md** (your role)
3. Read **.docs/03-implementation-guide.md** (system overview)
4. Read role-specific docs from "Quick Start" section above

### During Phase 1 Development (Week 1-3)
- Reference **.docs/06-phase1-execution-guide.md** (P0 issues, execution order, testing summary)
- Reference **.docs/03-implementation-guide.md** section 5 (Phase 1 tasks)
- Reference **.docs/02-api-and-data-model.md** section 5 (auth endpoints)
- Reference **.docs/02-api-and-data-model.md** section 6 (WebSocket events)
- Reference **.docs/03-implementation-guide.md** section 3 (message retry queue)
- Reference **.docs/01-product-specification.md** section 8 (auth user stories)
- Reference **.docs/04-qa-and-testing.md** (auth test cases)

### During Phase 2-4 Development
- Reference **.docs/03-implementation-guide.md** (core components, data flows)
- Reference **.docs/02-api-and-data-model.md** (endpoint specs)
- Reference **.docs/01-product-specification.md** (user stories & AC)
- Reference **.docs/05-quick-reference.md** for daily lookups

### During Testing & QA
- Use **.docs/04-qa-and-testing.md** to create test cases
- Use **.docs/01-product-specification.md** section 8 for acceptance criteria
- Reference **.docs/04-qa-and-testing.md** section 4 for regression suite
- Use **05-quick-reference.md** for quick lookups

### During Release
- Run **.docs/04-qa-and-testing.md** regression suite (12 tests)
- Verify all **4 implementation phases** complete
- Check **20 user stories** marked done
- Confirm **130+ acceptance criteria** met

---

## ✨ Key Features at a Glance

```
INBOX: Unified queue, filters, search, bulk actions
AUTH: Email/password, roles (4), RBAC
MESSAGES: Send/receive, 5MB attachments, retry on failure
COLLAB: Tags (user-created), notes (@mentions), assignments
RULES: Route by channel/keyword/sender/tag/time
NOTIFY: In-app (assignment, @mention, unread)
SEARCH: Full-text on messages + senders, date range
STORAGE: R2 for payloads + attachments
REALTIME: WebSocket (60s heartbeat, 1-hour backlog)
AUDIT: All actions logged, 1-year retention
PRESENCE: Online/offline + typing indicators
INTEGRATIONS: Telegram, IRC (end-to-end)
```

---

## 📞 Questions?

**Need to get started?** → Read **../README.md**

**Unsure about your role?** → Read **../AGENTS.md**

**How does the system work?** → Read **.docs/03-implementation-guide.md**

**What features to build?** → Read **01-product-specification.md** section 8 (user stories)

**What's the API contract?** → Read **02-api-and-data-model.md**

**What should I test?** → Read **04-qa-and-testing.md** or **06-phase1-execution-guide.md**

**Quick lookup?** → See **05-quick-reference.md**

**Need historical context?** → Check **.docs/archive/** directory

**Looking for working notes?** → Check **.docs/temp/** directory

**What happened during cleanup?** → Read **DOCUMENTATION_CLEANUP_SUMMARY.md**

---

## ✅ Pre-Kickoff Checklist

**All developers:**
- [ ] Read **../README.md** (quick start)
- [ ] Read **../AGENTS.md** (your role)
- [ ] Read **.docs/03-implementation-guide.md** (system overview)

**Backend developers:**
- [ ] Read **02-api-and-data-model.md** (API + database)
- [ ] Review **01-product-specification.md** section 8 (auth stories for Phase 1)

**Frontend developers:**
- [ ] Read **01-product-specification.md** section 7 (UI requirements)
- [ ] Read **02-api-and-data-model.md** sections 1–6 (API + WebSocket)
- [ ] Review **01-product-specification.md** section 8 (user stories)

**QA:**
- [ ] Read **04-qa-and-testing.md** (test strategy)
- [ ] Read **01-product-specification.md** section 8 (user stories + AC)
- [ ] Set up test environment (local + Docker)

**Tech lead:**
- [ ] Read **.docs/03-implementation-guide.md** (complete architecture)
- [ ] Review **02-api-and-data-model.md** (API + database design)
- [ ] Plan Phase 1 sprint with team

**Product owner:**
- [ ] Read **01-product-specification.md** (full scope)
- [ ] Confirm scope with stakeholders
- [ ] Review **05-quick-reference.md** (summary)

---

**Version**: 3.1
**Last Updated**: January 21, 2026 (P0 execution plan added)
**Status**: ✅ Complete & Ready for Phase 1
**Project**: YACC - Yet Another Chat Client

**Ready to build? Start with ../README.md! 🚀**

---

## 📝 Recent Changes

### January 21, 2026 - P0 Issues & Execution Plan
- Created 5 new P0 Backend issues (BE-020, BE-025, BE-026, BE-027, BE-028)
- Promoted 2 issues from P1 to P0 (BE-004, BE-012)
- Enhanced acceptance criteria for BE-003 (BetterAuth) and BE-016 (Socket.io)
- Updated dependencies for 5 issues based on architectural analysis
- Created comprehensive execution guide: **06-phase1-execution-guide.md**
  - 22 P0 Backend issues with complete dependency graph
  - 3-week execution timeline (15 business days)
  - Week-by-Week breakdown with daily tasks
  - Technical clarifications for all issues
  - Risk mitigation strategies
  - Environment variables reference
  - Testing strategy and handoff checklist

**Total P0 Issues**: 22 (11 Week 1, 5 Week 2, 6 Week 3)

### January 21, 2026 - Documentation Cleanup
- Consolidated documentation into 6 main documents (01-06)
- Archived critical documents to `.docs/archive/` (Phase 1 decisions, SOW, QA sign-offs)
- Moved temporary/working documents to `.docs/temp/` (Phase 1 notes, quick references)
- Archived design iterations to `.docs/archive/design/`
- Deleted obsolete directories (`design/`, `.tocheck/`)

**See**: `DOCUMENTATION_CLEANUP_SUMMARY.md` for details
