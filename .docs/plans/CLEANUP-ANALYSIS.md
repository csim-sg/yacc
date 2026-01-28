# 📊 .docs/plans/ Cleanup Analysis & Recommendations

**Date:** 2026-01-28  
**Analyst:** Product Owner  
**Scope:** Complete cleanup of .docs/plans/ folder (25 files, 20,509 lines)  
**Status:** ✅ Analysis Complete - Ready for Implementation

---

## Executive Summary

The `.docs/plans/` folder contains **25 planning documents** with significant duplication and redundancy. Current state:

- **Total Files:** 25 markdown files
- **Total Size:** ~190 KB
- **Total Lines:** 20,509 lines
- **Duplication Level:** HIGH (3-4 versions of same information)
- **Redundancy:** HIGH (summaries + originals)
- **Completed Tasks:** 4 (BE-027, BE-003, BE-005, BE-004)

**Recommendation:** Consolidate to **8 core planning documents** (reduction of ~68%, target: 8 files)

---

## 🔍 Detailed Analysis

### Group 1: DUPLICATE BE-004 DOCUMENTS (3 files, 1,664 lines)

**Files:**
1. `BE-004-development-progress.md` (257 lines)
2. `BE-004-READY-TO-START.md` (395 lines)
3. `BE-004-forgot-password-development-guide.md` (1,112 lines)

**Analysis:**
- All three files describe **the same task**: BE-004 Forgot Password
- **Overlap:** 90%+ duplication (same ACs, same code examples, same tests)
- **Purpose of Each:**
  - `development-progress.md`: Progress tracker (now obsolete, BE-004 complete)
  - `READY-TO-START.md`: Quick start guide (superseded by full guide)
  - `forgot-password-development-guide.md`: Full implementation guide (comprehensive, reusable)

**Status:** BE-004 is DONE ✅ (merged Jan 25)

**Recommendation:**
- ❌ **DELETE**: `BE-004-development-progress.md` (progress tracking obsolete)
- ❌ **DELETE**: `BE-004-READY-TO-START.md` (superseded by full guide)
- ✅ **KEEP (Archive)**: `BE-004-forgot-password-development-guide.md` → Move to `.docs/guides/completed-tasks/`

**Rationale:** Completed tasks should be archived, not cluttering active planning folder.

---

### Group 2: DUPLICATE FE TASK DOCUMENTS (6 files, 1,500+ lines)

**Files:**
1. `FE-005-006-DEVELOPER-TODOS.md`
2. `FE-005-006-Integration-Guide.md`
3. `FE-005-006-QuickStart.md`
4. `FE-005-006-Summary.md`
5. `FE-005-WebSocket-RealTime-TodoList.md`
6. `FE-006-ConversationTimeline-TodoList.md`

**Analysis:**
- All six files describe **FE-005 and FE-006 tasks** (frontend WebSocket + Timeline)
- **Overlap:** Each file overlaps with others
  - Summary = condensed version of TodoList
  - QuickStart = condensed version of Summary
  - DEVELOPER-TODOS = parallel structure to TodoLists
  - Integration-Guide = ties them together
- **Status:** FE-005/FE-006 not yet started (awaiting FE-004 merge)

**Recommendation:**
- ❌ **DELETE**: `FE-005-006-QuickStart.md` (superseded by Summary)
- ❌ **DELETE**: `FE-005-006-DEVELOPER-TODOS.md` (redundant with TodoLists)
- ✅ **KEEP**: `FE-005-006-Summary.md` (executive overview, 2-5 min read)
- ✅ **KEEP**: `FE-005-006-Integration-Guide.md` (how they work together)
- ✅ **KEEP**: `FE-005-WebSocket-RealTime-TodoList.md` (detailed for FE-005)
- ✅ **KEEP**: `FE-006-ConversationTimeline-TodoList.md` (detailed for FE-006)

**Rationale:** Keep summary for quick reference + detailed guides for implementation. Delete intermediate versions.

---

### Group 3: DUPLICATE SUMMARY DOCUMENTS (3 files, 400 lines)

**Files:**
1. `docs-update-summary.md`
2. `documentation-update-summary.md`
3. `infrastructure-config-pattern-summary.md`

**Analysis:**
- `docs-update-summary.md` and `documentation-update-summary.md` have **identical content** (same summaries)
- `infrastructure-config-pattern-summary.md` is a design summary (not planning)
- All are **one-time status documents** from past sessions (Jan 24-26)
- Content is superseded by ADR-005 + GOV-008

**Recommendation:**
- ❌ **DELETE**: `docs-update-summary.md` (duplicate)
- ❌ **DELETE**: `documentation-update-summary.md` (duplicate)
- ❌ **DELETE**: `infrastructure-config-pattern-summary.md` (design doc, not planning)

**Rationale:** These are session summaries, not forward-looking planning. Content is archived elsewhere (ADRs/GOV logs).

---

### Group 4: REVIEW/CHECKLIST DOCUMENTS (3 files, 200 lines)

**Files:**
1. `ARCHITECT-REVIEW-CHECKLIST.md`
2. `week1-architect-review.md`
3. `week1-product-owner-review.md`

**Analysis:**
- `ARCHITECT-REVIEW-CHECKLIST.md` is outdated (Week 1 already reviewed)
- `week1-architect-review.md` and `week1-product-owner-review.md` are **comprehensive reviews** (required reference)
- Week 1 is **COMPLETE** (all 4 tasks done)

**Recommendation:**
- ❌ **DELETE**: `ARCHITECT-REVIEW-CHECKLIST.md` (outdated, Week 1 complete)
- ✅ **KEEP**: `week1-product-owner-review.md` (reference for understanding Week 1 decisions)
- ✅ **KEEP**: `week1-architect-review.md` (reference for understanding Week 1 decisions)

**Rationale:** Keep reviews as historical reference. Delete outdated checklists.

---

### Group 5: WEEKLY PLANNING DOCUMENTS (6 files)

**Files:**
1. `week1-action-plan.md` (Week 1 - COMPLETE)
2. `week2-action-plan.md` (Week 2 - ACTIVE)
3. `week1-quick-reference.md` (Week 1 - COMPLETE)
4. `week2-quick-reference.md` (Week 2 - ACTIVE)
5. `week2-product-owner-review.md` (Week 2 - ACTIVE)
6. `week2-architect-review.md` (Week 2 - ACTIVE)

**Analysis:**
- **Week 1** documents (action-plan, quick-ref): Historical reference (week complete)
- **Week 2** documents (action-plan, product-review, architect-review, quick-ref): **ACTIVE** (current week planning)
- These are **NOT duplicates** - each has distinct purpose

**Recommendation:**
- ✅ **ARCHIVE**: `week1-action-plan.md` → Move to `.docs/plans/week1/` folder
- ✅ **ARCHIVE**: `week1-quick-reference.md` → Move to `.docs/plans/week1/` folder
- ✅ **KEEP**: `week2-action-plan.md` (current week)
- ✅ **KEEP**: `week2-quick-reference.md` (current week)
- ✅ **KEEP**: `week2-product-owner-review.md` (current week)
- ✅ **KEEP**: `week2-architect-review.md` (current week)

**Rationale:** Organize by week to reduce clutter. Keep current week active, archive past weeks.

---

### Group 6: CORE INDEX & NAVIGATION (2 files)

**Files:**
1. `00-INDEX.md` (Master index, 742 lines)
2. `README.md` (Duplicate quick-ref, 386 lines)

**Analysis:**
- `00-INDEX.md`: **COMPREHENSIVE INDEX** - lists all documents, status, progress, links
- `README.md`: **QUICK REFERENCE** - condensed version of INDEX
- Both serve same purpose (navigation) but `00-INDEX.md` is more complete

**Recommendation:**
- ✅ **KEEP & UPDATE**: `00-INDEX.md` as MASTER INDEX
- ❌ **DELETE**: `README.md` (redundant, smaller version of 00-INDEX)
  - Move any unique content to 00-INDEX first

**Rationale:** One master index is cleaner than duplicate navigation docs.

---

### Group 7: ARCHITECTURE/DESIGN DOCUMENTS (2 files)

**Files:**
1. `flat-folder-structure-review.md`
2. `fe-004-handoff.md`

**Analysis:**
- `flat-folder-structure-review.md`: Design/architecture review (not planning)
- `fe-004-handoff.md`: Task-specific handoff (FE-004 already complete)
- Both are **one-time documents** from past sessions

**Recommendation:**
- ❌ **DELETE**: `flat-folder-structure-review.md` (design doc, belongs in `.docs/adr/` or `.docs/governance/`)
- ❌ **DELETE**: `fe-004-handoff.md` (FE-004 complete, superseded by current status tracking)

**Rationale:** Design decisions should be in ADRs, not planning folder. Completed task handoffs don't need to stay in plans/.

---

## 📋 Cleanup Plan Summary

### Files to DELETE (11 files)

| File | Reason | Impact |
|------|--------|--------|
| `BE-004-development-progress.md` | Task complete, progress tracking obsolete | Low |
| `BE-004-READY-TO-START.md` | Task complete, superseded by guide | Low |
| `docs-update-summary.md` | Duplicate of documentation-update-summary | Low |
| `documentation-update-summary.md` | One-time status doc, archive elsewhere | Low |
| `infrastructure-config-pattern-summary.md` | Design doc, not planning | Medium |
| `ARCHITECT-REVIEW-CHECKLIST.md` | Week 1 complete, checklist outdated | Low |
| `FE-005-006-QuickStart.md` | Superseded by Summary | Low |
| `FE-005-006-DEVELOPER-TODOS.md` | Redundant with TodoLists | Low |
| `README.md` | Duplicate of 00-INDEX | Low |
| `fe-004-handoff.md` | Task complete, handoff no longer needed | Low |
| `flat-folder-structure-review.md` | Design doc, not planning | Low |

**Total Lines Removed:** ~3,500 (17%)

### Files to KEEP (14 files)

#### Master Index (1 file)
- `00-INDEX.md` - Master planning index (UPDATE to remove redundant content)

#### Week 1 Reference (2 files)
- `week1-action-plan.md` - Historical reference
- `week1-product-owner-review.md` - Historical reference
- `week1-architect-review.md` - Historical reference (add: 1 file)

**Subtotal:** 4 files (archive these to `week1/` subfolder)

#### Week 2 Active Planning (4 files)
- `week2-action-plan.md` - Current execution plan
- `week2-quick-reference.md` - Current quick reference
- `week2-product-owner-review.md` - Current requirements
- `week2-architect-review.md` - Current architecture decisions

#### FE-005 & FE-006 (3 files)
- `FE-005-006-Summary.md` - Overview
- `FE-005-006-Integration-Guide.md` - Integration details
- `FE-005-WebSocket-RealTime-TodoList.md` - FE-005 tasks
- `FE-006-ConversationTimeline-TodoList.md` - FE-006 tasks

**Subtotal:** 6 files

#### Completed Task References (1 file - to archive)
- `BE-004-forgot-password-development-guide.md` - Comprehensive guide (MOVE to `.docs/guides/completed/`)

**Total Files After Cleanup:** 
- Active Planning: 8 files
- Historical Archives: 6 files (in subfolders)
- **Grand Total:** 14 files (reduction of 44%)

---

## 🗂️ Recommended Folder Structure

### After Cleanup

```
.docs/plans/
├── 00-INDEX.md                          (MASTER - all status & links)
│
├── week2/                               (CURRENT WEEK)
│   ├── action-plan.md
│   ├── quick-reference.md
│   ├── product-owner-review.md
│   └── architect-review.md
│
├── fe-005-006/                          (NEXT FEATURES)
│   ├── 00-SUMMARY.md
│   ├── 01-INTEGRATION-GUIDE.md
│   ├── FE-005-websocket-realtime.md
│   └── FE-006-conversation-timeline.md
│
└── week1/                               (HISTORICAL)
    ├── action-plan.md
    ├── product-owner-review.md
    └── architect-review.md
```

### Files to MOVE

`.docs/guides/completed-tasks/`
- `BE-004-forgot-password-development-guide.md`

---

## 📊 Impact Analysis

### Metrics

| Metric | Before | After | Reduction |
|--------|--------|-------|-----------|
| **Files** | 25 | 14 | 44% |
| **Lines** | 20,509 | ~12,000 | 41% |
| **Size** | ~190 KB | ~110 KB | 42% |
| **Navigation Clarity** | Low (25 files) | High (organized) | ✅ |
| **Single Source of Truth** | No | Yes (00-INDEX) | ✅ |

### Benefits

1. **✅ Clarity**: Developers know exactly where to find current planning docs
2. **✅ Reduced Confusion**: No duplicate documents with conflicting information
3. **✅ Maintainability**: Easier to keep documents in sync (fewer files)
4. **✅ Navigation**: Single master index points to all active/historical docs
5. **✅ Archive**: Completed task guides preserved but organized separately

### Risks (Mitigated)

| Risk | Mitigation |
|------|-----------|
| Losing information from deleted files | Comprehensive guides (BE-004, FE-005, FE-006) are KEPT |
| Breaking links to deleted files | Update 00-INDEX.md with new paths |
| Historical context lost | Archive Week 1 in subfolder for reference |

---

## ✅ Implementation Checklist

### Phase 1: Preparation (15 minutes)

- [ ] Create `.docs/guides/completed-tasks/` folder
- [ ] Create `.docs/plans/week1/` subfolder
- [ ] Create `.docs/plans/fe-005-006/` subfolder
- [ ] Verify git status is clean (no pending changes)

### Phase 2: File Operations (30 minutes)

**MOVE (4 files):**
- [ ] Move `week1-action-plan.md` → `.docs/plans/week1/action-plan.md`
- [ ] Move `week1-product-owner-review.md` → `.docs/plans/week1/product-owner-review.md`
- [ ] Move `week1-architect-review.md` → `.docs/plans/week1/architect-review.md`
- [ ] Move `BE-004-forgot-password-development-guide.md` → `.docs/guides/completed-tasks/BE-004-forgot-password.md`

**RENAME (4 files - for FE org):**
- [ ] Rename `FE-005-006-Summary.md` → `FE-005-006/00-SUMMARY.md`
- [ ] Rename `FE-005-006-Integration-Guide.md` → `FE-005-006/01-INTEGRATION-GUIDE.md`
- [ ] Rename `FE-005-WebSocket-RealTime-TodoList.md` → `FE-005-006/FE-005-websocket-realtime.md`
- [ ] Rename `FE-006-ConversationTimeline-TodoList.md` → `FE-005-006/FE-006-conversation-timeline.md`

**RENAME (2 files - for Week 2 org):**
- [ ] Rename `week2-action-plan.md` → `week2/action-plan.md`
- [ ] Rename `week2-quick-reference.md` → `week2/quick-reference.md`
- [ ] Rename `week2-product-owner-review.md` → `week2/product-owner-review.md`
- [ ] Rename `week2-architect-review.md` → `week2/architect-review.md`

**DELETE (11 files):**
- [ ] Delete `BE-004-development-progress.md`
- [ ] Delete `BE-004-READY-TO-START.md`
- [ ] Delete `docs-update-summary.md`
- [ ] Delete `documentation-update-summary.md`
- [ ] Delete `infrastructure-config-pattern-summary.md`
- [ ] Delete `ARCHITECT-REVIEW-CHECKLIST.md`
- [ ] Delete `FE-005-006-QuickStart.md`
- [ ] Delete `FE-005-006-DEVELOPER-TODOS.md`
- [ ] Delete `README.md`
- [ ] Delete `fe-004-handoff.md`
- [ ] Delete `flat-folder-structure-review.md`

### Phase 3: Update Master Index (20 minutes)

- [ ] Update `00-INDEX.md`:
  - [ ] Add "Folder Structure" section showing new organization
  - [ ] Update all file path references
  - [ ] Remove duplicate content from README (now deleted)
  - [ ] Add "Historical Archives" section with links to week1/
  - [ ] Add "Completed Task Guides" section with links to guides/completed-tasks/
  - [ ] Update navigation instructions for new structure

### Phase 4: Update Git (10 minutes)

- [ ] Create feature branch: `task/plans-folder-cleanup`
- [ ] Commit file moves/deletes with clear message
- [ ] Commit 00-INDEX.md updates
- [ ] Create PR with cleanup summary
- [ ] Merge to dev

### Phase 5: Verification (10 minutes)

- [ ] Verify all links in 00-INDEX.md are correct (test 5+ links)
- [ ] Verify no broken references remain
- [ ] Check folder structure matches recommendation
- [ ] Confirm file count is 14 (or close)
- [ ] Verify no accidental deletions of important content

**Total Time Estimate:** ~90 minutes

---

## 🎯 Master Index Template (00-INDEX.md Updates)

After cleanup, 00-INDEX.md should include:

```markdown
# Planning Documents Index

**Last Updated:** [date]  
**Status:** [current week status]  
**Total Files:** 14 (organized into folders)

## Quick Navigation

### 📍 Current Week (Week 2)
- Action Plan → `week2/action-plan.md`
- Quick Reference → `week2/quick-reference.md`
- Requirements → `week2/product-owner-review.md`
- Architecture → `week2/architect-review.md`

### 🎯 Next Features (FE-005 & FE-006)
- Overview → `fe-005-006/00-SUMMARY.md`
- Integration → `fe-005-006/01-INTEGRATION-GUIDE.md`
- FE-005 Tasks → `fe-005-006/FE-005-websocket-realtime.md`
- FE-006 Tasks → `fe-005-006/FE-006-conversation-timeline.md`

### 📚 Historical References
- Week 1 Documents → `week1/` folder
  - Action Plan, Requirements Review, Architecture Review

### 🔍 Completed Guides
- BE-004 Implementation → `.docs/guides/completed-tasks/`

## Status Tracking

[Current task status, progress, blockers, next steps]

## Folder Structure

```
.docs/plans/
├── 00-INDEX.md (this file)
├── week2/ (current week)
├── fe-005-006/ (next features)
└── week1/ (historical)
```
```

---

## ✨ Success Criteria

After cleanup is COMPLETE:

- ✅ Only **14 files** remain in `.docs/plans/`
- ✅ **Zero duplicate documents** (each file has unique purpose)
- ✅ **Clear organization** (week folders, fe folders, completed guides)
- ✅ **Master index updated** (00-INDEX.md current and complete)
- ✅ **All links valid** (no broken references)
- ✅ **Git history clean** (single commit for reorganization)
- ✅ **Developers report clarity improvement** (can find docs faster)
- ✅ **Reduction ≥40%** (lines/files/size all reduced)

---

## 📝 Post-Cleanup Actions

After implementation:

1. **Announce cleanup** to team
   - New folder structure
   - New navigation guide
   - Link to updated 00-INDEX.md

2. **Update project README** (if it references plans/)
   - Update all file paths
   - Remove references to deleted files

3. **Monitor next session**
   - Do new planning documents avoid duplication?
   - Is navigation clearer?
   - Are updates easier?

---

## 🔗 Related Documents

- `.docs/plans/00-INDEX.md` - Current master index (will be updated)
- `.docs/adr/` - Architecture decisions (not affected)
- `.docs/governance/` - Governance logs (not affected)
- `AGENTS.md` - Project context (not affected)

---

## Notes for Future Sessions

### Why This Duplication Happened
1. **Rapid planning cycle** - Multiple documents created in parallel
2. **Different purposes** - Summary vs detailed vs progress tracking
3. **No consolidation phase** - Documents accumulated without review
4. **Lack of organization** - All files in one folder, no structure

### How to Prevent Future Duplication
1. **Enforce folder structure** - Week/feature folders keep docs organized
2. **Clear document purposes** - Each file has single, distinct purpose
3. **Regular consolidation** - Monthly review of new documents
4. **Naming conventions** - Use consistent prefixes (week2-, FE-005-, etc.)
5. **Archive completed tasks** - Move task guides out of active planning

---

**Analysis Complete:** 2026-01-28  
**Analyst:** Product Owner  
**Status:** ✅ Ready for Implementation  
**Recommended Timeline:** Execute during cleanup task (90 minutes)
