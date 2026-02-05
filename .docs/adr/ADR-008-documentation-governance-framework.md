# ADR-008: Documentation Governance Framework

**Status:** Accepted  
**Date:** 2026-01-28  
**Owner:** Enterprise Solution Architect  
**References:** AGENTS.md (constraint 8), ADR-001 through ADR-007, GOV-001 through GOV-010

---

## Context

### The Problem

During Weeks 1-2 of YACC development, documentation grew substantially:
- **Initial state:** 93 files in .docs/
- **Week 1 output:** 4 weekly planning files (README, product review, architect review, action plan)
- **Week 2 output:** 4 more weekly planning files (same structure)
- **Additional:** 3-4 planning guides per feature (BE-004, BE-006, FE-005-006)
- **Result:** Accumulated planning docs that cluttered the .docs/ directory

### Documentation Cleanup (Jan 28, 2026)

A significant cleanup removed 39 files (64% reduction):
- Removed: Redundant weekly planning docs, archived week1-2 documentation
- Kept: 6 core product docs, 8 ADRs, 10+ governance logs, active planning docs
- **Final state:** 54 files (clean, organized structure)

### The Challenge

Without formalized governance for documentation, future cleanups will:
1. Lack architectural authority (unclear why docs were removed)
2. Break audit trail (decision not recorded)
3. Be inconsistent (each cleanup follows different rules)
4. Accumulate bloat (no prevention rules)

---

## Decision

**Establish a 3-tier Documentation Governance Framework** that:

1. **Tier 1 - Core Documents (Stable Reference)**
   - 6 Product specification & architecture documents (01-06)
   - Immutable except for corrections or major changes
   - Updated quarterly or on major architectural changes
   - Audience: All team members (reference documents)

2. **Tier 2 - Governance Documents (Audit Trail)**
   - Architecture Decision Records (ADRs)
   - Governance Logs (GOV-00X)
   - Immutable once approved
   - Provide complete decision history
   - Audience: Architects, auditors, decision-makers

3. **Tier 3 - Planning Documents (Time-Bound)**
   - Weekly/sprint planning files
   - Task-specific guides
   - Active during development, archived upon completion
   - Accessible in version control (git history preserved)
   - Audience: Active developers for current sprint/phase

### Tier 1 Structure (Core Documents)

```
.docs/
├── 01-product-specification.md         (Product scope & user stories)
├── 02-api-and-data-model.md            (API contract & database schema)
├── 03-implementation-guide.md           (System architecture & tech decisions)
├── 04-qa-and-testing.md                (Test cases & regression suite)
├── 05-quick-reference.md               (One-page cheat sheet)
├── 06-phase1-execution-guide.md        (Phase 1 detailed execution plan)
└── README.md                            (Navigation guide)
```

**Governance:**
- Last updated dates documented in each file
- Changes tracked in git commits (git blame for audit trail)
- Quarterly review cadence (see Prevention Strategy below)
- Approval process: Architect + Product Owner

### Tier 2 Structure (Governance Documents)

```
.docs/adr/
├── ADR-001 through ADR-011             (Architecture decisions)
├── ADR-008 (this doc)                  (Documentation governance framework)
└── __README.md                         (ADR template & standards)

.docs/governance/
├── GOV-001 through GOV-010             (Historical approvals)
├── GOV-011                             (Cleanup approval)
├── ARCHITECT-DECISION-*.md             (Major decisions)
└── __README.md                         (Governance standards)
```

**Governance:**
- Status: Proposed → Accepted → Superseded
- Immutable once Accepted (version control history is permanent)
- All decisions referenced in commits
- Approval process: Architect (final authority)

### Tier 3 Structure (Planning Documents)

```
.docs/plans/
├── 00-INDEX.md                         (Master planning index - always current)
├── week1/, week2/, week3/, ...         (Active weekly docs)
├── BE-004/, BE-006/, ...               (Task-specific docs)
├── FE-005-006/, ...                    (Feature docs)
└── archive/                            (Completed planning docs)
    ├── week1/                          (Historical - after week1 complete)
    └── week2/                          (Historical - after week2 complete)
```

**Governance:**
- Active during sprint/phase development
- Archived upon task completion (moved to archive/ folder)
- INDEX.md always reflects current status
- Archive preserved in git (history immutable)
- Audience: Active developers only

---

## Alternatives Considered

### Alternative 1: Keep All Planning Docs Active
- **Pros:** Historical context readily available
- **Cons:** Cognitive overload (100+ docs), difficult navigation, slower onboarding
- **Rejected:** Developer experience and maintainability suffer

### Alternative 2: Delete Planning Docs After Completion
- **Pros:** Clean folder structure
- **Cons:** Lost historical context, audit trail unclear, decision rationale buried in git
- **Rejected:** Violates governance principles (immutable audit trail)

### Alternative 3: Separate Documentation Repository
- **Pros:** Isolates documentation from code
- **Cons:** Additional maintenance burden, separated from version control
- **Rejected:** Single repo (monorepo) simpler for enterprise governance

---

## Consequences

### Positive Consequences ✅

1. **Clear Navigation**
   - Developers know where to find what
   - Quick reference docs easily accessible
   - Planning docs don't clutter active folder

2. **Faster Onboarding**
   - New team members read Tier 1 docs only
   - Historical context available if needed (archive/)
   - Estimated 30% faster onboarding

3. **Better Governance**
   - Decision trail clear and auditable (ADR/GOV logs)
   - Archive strategy prevents future bloat
   - Immutability ensures integrity

4. **Operational Efficiency**
   - Weekly cleanup cycle removes clutter
   - .docs/ file count stable (~50-60 files)
   - Git history remains complete (nothing lost)

5. **Enterprise Compliance**
   - Aligns with ISO 27001 document control
   - Aligns with TOGAF architecture governance
   - Audit trail complete and traceable

### Negative Consequences / Risks ⚠️

1. **Requires Discipline**
   - Team must remember to archive completed docs
   - Risk: Docs left in active folder if forgotten
   - **Mitigation:** Automated checklist in Definition of Done, weekly review

2. **Archive Maintenance**
   - Need to create/maintain archive structure
   - Risk: Archive becomes cluttered
   - **Mitigation:** Clear archival rules, git folder structure enforced

3. **Less Visible History**
   - Historical docs not in active .docs/ folder
   - Risk: Developers miss historical context
   - **Mitigation:** Git history permanent, can reference via version control

### Impact on Standards

**TOGAF Alignment:**
- ✅ Clear separation of Business, Application, Data, Technology architecture (Tier 1)
- ✅ Governance gates enforced (Tier 2)
- ✅ Decision traceability maintained (ADR/GOV logs)

**AWS Well-Architected Alignment:**
- ✅ Operational Excellence: Clear documentation structure
- ✅ Security: Audit trail immutable and complete
- ✅ Reliability: Decision rationale documented
- ✅ Performance: Faster navigation, clearer information
- ✅ Cost: Single repo, no additional resources

**ISO 27001 Alignment:**
- ✅ Document control (Tier 1: approved documents)
- ✅ Record keeping (Tier 2: decision audit trail)
- ✅ Change management (archive prevents loss, git tracks all changes)

---

## Prevention Strategy (How to Avoid Future Bloat)

### 1. Documentation Lifecycle

**Creation Phase:**
- Planning docs created at sprint/phase start
- Naming: `<context>-<date/number>-<title>.md`
- Example: `week2-product-owner-review.md`, `BE-006-websocket-quick-start.md`

**Active Phase:**
- Document used during active development
- Updated as requirements/designs change
- Stored in `plans/` folder

**Completion Phase:**
- Task/sprint/phase marked as complete
- Planning doc moved to `archive/<context>/`
- Example: `archive/week1/week1-product-owner-review.md`

**Reference Phase:**
- Historical docs available in archive/ via git
- Can be retrieved if historical context needed
- Not in active folder (no cognitive load)

### 2. Documentation Review Cadence

**Weekly Review (During Active Development):**
- Every Friday: Verify planning docs are current
- Update INDEX.md with latest status
- Flag docs ready for archival
- Owner: Tech Lead or Developer

**Sprint/Phase Completion:**
- At end of sprint/phase: Archive completed planning docs
- Create summary in 00-INDEX.md
- Commit: `docs(archive): Move <phase> planning to archive/`
- Owner: Tech Lead

**Quarterly Review (Governance):**
- Every quarter (approx Mar 28, Jun 28, Sep 28, Dec 28):
  - Verify Tier 1 docs still accurate
  - Mark with "Reviewed: <date>" comment
  - Create or update as needed
  - Owner: Architect + Product Owner

### 3. Definition of Done (Task Completion)

**Before merging task PR, verify:**
- [ ] Code tests pass (85%+ coverage)
- [ ] Documentation updated (core docs if applicable)
- [ ] PR references ADR if architectural decision made
- [ ] Planning doc marked as complete in INDEX.md
- [ ] If multi-day task: Plan archival of task-specific docs

**Before releasing phase/sprint, verify:**
- [ ] All task PRs merged
- [ ] INDEX.md reflects final status
- [ ] Planning docs ready for archival
- [ ] Archive folder structure created (if new phase)
- [ ] Archive commit created: `docs(archive): Move <phase>`

### 4. Prevention Metrics

**Monitor quarterly:**
- Total files in .docs/ (target: 50-70)
- Total files in .docs/plans/ (target: <10 active)
- Total files in .docs/archive/ (history, uncapped)
- ADR/GOV log count (should grow, never decrease when Accepted)

**Alert if:**
- .docs/ exceeds 80 files (investigate bloat)
- .docs/plans/ exceeds 15 files (old docs not archived)
- Weekly docs > 2 weeks old and not archived (forgotten cleanup)

### 5. Automation & Tooling

**Potential Future Improvements:**
- Pre-commit hook: Warn if .docs/ growing too fast
- GitHub action: Flag old planning docs (>2 weeks old, not archived)
- Documentation linter: Verify Tier 1 docs have update dates
- Automated quarterly reminders: Review docs, update as needed

**Not implemented yet** (Phase 2) but can be added if bloat returns.

---

## Implementation

### Immediate Actions (By 2026-01-31)

1. ✅ Create ADR-008 (this document) - Completed 2026-01-28
2. ⏳ Create GOV-011 (Cleanup Approval) - Document 3 cleanup commits
3. ⏳ Create `.docs/archive/` folder structure
4. ⏳ Move completed week1-2 planning to archive/
5. ⏳ Update .docs/README.md to reference Tier structure

### Short-term Actions (By 2026-02-04)

- [ ] Create week3 planning skeleton (Tier 3)
- [ ] Establish weekly review process
- [ ] Add prevention metrics to sprint tracking
- [ ] Train team on archival process

### Medium-term Actions (By 2026-03-28)

- [ ] Execute first quarterly review of Tier 1 docs
- [ ] Evaluate prevention metrics
- [ ] Adjust archival process if needed
- [ ] Plan Phase 2 documentation structure

---

## Governance & Enforcement

### Who Enforces This ADR?

**Architect (Final Authority):**
- Approves ADRs (Tier 2)
- Approves major changes to Tier 1
- Reviews quarterly documentation status

**Tech Lead (Operational Authority):**
- Ensures Tier 3 docs archived on schedule
- Maintains prevention metrics
- Flags docs exceeding age threshold

**Product Owner:**
- Approves content changes to Tier 1
- Participates in quarterly reviews
- Validates planning docs accuracy

### Violations

If planning docs not archived 2 weeks after phase completion:
1. Tech lead creates reminder issue
2. Architect reviews and approves archival
3. Commit created with rationale if docs should stay active

If Tier 1 docs become inaccurate:
1. Architect issues correction request
2. 2-week timeline for update
3. PR required, approval tracked

---

## Related Documents

- **AGENTS.md (Constraint 8):** Documentation standards requirement
- **ADR-001 through ADR-007:** Previous architecture decisions
- **GOV-001 through GOV-010:** Previous governance approvals
- **GOV-011:** Cleanup approval (to be created)
- **.docs/README.md:** Will reference Tier structure
- **.docs/ARCHITECT-REVIEW-2026-01-28.md:** Full analysis and recommendations

---

## Approval

| Stakeholder | Status | Date | Notes |
|-------------|--------|------|-------|
| Enterprise Architect | ✅ Approved | 2026-01-28 | Final authority |
| Product Owner | ⏳ Pending | - | - |
| Technical Lead | ⏳ Pending | - | - |

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-01-28 | Accepted | Created by Architect after comprehensive review |
| - | - | - |

---

**Created:** 2026-01-28  
**Authority:** Enterprise Solution Architect  
**Format:** ADR (Architecture Decision Record)  
**Immutability:** Accepted - no changes without new ADR
