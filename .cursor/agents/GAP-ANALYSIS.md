# Gap Analysis: .opencode/prompts vs .cursor/agents

## Summary

This document identifies gaps between the `.opencode/prompts/` files and the `.cursor/agents/` subagents to ensure consistency and completeness.

---

## 1. Fullstack Developer Gaps

### Missing from `.cursor/agents/fullstack-developer.md`

#### A. Detailed PR Creation Workflow
**Source**: `.opencode/prompts/fullstack-developer.md` lines 60-66

**Missing**:
- Pre-PR checklist:
  - Test run the project, ensure no breaking changes
  - Run regression tests (all must pass)
  - Ensure task has acceptance test or E2E test
- Branch naming: `task/<taskID>` (not just `feature/task-name`)
- Delegation to Architect after PR creation
- Merge to `main` branch (not `dev`) - **CONFLICT**: AGENTS.md says `dev`
- Always squash and merge PRs

#### B. Impact Analysis Workflow
**Source**: `.opencode/prompts/fullstack-developer.md` line 55

**Missing**:
- When asked to perform any request from user, check with Product Owner and Architect on impact analysis
- Let PO or Architect update the todo list

#### C. QA Delegation
**Source**: `.opencode/prompts/fullstack-developer.md` line 59

**Missing**:
- After each task done, delegate the task to QA/Test writer to write acceptance test or E2E test

#### D. Application Architecture Principles (10 Principles)
**Source**: `.opencode/prompts/fullstack-developer.md` lines 156-185

**Missing**: All 10 EA principles:
1. API-First Integration
2. Reuse Before Build
3. Cloud-Ready by Default
4. Standard Identity & Access (enterprise IAM, no custom auth)
5. Zero Trust Service Communication
6. Observability Is Mandatory (logs, metrics, traces, SLOs)
7. Secure by Design
8. Configuration Over Customization
9. Lifecycle Ownership
10. Data Access via Contract

#### E. Type vs Interface Preference
**Source**: `.opencode/prompts/fullstack-developer.md` line 98

**Missing**:
- Prefer `Type` over `Interface`

#### F. Library Requirements
**Source**: `.opencode/prompts/fullstack-developer.md` lines 82-90

**Missing/Outdated**:
- Winston (Logging) - **OUTDATED**: ADR-004 replaced Winston with Pino
- NodeMailer (Email) - Should be verified if still current

#### G. API Contract Reference
**Source**: `.opencode/prompts/fullstack-developer.md` lines 34, 40, 151

**Missing**:
- References to `.docs/api-contract.md` (but actual file is `.docs/02-api-and-data-model.md`)
- Need to clarify correct file reference

#### H. Detailed Coding Standards
**Source**: `.opencode/prompts/fullstack-developer.md` lines 73-80

**Missing details**:
- Consistent code formatting (Prettier) - mentioned but not emphasized
- Meaningful variable/function names - mentioned but not emphasized
- Modular, reusable components/services - mentioned but not emphasized
- Proper error handling and logging - mentioned but not emphasized
- Well-documented with comments where necessary - mentioned but not emphasized

#### I. Non-Goals Section
**Source**: `.opencode/prompts/fullstack-developer.md` lines 101-114

**Missing**: Explicit non-goals:
- Must not develop test related tasks
- Must not develop with PO/Architect tasks
- Must not make product/business/UX decisions without confirmation
- Must not invent or assume feature scope/AC/edge cases
- Must not change API contracts/auth rules/data models without alignment
- Must not introduce new libraries/frameworks/infrastructure without approval
- Must not redesign UX flows beyond agreed requirements
- Must not bypass/weaken auth/authorization/security
- Must not optimize prematurely
- Must not act as final decision-maker for architecture

#### J. Mandatory Clarification Rule
**Source**: `.opencode/prompts/fullstack-developer.md` lines 118-132

**Missing**: Stop & Check rule - must seek clarification when:
- Requirements ambiguous/incomplete/contradictory
- Business rules/validation logic/edge cases not defined
- API response shapes/error formats/status codes unclear
- Auth/roles/permissions implied but not documented
- UX behavior/empty states/failure handling unspecified
- Change impacts multiple layers without clear intent
- Decision could affect security/scalability/maintainability

#### K. Collaboration Details
**Source**: `.opencode/prompts/fullstack-developer.md` lines 146-152

**Missing**:
- Sync with Product Owner on feature scope, AC, UX expectations
- Escalate unclear requirements/architectural concerns to Architect
- Confirm assumptions explicitly with User before implementation
- Coordinate contract changes through `.docs/api-contract.md`
- Act as integration owner between frontend, backend, infrastructure

---

## 2. Product Owner Gaps

### Missing Subagent Entirely

**Source**: `.opencode/prompts/product-owner.md`

**Gap**: No Product Owner subagent exists in `.cursor/agents/`

**Should Create**: `product-owner.md` subagent with:
- 95% requirement coverage standard
- 10-step workflow (enforced)
- Delegation & coordination model
- Governance & approval requirements
- Collaboration model (Architect, Developers, QA)
- Enforcement rules

---

## 3. Conflicts/Inconsistencies

### A. Branch Naming
- **AGENTS.md**: `feature/task-name` or `fix/issue-name`
- **fullstack-developer.md**: `task/<taskID>`
- **Resolution needed**: Clarify which is correct

### B. Merge Target Branch
- **AGENTS.md**: Merge to `dev` branch
- **fullstack-developer.md**: Merge to `main` branch
- **Resolution needed**: Clarify which is correct (AGENTS.md seems authoritative)

### C. API Contract File Name
- **fullstack-developer.md**: `.docs/api-contract.md`
- **Actual file**: `.docs/02-api-and-data-model.md`
- **Resolution needed**: Update reference to correct file

### D. Logging Library
- **fullstack-developer.md**: Winston
- **ADR-004**: Winston replaced with Pino
- **Resolution needed**: Update to Pino

---

## 4. Recommendations

### High Priority (Fix Immediately)

1. **Update fullstack-developer subagent** with:
   - Detailed PR creation workflow
   - Impact analysis workflow
   - QA delegation step
   - Application Architecture Principles (10)
   - Type vs Interface preference
   - Non-goals section
   - Mandatory clarification rule
   - Collaboration details

2. **Fix conflicts**:
   - Clarify branch naming convention
   - Clarify merge target (`dev` vs `main`)
   - Update API contract file reference
   - Update logging library (Winston → Pino)

3. **Create Product Owner subagent**:
   - Copy from `.opencode/prompts/product-owner.md`
   - Adapt to subagent format
   - Ensure alignment with other subagents

### Medium Priority (Enhance Later)

1. Add more detailed coding standards examples
2. Add more collaboration workflow details
3. Add more examples of when to stop and clarify

### Low Priority (Nice to Have)

1. Add more examples for each principle
2. Add troubleshooting section
3. Add common pitfalls section

---

## 5. Action Items

- [ ] Update `.cursor/agents/fullstack-developer.md` with all missing sections
- [ ] Create `.cursor/agents/product-owner.md` subagent
- [ ] Resolve branch naming conflict (update fullstack-developer.md)
- [ ] Resolve merge target conflict (update fullstack-developer.md)
- [ ] Update API contract file reference
- [ ] Update logging library reference (Winston → Pino)
- [ ] Verify NodeMailer is still current library
- [ ] Cross-reference with AGENTS.md for consistency
