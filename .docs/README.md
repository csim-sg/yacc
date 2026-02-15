# 📚 YACC Documentation

**Yet Another Chat Client — Product specification, API contract, implementation guide, and architecture decisions**

---

## 🎯 Quick Navigation

### For Everyone (Start Here!)
1. Read **../README.md** (5 minutes) — Quick start & common commands
2. Read **../AGENTS.md** (10 minutes) — Understand your role
3. Read **05-quick-reference.md** (5 minutes) — Project overview

### By Role

**Backend Developers:**
- `03-implementation-guide.md` - System architecture & design
- `02-api-and-data-model.md` - API contract & database schema
- `adr/` - Architecture decisions affecting backend
- `governance/` - Approval & decision logs

**Frontend Developers:**
- `03-implementation-guide.md` - System architecture & UI flows
- `01-product-specification.md` - Features & acceptance criteria
- `02-api-and-data-model.md` - API contract & WebSocket events
- `adr/` - Architecture decisions affecting frontend

**QA/Testers:**
- `04-qa-and-testing.md` - Test cases & regression suite
- `01-product-specification.md` - User stories & acceptance criteria

**Product Owners & Designers:**
- `01-product-specification.md` - Complete product scope
- `05-quick-reference.md` - Features checklist

**Tech Leads & Architects:**
- `03-implementation-guide.md` - Complete system architecture
- `02-api-and-data-model.md` - API design & data model
- `adr/` - All architecture decisions
- `governance/` - Decision audit trail

---

## 📖 Core Documentation

### 🔹 01-product-specification.md
**Product scope, features, user stories, and acceptance criteria**

- Target users (4 roles: Super Admin, Admin, Manager, User)
- 15 core features overview
- 20 complete user stories with 130+ acceptance criteria
- 8 user flows (inbox, auth, messaging, rules, notifications, search, etc.)
- Implementation phases (4 phases, 6 weeks)

**When to use:** Before kickoff, to align on scope  
**Audience:** Product managers, designers, QA engineers, dev leads

---

### 🔹 02-api-and-data-model.md
**Complete API contract, database schema, WebSocket events**

- API conventions (request/response format, pagination, error handling)
- Enums & constants (roles, statuses, priorities, etc.)
- 12 data models with JSON examples
- 11 database tables with indexes
- 40+ REST API endpoints (fully specified)
- 8 WebSocket events with payloads
- WebSocket configuration (heartbeat, backlog, reconnection)

**When to use:** During implementation, endpoint reference  
**Audience:** Backend developers, API consumers, database designers

---

### 🔹 03-implementation-guide.md
**System architecture, components, data flows, and technical decisions**

- High-level system architecture (inbound, outbound, real-time, search, rules)
- 6 core components deep dive:
  - Message Retry Queue (Redis + BullMQ)
  - Full-Text Search (PostgreSQL FTS)
  - Notification Engine
  - Attachment Handling (Cloudflare R2)
  - WebSocket Real-Time Updates
  - Routing Rules Engine
- Architecture diagrams (deployment, auth flow, data flows)
- 4 implementation phases with timelines
- Configuration & environment variables
- 12 technology decisions with rationale

**When to use:** During development, technical reference  
**Audience:** Backend developers, architects, tech leads

---

### 🔹 04-qa-and-testing.md
**Test cases, regression suite, and testing strategies**

- Testing overview (types, tools, test data setup)
- Acceptance criteria summary by user story
- 80+ test cases organized by category
- **12-test regression suite** for release validation
- Test naming conventions and templates
- Playwright E2E examples

**When to use:** Setting up test cases, before release  
**Audience:** QA engineers, test automation engineers, release managers

---

### 🔹 05-quick-reference.md
**One-page cheat sheet for quick lookup**

- Project overview (duration, platforms, tech stack)
- 15 core features checklist
- Technology decisions (12 decisions with rationale)
- Conversation status lifecycle
- Message retry strategy
- WebSocket configuration
- Role permissions matrix
- Common gotchas & solutions
- Development checklist

**When to use:** Daily reference, print & pin on wall  
**Audience:** Everyone

---

## 📋 Architecture Artifacts

### 📁 architecture/ (Architect Reviews)

Official architecture review documents and guidance.

**Current Files:**
- **INDEX-TS-RULE-CLARIFICATION.md** - Explains no barrel exports rule with exceptions
- **ARCHITECT-REVIEW-BE006-PR177.md** - Review of BE-006 WebSocket infrastructure
 - **00-INDEX.md** - Architecture document set index (Technology/Application/Data)

**When to use:** Understanding architecture patterns and decisions  
**Audience:** Architects, developers making design decisions

---

### 📁 adr/ (Architecture Decision Records)

Official ADRs numbered sequentially. Each ADR documents a significant architectural decision.

**Current ADRs:**
- **ADR-001**: Core table UUIDs
- **ADR-002**: Non-core integer IDs
- **ADR-003**: Phase 1 scope (Telegram + IRC)
- **ADR-004**: Logging strategy
- **ADR-005**: Infrastructure & config pattern
- **ADR-006**: Auth client implementation
- **ADR-007**: Jest to Vitest migration
- **ADR-011**: File naming convention standardization
- **ADR-012**: Index aggregator allowance (controllers/schemas lists)

**When to use:** Understanding architectural rationale  
**Audience:** Architects, tech leads, developers making design decisions

---

### 📁 governance/ (Governance Logs)

Official governance logs providing audit traceability for all decisions.

**Current Logs:**
- **GOV-001 through GOV-010**: Decision approvals and enforcement
- **ARCHITECT-DECISION-*****: Final architectural decisions
- **__README.md**: How governance works

**When to use:** Audit trail, compliance verification, understanding decision history  
**Audience:** Architects, auditors, compliance teams

---

### 📁 plans/ (Development Planning)

Development planning documents, task tracking, and sprint planning.

**Key Files:**
- **00-INDEX.md**: Master planning index with task status
 - **06-tasks.md**: Task + GitHub issue mapping (kept current)

**MVP Note:** At MVP stage, `.docs/plans/` should contain only currently-active execution material (if any). Historical working docs are retrieved from git history.

**When to use:** Daily task tracking, sprint planning  
**Audience:** Developers, tech leads, project managers

---

## 🚀 Development Workflow

### Week 1 Kickoff
1. Read `../README.md` - Quick start
2. Read `../AGENTS.md` - Your role
3. Read `03-implementation-guide.md` - System overview
4. Read role-specific core document (see "By Role" section above)
5. Check `plans/00-INDEX.md` for current week's tasks

### During Development
- Reference core documents by topic (API design, data model, testing strategy)
- Check `adr/` for architectural decisions
- Reference `plans/00-INDEX.md` for task status
- Consult `governance/` for approval status

### Before Release
- Run regression suite from `04-qa-and-testing.md`
- Verify all acceptance criteria met from `01-product-specification.md`
- Check `adr/` and `governance/` are updated
- Update `plans/00-INDEX.md` with completion status

---

## 📊 Documentation Stats
- ✅ **5 core product documents** (01-05)
- ✅ **1 execution tracker** (`06-tasks.md`)
- ✅ **8 active ADRs** (architecture decisions)
- ✅ **10 governance logs** (approval audit trail)
- ✅ **Multiple planning documents** (task tracking)
- ✅ **20 user stories** with **130+ acceptance criteria**
- ✅ **40+ REST API endpoints** fully documented
- ✅ **8 WebSocket events** with payloads
- ✅ **11 database tables** with indexes
- ✅ **80+ test cases** organized by category
- ✅ **12 regression tests** for release validation
- ✅ **6 core components** with architecture details
- ✅ **12 technology decisions** with rationale

---

## 🎯 Key Design Decisions

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| **Database** | PostgreSQL | ACID, FTS, JSON support, mature |
| **Storage** | Cloudflare R2 | Cheaper than S3, CDN-backed, S3-compatible |
| **Queue** | Redis + BullMQ | Simple, fast, built-in retry scheduling |
| **Real-Time** | Socket.io | WebSocket with reconnection & backlog |
| **Search** | PostgreSQL FTS (MVP) | Sufficient for MVP, Elasticsearch post-MVP |
| **Architecture** | Single-tenant MVP | Simpler, credentials in env vars |
| **Frontend** | React 18 + TanStack Start | Modern, SSR-capable, great DX |
| **Backend** | Node.js + Express | Simple, fast, familiar ecosystem |
| **Retry** | Exponential backoff | Standard, reduces server load |
| **Rules** | First match wins | Simple, predictable, avoids conflicts |

---

## ✅ Updated: 2026-02-14

**Status:** ✅ MVP stage (Phase 1 + Phase 2 complete)  
**Total Files:** 53 (down from 93)  
**Total Size:** 1.1MB (down from 1.7MB)  
**Organization:** Core docs + ADR + Governance + Plans  
**Latest:** MVP documentation cleanup + post-MVP doc lifecycle ADR

---

## 📞 Quick Links

| Need | Find It | Read Time |
|------|---------|-----------|
| Quick start | `../README.md` | 5 min |
| Your role | `../AGENTS.md` | 10 min |
| Features overview | `01-product-specification.md` | 30 min |
| API design | `02-api-and-data-model.md` | 45 min |
| System architecture | `03-implementation-guide.md` | 30 min |
| Test cases | `04-qa-and-testing.md` | 20 min |
| Quick reference | `05-quick-reference.md` | 5 min |
| Execution status | `plans/00-INDEX.md` | varies |
| Architecture decisions | `adr/` | varies |
| Decision approvals | `governance/` | varies |
| Task tracking | `plans/00-INDEX.md` | varies |

---

**Ready to build? Start with ../README.md! 🚀**
