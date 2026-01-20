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

### **.docs/ Detailed Specifications** (in .docs/ directory)

#### **01-product-specification.md** (940 lines)
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

#### **02-api-and-data-model.md** (1,311 lines)
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

#### **04-qa-and-testing.md** (354 lines)
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

#### **05-quick-reference.md** (334 lines)
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

## 🚀 Quick Start

### For Everyone (Start Here!)
1. Read **../README.md** (5 minutes) — quick start & common commands
2. Read **../AGENTS.md** (10 minutes) — understand your role

### For Backend Developers
1. Read **../README.md** → Quick start
2. Read **../AGENTS.md** → Backend dev role
3. Read **.docs/03-implementation-guide.md** (30 minutes) — system design & Phase 1
4. Read **.docs/02-api-and-data-model.md** (45 minutes) — API contract & database
5. Reference **.docs/02-api-and-data-model.md** during implementation

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
| **.docs/03-implementation-guide.md** | System architecture, components | Backend, architects |
| **.docs/01-product-specification.md** | Product & features | PMs, designers, QA |
| **.docs/02-api-and-data-model.md** | API & data model | Backend, API consumers |
| **.docs/04-qa-and-testing.md** | Testing & QA | QA engineers, testers |
| **.docs/05-quick-reference.md** | Quick reference | Everyone |

---

## 🎯 Key Design Decisions

### Infrastructure
- **Database**: PostgreSQL (ACID, FTS, JSON)
- **Storage**: AWS S3 (payloads, attachments, re-hosting)
- **Queue**: Redis + BullMQ (message retry with exponential backoff)
- **Search**: PostgreSQL FTS (MVP) → Elasticsearch (Phase 2)
- **Real-Time**: Socket.io (WebSocket with 1-hour backlog)
- **Frontend Hosting**: AWS S3 + CloudFront (static SPA)
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
- **Platforms**: Telegram, IRC (MVP); WhatsApp, WeChat, Meta, X (Phase 2)
- **Notifications**: In-app only (email Phase 2)
- **Search**: PostgreSQL FTS (Elasticsearch Phase 2)
- **Multi-Tenant**: Phase 2+ (single-tenant MVP)
- **RTL Support**: Phase 2+ (English default MVP)
- **CI/CD**: GitHub Actions (auto-deploy to S3 + VPS)

---

## 📋 How to Use These Docs

### First Week (Onboarding)
1. Read **../README.md** (quick start)
2. Read **../AGENTS.md** (your role)
3. Read **.docs/03-implementation-guide.md** (system overview)
4. Read role-specific docs from "Quick Start" section above

### During Phase 1 Development (Week 1-2)
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

**What should I test?** → Read **04-qa-and-testing.md**

**Quick lookup?** → See **05-quick-reference.md**

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

**Version**: 2.0  
**Last Updated**: January 17, 2026  
**Status**: ✅ Complete & Ready for Phase 1  
**Project**: YACC - Yet Another Chat Client

**Ready to build? Start with ../README.md! 🚀**
