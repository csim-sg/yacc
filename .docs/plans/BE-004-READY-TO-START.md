# ✅ BE-004: FORGOT PASSWORD FLOW - READY TO START

**Status**: Ready for Development  
**Date**: January 25, 2026  
**Estimated Time**: 6 hours  
**Priority**: High (Week 1 Core Task)  
**Blocking**: None (BE-003 ✅ Complete)  

---

## 🚀 Quick Start

### 1. Start Development Now
```bash
# Make sure you're on dev branch
git checkout dev
git pull origin dev

# Create feature branch
git checkout -b feature/BE-004-forgot-password

# You're ready to code!
```

### 2. What to Build
Implement password reset functionality:
- **Endpoint 1**: `POST /api/auth/forgot-password` - Request reset email
- **Endpoint 2**: `POST /api/auth/reset-password` - Complete password reset
- **Database**: New `password_reset_tokens` table (store reset tokens)
- **Service**: `PasswordResetService` (token management)
- **Email**: Console.log mock (temporary until BE-025)

### 3. Key Files to Create
```
packages/backend/src/
├── services/password-reset.service.ts (NEW)
├── controllers/password-reset.controller.ts (NEW)
└── types/password-reset.types.ts (NEW)

packages/common/src/
├── db/schema.ts (UPDATE - add table)
├── types/password-reset.types.ts (NEW)
└── schemas/password-reset.schema.ts (NEW)

packages/backend/tests/
├── password-reset.service.test.ts (NEW)
└── password-reset.controller.test.ts (NEW)
```

### 4. Acceptance Criteria (7 Requirements)
1. ✅ POST /auth/forgot-password endpoint (always return 200)
2. ✅ Token generation (64-char hex, 60min TTL)
3. ✅ POST /auth/reset-password endpoint
4. ✅ Token validation (not expired, not used)
5. ✅ Password reset (update user, mark token used)
6. ✅ Email mock (console.log, per GOV-008)
7. ✅ Audit logging (all password reset events)

### 5. Testing Requirements
- **Unit Tests**: Token generation, validation, password reset
- **Integration Tests**: Both endpoints, error scenarios
- **Coverage**: ≥85% for all new files
- **Manual Tests**: 5 Postman scenarios

---

## 📋 39-Item Todo List

Your complete development checklist is ready in the embedded todo list. Here's the summary:

### Phases
1. **Pre-Development** (2 items) - Review requirements
2. **Setup** (6 items) - Create files and database schema
3. **Implementation** (8 items) - Write service, controller, schemas
4. **Testing** (8 items) - Unit, integration, manual tests
5. **Documentation** (4 items) - Update docs
6. **Review & Merge** (7 items) - PR, review, merge
7. **Finalization** (2 items) - Update planning documents

**Total: 39 items** - Comprehensive coverage of entire task

---

## 📊 What You Need to Know

### Technology Stack (Already Installed)
- ✅ **BetterAuth** - Authentication framework (BE-003)
- ✅ **bcryptjs** - Password hashing (BE-003)
- ✅ **Drizzle ORM** - Database (BE-003)
- ✅ **Zod** - Validation (BE-003)
- ✅ **Jest** - Testing (already in project)
- ✅ **PostgreSQL** - Database (Docker Compose)

### Key Concepts to Remember
1. **Email Enumeration Prevention**: Always return 200 (even if email doesn't exist)
2. **Token Security**: Store bcrypt hash, never expose raw token in logs
3. **Token Reuse Prevention**: Mark token as used after successful reset
4. **Audit Logging**: Log all password reset events with correlation ID
5. **Password Requirements**: Reuse existing `PasswordValidationService` (8 chars, 1 uppercase, 1 number)

### Code Patterns (From BE-003)
- Use **flat folder structure** (not layered)
- No `any` types - use proper TypeScript interfaces
- One **definition per file** (one class/service per file)
- **Config folder** = simple data objects with env vars
- **Infrastructure folder** = singleton client classes
- **Services** contain business logic
- **Controllers** handle HTTP requests/responses

### Testing Patterns (From BE-003)
- Jest for unit/integration tests
- Mock database calls in unit tests
- Test both success and error scenarios
- Target ≥85% code coverage
- Co-locate tests near source files

---

## 📖 Documentation References

### Required Reading (Before Starting)
1. **`.docs/plans/BE-004-forgot-password-development-guide.md`** (THIS FILE)
   - 1,100+ lines of detailed implementation guidance
   - Full code examples for service and controller
   - Comprehensive test examples
   - Manual testing scenarios

2. **Root `AGENTS.md` - Section "Your Preferences & Constraints"**
   - Code architecture constraints (6 STRICT rules)
   - Testing standards (≥85% coverage)
   - PR requirements
   - Workflow expectations

3. **`packages/backend/AGENTS.md`**
   - Backend-specific patterns
   - Testing requirements
   - Common pitfalls
   - Quick commands

### Reference During Development
- **`.docs/plans/week1-product-owner-review.md`** - Full AC details
- **`.docs/plans/week1-architect-review.md`** - Technical decisions
- **`AGENTS.md`** - Architecture constraints
- **`ADR-005`** - Config vs Infrastructure pattern

### Update When Done
- **`.docs/02-api-and-data-model.md`** - Add endpoints and schema
- **`.docs/03-implementation-guide.md`** - Add password reset flow
- **`.docs/plans/00-INDEX.md`** - Mark BE-004 as DONE

---

## ⏱️ Time Breakdown (6 hours total)

| Phase | Time | What |
|-------|------|------|
| Pre-Development | 1-2 hours | Read requirements, review BE-003 |
| Setup | 30 min | Create files, database schema |
| Implementation | 2-3 hours | Write service, controller, schemas |
| Testing | 1-1.5 hours | Unit tests, integration tests, Postman |
| Documentation | 30 min | Update .docs files |
| Review & Merge | 1 hour | Create PR, address feedback, merge |

**Total: 6 hours** - Can be completed in one day or split across two days

---

## 🎯 Success Criteria (Definition of Done)

Task is **DONE** when:

✅ **Implementation**
- [ ] POST /auth/forgot-password endpoint works
- [ ] POST /auth/reset-password endpoint works
- [ ] Token generation (64-char hex, 60min TTL)
- [ ] Token validation (expiration, reuse prevention)
- [ ] Password reset updates database
- [ ] Email mock sends console.log output
- [ ] Audit logging for all events

✅ **Testing**
- [ ] Unit tests pass (100%)
- [ ] Integration tests pass (100%)
- [ ] Code coverage ≥85%
- [ ] Manual testing passes all 5 Postman scenarios

✅ **Code Quality**
- [ ] No `any` types
- [ ] Flat folder structure
- [ ] One definition per file
- [ ] All code follows constraints from AGENTS.md

✅ **Documentation**
- [ ] PR description clear and references this task
- [ ] Test coverage summary in PR
- [ ] Manual test results in PR
- [ ] API docs updated
- [ ] Commit messages descriptive

✅ **Review & Merge**
- [ ] Architect review requested
- [ ] All feedback addressed
- [ ] Architect approval received
- [ ] PR merged to dev
- [ ] Planning documents updated (BE-004 → DONE)

---

## 🚨 Common Mistakes to Avoid

### Security Issues
❌ **Don't**: Return different responses for existing vs non-existing emails  
✅ **Do**: Always return 200 with same message (prevent enumeration)

❌ **Don't**: Log raw reset tokens anywhere  
✅ **Do**: Only log token hashes or generic messages

❌ **Don't**: Reuse tokens multiple times  
✅ **Do**: Mark token as used (`used_at` timestamp) after reset

❌ **Don't**: Store raw tokens in database  
✅ **Do**: Store bcrypt hash of token

### Code Quality Issues
❌ **Don't**: Put multiple classes in one file  
✅ **Do**: One class per file (service, controller separate)

❌ **Don't**: Use `any` types  
✅ **Do**: Create proper TypeScript interfaces

❌ **Don't**: Create `api/`, `domain/`, `infrastructure/` folders  
✅ **Do**: Use flat structure (controllers, services, config, infrastructure)

### Testing Issues
❌ **Don't**: Skip error scenario tests  
✅ **Do**: Test valid token, expired token, invalid token, used token

❌ **Don't**: Aim for minimal coverage (like 50%)  
✅ **Do**: Target ≥85% coverage

❌ **Don't**: Hardcode test data  
✅ **Do**: Use factories or setup functions

---

## 💬 When to Ask For Help

### Architecture Questions
- "What should this class responsibility be?"
- "Should I create a new service or add to existing?"
- "How does this fit with the overall system?"

**Answer**: Check AGENTS.md → "Code Architecture Constraints" section or ask architect

### Code Pattern Questions
- "How do I structure this service?"
- "What should the error response look like?"
- "How should I test this component?"

**Answer**: Check packages/backend/AGENTS.md or BE-003 reference implementation

### Database Questions
- "How should I model this data?"
- "Should this be in common package?"
- "How do I write the migration?"

**Answer**: Check `.docs/02-api-and-data-model.md` or ask architect

### Testing Questions
- "What scenarios should I test?"
- "How do I mock the database?"
- "How do I measure coverage?"

**Answer**: Check `.docs/04-qa-and-testing.md` or this development guide

---

## 🔗 Quick Links

### Essential Documents
- **This Guide**: `.docs/plans/BE-004-forgot-password-development-guide.md` (1,100+ lines)
- **Requirements**: `.docs/plans/week1-product-owner-review.md` (Section 3.2)
- **Architecture**: `.docs/plans/week1-architect-review.md` (Section 3)
- **Code Constraints**: `AGENTS.md` + `packages/backend/AGENTS.md`

### Code References
- **BE-003 (Completed)**: Reference authentication implementation
- **Password Validation**: `services/password-validation.service.ts` (already done)
- **BetterAuth Setup**: `config/auth.ts` (already done)
- **Database Schema**: `packages/common/src/db/schema.ts` (update here)

### Testing References
- **Test Examples**: This development guide (full test code)
- **Test Strategy**: `.docs/04-qa-and-testing.md`
- **Manual Testing**: Postman scenarios in this guide

---

## 📝 Git Workflow

```bash
# 1. Start on dev
git checkout dev
git pull origin dev

# 2. Create feature branch
git checkout -b feature/BE-004-forgot-password

# 3. Develop and commit (with descriptive messages)
git add <files>
git commit -m "feat(auth): implement password reset token generation"
git commit -m "feat(auth): implement reset password endpoint"
git commit -m "test(auth): add password reset tests"

# 4. Push to remote (when ready for PR)
git push origin feature/BE-004-forgot-password

# 5. Create PR on GitHub
# → Title: "BE-004: Implement Forgot Password Flow"
# → Description: (include test results, manual test scenarios)
# → Link: Reference this issue and AC

# 6. Wait for architect review
# → Address any feedback
# → Push fixes

# 7. Merge to dev
# → Merge via GitHub (NOT force push)

# 8. Update planning docs
# → Mark BE-004 as DONE in .docs/plans/00-INDEX.md
```

---

## ✨ Additional Notes

### Email Service (Temporary)
Your email service will use console.log for now (GOV-008 workaround). When BE-025 (Email Service) is done, replace with real email sending. The interface will stay the same, so this change is backwards compatible.

### Token Expiration
Tokens expire after 60 minutes. This is enforced in `validateToken()` by checking `expires_at > now()`. After 60 minutes, attempting to reset will return generic "Invalid or expired token" error.

### Token Reuse Prevention
Once a token is used to reset a password, it's marked with `used_at` timestamp. Any attempt to reuse it will return "Invalid or expired token" error. This prevents attackers from reusing tokens if they intercept the reset link.

### Audit Trail
All password reset events are logged:
- `password.reset_token_generated` - When user requests password reset
- `password.reset_token_validated` - When token is validated
- `password.reset_successful` - When password is successfully reset
- `password.reset_failed` - When reset fails (optional, for debugging)

### Configuration
No new environment variables needed. Everything uses existing config:
- `FRONTEND_URL` - Used to generate reset link
- `DATABASE_URL` - For token storage
- `JWT_SECRET` - Not used for password reset (separate token system)

---

## 🎓 Learning Outcomes

By completing BE-004, you'll have learned:

1. **Security Patterns**: Enumeration prevention, token management, password hashing
2. **TypeScript**: Proper typing, interfaces, no `any` types
3. **Testing Strategies**: Unit tests, integration tests, error scenario coverage
4. **Code Organization**: Flat structure, one definition per file, service/controller separation
5. **Database Design**: Schema migrations, relationships, indexes
6. **Async Programming**: Promise-based operations, error handling
7. **Code Review Process**: PR creation, feedback incorporation, git workflow

---

## 🚀 You're Ready!

Everything you need is in place:
- ✅ **Requirements** - Clear and detailed (7 ACs)
- ✅ **Technical Design** - Full implementation guide with code
- ✅ **Test Strategy** - Comprehensive test examples
- ✅ **Code Patterns** - Examples from BE-003
- ✅ **Documentation** - Complete reference materials
- ✅ **Blockers** - None (BE-003 complete)

**Start your feature branch and begin coding!**

---

**Created**: January 25, 2026  
**Status**: ✅ Ready for Development  
**Estimated Duration**: 6 hours  
**Next Task**: BE-005 (RBAC) runs in parallel, then merge this → next phase  

