# File Naming Convention Standardization - Architect Review Summary

**Date**: January 27, 2026  
**Status**: PROPOSED (AWAITING APPROVAL)  
**For**: Architect Review & Decision  

---

## 📋 Quick Overview

### Problem
The codebase has **inconsistent file naming conventions**:
- Backend: 5 PascalCase files (rest camelCase)
- Frontend: 17 PascalCase files (rest camelCase)
- Common: Mixed conventions

### Solution
**Standardize all files to camelCase** (single convention across entire monorepo)

### Impact
- 22 files to rename (relatively low effort)
- 5-week phased rollout (1 hour per phase on average)
- ESLint enforcement prevents future violations

---

## 📚 Three New Documents Created

### 1. ADR-011: File Naming Convention Standardization
**Location**: `.docs/adr/ADR-011-file-naming-convention-standardization.md`

Formal architecture decision record that includes:
- Current state analysis (5 backend files, 17 frontend files)
- Rationale for camelCase standardization
- Implementation plan (5 phases)
- Enforcement mechanism (ESLint rule)
- Risks and mitigation strategies
- Approval matrix

**For**: Formal decision-making and governance

---

### 2. NAMING-CONVENTION-STANDARD.md
**Location**: `.docs/standards/NAMING-CONVENTION-STANDARD.md`

Quick reference guide for developers that includes:
- Rules by category (files, directories, classes, constants, variables)
- Examples for each package (backend, frontend, common)
- Style guide DO's and DON'Ts
- ESLint configuration (before/after)
- Common Q&A
- Code review checklist

**For**: Developer reference, onboarding, and day-to-day decisions

---

### 3. FILE-NAMING-REFACTORING-CHECKLIST.md
**Location**: `.docs/implementation/FILE-NAMING-REFACTORING-CHECKLIST.md`

Step-by-step implementation guide with:
- Phase-by-phase tasks (1-5)
- Specific files to rename (with before/after examples)
- Import update instructions
- Verification commands
- Rollback plan
- Timeline and sign-off checklist

**For**: Executing the refactoring (assign to backend/frontend/QA leads)

---

## 🎯 Files Affected

### Backend (5 files)
```
BaseConnector.ts → baseConnector.ts
ConnectorFactory.ts → connectorFactory.ts
MessageStatusTracker.ts → messageStatusTracker.ts
WSConstants.ts → wsConstants.ts
messageRetryWorker.ts ✅ (already correct)
```

### Frontend (17 files)
```
Components (4):
  Header.tsx → header.tsx
  LoginForm.tsx → loginForm.tsx
  Navigation.tsx → navigation.tsx
  ProtectedRoute.tsx → protectedRoute.tsx

Contexts (1):
  AuthContext.tsx → authContext.tsx

Pages (4):
  InboxPage.tsx → inboxPage.tsx
  ConversationPage.tsx → conversationPage.tsx
  LoginPage.tsx → loginPage.tsx
  RegisterPage.tsx → registerPage.tsx

Root (1):
  App.tsx → app.tsx
  main.tsx ✅ (already correct)
```

### Common (2-5 files - TBD)
Audit needed to identify remaining PascalCase files

---

## 🚀 Implementation Timeline

| Phase | Task | Owner | Duration | Week |
|-------|------|-------|----------|------|
| **1** | Setup ESLint rule | Architect | 1 day | Feb 3 |
| **2** | Backend files (5) | Backend Dev | 2-3 hrs | Feb 3-7 |
| **3** | Frontend files (17) | Frontend Dev | 4-6 hrs | Feb 10-17 |
| **4** | Common package | Backend/FE | 2-3 hrs | Feb 17-24 |
| **5** | Test files | QA Lead | 1-2 hrs | Ongoing |

---

## 🔒 Enforcement

### ESLint Rule Update
```javascript
'unicorn/filename-case': [
  'error',
  {
    cases: {
      camelCase: true,   // ✅ ONLY allowed
      kebabCase: false,
      pascalCase: false,
    },
  },
],
```

### CI/CD Impact
- ✅ New files: ESLint error on commit if not camelCase
- ✅ Existing violations: Will be fixed in Phase 2-4
- ✅ PRs fail if violations detected
- ✅ Clear error message shown to developers

---

## ⚠️ Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Git history fragmentation | File renames as delete+add | Squash commits, single commit per phase |
| Conflicts on active branches | Merge conflicts during refactor | Communicate dates, do refactor when no PRs active |
| Case-insensitive file systems | Developers miss issues locally | ESLint catches 100% on CI/CD |
| IDE cache stale imports | IDEs show old paths | Use IDE's "Rename Symbol" refactoring tool |

---

## ✅ Decision Criteria Met

- ✅ **Consistency**: Single rule across entire codebase
- ✅ **Maintainability**: Reduces cognitive load for developers
- ✅ **Alignment**: Matches JavaScript/TypeScript best practices (React, Express, Next.js)
- ✅ **Tooling**: Supported by ESLint, VSCode, WebStorm, TypeScript compiler
- ✅ **Team Input**: Pending feedback from Backend, Frontend, QA leads
- ✅ **Governance**: Fully documented with ADR, standard, and checklist

---

## 🎬 Next Steps for You (Architect)

### Immediate (Today)
1. [ ] Read the three documents (linked below)
2. [ ] Review file counts and effort estimates
3. [ ] Check ESLint configuration changes
4. [ ] Make decision: APPROVE / REQUEST CHANGES / DEFER

### If APPROVED
1. [ ] Sign off on ADR-011
2. [ ] Announce timeline to team (target: Phase 1 week of Feb 3)
3. [ ] Assign Phase owners:
   - Backend Lead → Phase 2 (2-3 hours, 5 files)
   - Frontend Lead → Phase 3 (4-6 hours, 17 files)
   - QA Lead → Phase 5 (1-2 hours, test files)
4. [ ] Create governance log entry (GOV-011)

### If REQUEST CHANGES
1. [ ] Document feedback in ADR-011
2. [ ] Schedule discussion with team
3. [ ] Update documents as needed
4. [ ] Re-submit for approval

### If DEFER
1. [ ] Document rationale
2. [ ] Create follow-up task
3. [ ] Archive documents for future execution

---

## 📖 Documents to Review

**All three documents are located in `.docs/`:**

1. **ADR-011** (Formal decision)
   - Path: `.docs/adr/ADR-011-file-naming-convention-standardization.md`
   - Read time: 15-20 min
   - Contains: Rationale, phases, risks, approval matrix

2. **NAMING-CONVENTION-STANDARD** (Developer reference)
   - Path: `.docs/standards/NAMING-CONVENTION-STANDARD.md`
   - Read time: 10-15 min
   - Contains: Rules, examples, Q&A, ESLint config

3. **FILE-NAMING-REFACTORING-CHECKLIST** (Execution guide)
   - Path: `.docs/implementation/FILE-NAMING-REFACTORING-CHECKLIST.md`
   - Read time: 20-30 min
   - Contains: Step-by-step tasks, verification commands, rollback plan

---

## 🏷️ Related Documents

- **ADR-005**: Infrastructure & Config Pattern (supports this decision)
- **AGENTS.md**: Project setup & standards (references naming conventions)
- **eslint.config.js**: Current linter configuration (to be updated)

---

## 💡 Key Insights

1. **Low effort**: Only 22 files across entire codebase need renaming
2. **Phase-based**: Spread over 5 weeks to avoid merge conflicts
3. **Automated enforcement**: ESLint prevents future violations automatically
4. **Risk-managed**: Rollback plan and mitigation strategies documented
5. **Team-focused**: Clear guidance for all developers post-approval

---

## 📞 Questions?

- **Architecture questions**: See ADR-011
- **Day-to-day implementation**: See NAMING-CONVENTION-STANDARD.md
- **Execution details**: See FILE-NAMING-REFACTORING-CHECKLIST.md

---

**Ready for decision?** 

Please review the three documents above and indicate your decision:
- ✅ **APPROVE** → Proceed to Phase 1 (ESLint update)
- 🔄 **REQUEST CHANGES** → Document feedback for iteration
- ⏸️ **DEFER** → Archive for future execution

---

**Document Created**: January 27, 2026  
**Prepared By**: Architect Team  
**Status**: AWAITING YOUR DECISION
