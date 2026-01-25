# 🚀 BE-004: FORGOT PASSWORD - START HERE

**Branch**: `feature/BE-004-forgot-password`  
**Status**: ✅ Ready to Code  
**Date**: January 25, 2026  
**Estimated Time**: 6 hours  

---

## 📍 You Are Here

You're on the **`feature/BE-004-forgot-password`** branch, which contains all planning documentation for implementing the Forgot Password feature.

**Current State**:
- ✅ All requirements documented
- ✅ Complete implementation guide (code examples)
- ✅ All test cases defined
- ✅ Success criteria clear
- ✅ 39-item todo list ready
- ⏳ **Ready for you to START CODING**

---

## 📋 What to Read First (30 minutes)

### Step 1: Quick Overview (15 min)
**File**: `.docs/plans/BE-004-READY-TO-START.md`

Read this first. It has:
- 5-step quick start guide
- 7 acceptance criteria summary
- Task overview and dependencies
- Success criteria (definition of done)
- Common mistakes to avoid

### Step 2: Detailed Guide (30 min)
**File**: `.docs/plans/BE-004-forgot-password-development-guide.md`

This is your complete reference. It contains:
- Full technical implementation (code examples)
- Database schema design
- Service and controller code (copy-paste ready)
- Test examples (unit + integration)
- 5 manual testing scenarios
- Common pitfalls and solutions

### Step 3: Code Constraints (10 min)
**File**: `AGENTS.md` → Section "Your Preferences & Constraints"

This defines HOW to code:
- No `any` types
- Flat folder structure
- One definition per file
- Routing-Controllers patterns
- Testing standards (≥85% coverage)

### Step 4: Reference Implementation (15 min)
**File**: Look at BE-003 implementation

See how BE-003 (BetterAuth) was implemented:
- `packages/backend/src/services/auth.service.ts`
- `packages/backend/src/middleware/routing-controllers-auth.ts`
- `packages/backend/src/config/auth.ts`

You'll use the same patterns for BE-004.

---

## 🎯 What You're Building

### Two Endpoints

**1. POST /auth/forgot-password**
```
Request: { "email": "user@example.com" }
Response: { "message": "If the email exists, a password reset link has been sent" }
Status: ALWAYS 200 (even if email doesn't exist - prevents enumeration)
```

**2. POST /auth/reset-password**
```
Request: { 
  "token": "64-char-hex-string", 
  "newPassword": "NewPassword123!" 
}
Response: { "success": true, "message": "Password reset successfully" }
Status: 200 if valid, 400 if invalid/expired/used
```

### Key Features

✅ **Security**:
- Email enumeration prevention (always return 200)
- Token hashing with bcrypt
- 60-minute token expiration
- Token reuse prevention
- Audit logging

✅ **Database**:
- New `password_reset_tokens` table
- Store hashed tokens (not raw tokens)
- Track creation and expiration
- Mark used tokens

✅ **Testing**:
- Unit tests for token generation/validation
- Integration tests for endpoints
- Manual testing with Postman
- ≥85% code coverage

---

## 🛠️ Files You Need to Create

### Backend Service Files
```
packages/backend/src/
├── services/
│   ├── password-reset.service.ts (NEW - 350 lines)
│   └── email.service.ts (NEW - 40 lines, mock)
├── controllers/
│   └── password-reset.controller.ts (NEW - 180 lines)
└── types/
    └── password-reset.types.ts (NEW)
```

### Shared Package Files
```
packages/common/src/
├── db/
│   └── schema.ts (UPDATE - add table)
├── types/
│   └── password-reset.types.ts (NEW)
└── schemas/
    └── password-reset.schema.ts (NEW)
```

### Test Files
```
packages/backend/tests/
├── password-reset.service.test.ts (NEW - 300 lines)
└── password-reset.controller.test.ts (NEW - 200 lines)
```

---

## 📊 39-Item Todo List

Your complete development checklist is organized in 7 phases:

1. **Pre-Development** (2 items) - Review requirements
2. **Setup** (6 items) - Create files and database
3. **Implementation** (8 items) - Write service and controller
4. **Testing** (8 items) - Unit tests, integration tests, manual testing
5. **Documentation** (4 items) - Update API docs
6. **Review & Merge** (7 items) - Create PR and merge
7. **Finalization** (2 items) - Update planning docs

You can use the `mcp_todoread` tool to view your todo list anytime.

---

## ✅ Acceptance Criteria (AC)

Your task has 7 core acceptance criteria:

| AC # | Requirement | Details |
|------|-------------|---------|
| AC1 | Forgot Password Endpoint | POST /auth/forgot-password returns 200 always |
| AC2 | Token Generation | 64-char hex, 60min TTL, stored as bcrypt hash |
| AC3 | Reset Password Endpoint | POST /auth/reset-password with token validation |
| AC4 | Token Validation | Verify not expired, not used, not invalid |
| AC5 | Password Reset | Update password, mark token used, log event |
| AC6 | Email Mock | Console.log email (temporary, per GOV-008) |
| AC7 | Audit Logging | Log all password reset events |

See `.docs/plans/BE-004-forgot-password-development-guide.md` for detailed AC explanations.

---

## 🚀 Quick Start (5 steps)

### Step 1: Prepare Your Environment
```bash
# You're already on the feature branch
git branch  # Should show: * feature/BE-004-forgot-password

# Make sure Docker is running (PostgreSQL, Redis)
docker-compose up -d

# Verify dependencies
npm install  # If needed
```

### Step 2: Create Files
Create these empty files (you'll fill them in step 3-5):

```bash
# Backend service files
touch packages/backend/src/services/password-reset.service.ts
touch packages/backend/src/services/email.service.ts
touch packages/backend/src/controllers/password-reset.controller.ts
touch packages/backend/src/types/password-reset.types.ts

# Common package files
touch packages/common/src/types/password-reset.types.ts
touch packages/common/src/schemas/password-reset.schema.ts

# Test files
touch packages/backend/tests/password-reset.service.test.ts
touch packages/backend/tests/password-reset.controller.test.ts
```

### Step 3: Update Database Schema
Open `packages/common/src/db/schema.ts` and add the password reset tokens table (see development guide for full code).

Create migration:
```bash
npm run db:generate -- --name add_password_reset_tokens
npm run db:migrate
```

### Step 4: Implement Services & Controllers
Copy code from `.docs/plans/BE-004-forgot-password-development-guide.md`:

1. `PasswordResetService` → `packages/backend/src/services/password-reset.service.ts`
2. `PasswordResetController` → `packages/backend/src/controllers/password-reset.controller.ts`
3. Email mock → `packages/backend/src/services/email.service.ts`
4. Type definitions → `packages/common/src/types/password-reset.types.ts`
5. Zod schemas → `packages/common/src/schemas/password-reset.schema.ts`

### Step 5: Write Tests & Manual Test
1. Unit tests → `packages/backend/tests/password-reset.service.test.ts`
2. Integration tests → `packages/backend/tests/password-reset.controller.test.ts`
3. Run: `npm run test`
4. Manual testing with Postman (5 scenarios in development guide)

---

## 🧪 Testing Checklist

### Unit Tests (Service)
- [ ] Token generation (format, length, expiration)
- [ ] Token validation (valid, expired, invalid, used)
- [ ] Password reset (successful, errors)
- [ ] Coverage ≥85%

### Integration Tests (Controller)
- [ ] Forgot password endpoint (valid email, non-existent)
- [ ] Reset password endpoint (valid token, expired, invalid, used)
- [ ] Error responses (400 for invalid input)
- [ ] Coverage ≥85%

### Manual Tests (Postman)
- [ ] Test 1: Forgot password with valid email
- [ ] Test 2: Forgot password with non-existent email (enum prevention)
- [ ] Test 3: Reset password with valid token
- [ ] Test 4: Reset password with expired token
- [ ] Test 5: Reset password with already-used token

---

## 📝 Commits Strategy

Keep commits focused and descriptive:

```bash
# Database schema
git commit -m "feat(auth): add password_reset_tokens table to schema"

# Service implementation
git commit -m "feat(auth): implement PasswordResetService with token management"

# Controller implementation
git commit -m "feat(auth): implement password reset endpoints"

# Email service mock
git commit -m "feat(auth): add email service mock (console.log)"

# Tests
git commit -m "test(auth): add unit tests for password reset"
git commit -m "test(auth): add integration tests for password reset endpoints"

# Documentation
git commit -m "docs(auth): update API documentation for password reset"
```

---

## 🎯 Success Criteria

Your task is **DONE** when:

✅ **Code**
- [ ] Both endpoints implemented and working
- [ ] Token generation (64-char hex, 60min TTL)
- [ ] Token validation (expiration, reuse prevention)
- [ ] Password reset updates database
- [ ] Email mock working (console.log)
- [ ] Audit logging implemented

✅ **Tests**
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Code coverage ≥85%
- [ ] Manual testing passes all 5 scenarios

✅ **Quality**
- [ ] No `any` types
- [ ] Flat folder structure
- [ ] One definition per file
- [ ] Follows AGENTS.md constraints

✅ **PR & Review**
- [ ] PR created with clear description
- [ ] Test coverage summary included
- [ ] Architect review requested
- [ ] All feedback addressed
- [ ] PR merged to dev

---

## 📚 Key Documents on This Branch

### Required Reading
1. `.docs/plans/BE-004-READY-TO-START.md` (394 lines)
   - Quick start guide, success criteria, common mistakes

2. `.docs/plans/BE-004-forgot-password-development-guide.md` (1,111 lines)
   - Complete implementation guide with code examples

### Reference Documents
3. `AGENTS.md` - Project preferences and constraints
4. `packages/backend/AGENTS.md` - Backend patterns
5. `.docs/plans/week1-product-owner-review.md` - Requirements detail

---

## 🔗 Helpful Links

### During Development
- **Implementation Guide**: `.docs/plans/BE-004-forgot-password-development-guide.md`
- **Code Patterns**: Look at BE-003 (`services/auth.service.ts`, etc)
- **Constraints**: `AGENTS.md` → "Code Architecture Constraints"

### When Stuck
- **Common Issues**: See development guide → "Common Issues & Solutions"
- **Pitfalls**: See `.docs/plans/BE-004-READY-TO-START.md` → "Common Mistakes to Avoid"
- **Help**: Contact architect via GitHub issue or PR comment

---

## ⏱️ Timeline

### Day 1 (or Today)
- [ ] Read `.docs/plans/BE-004-READY-TO-START.md` (15 min)
- [ ] Read `.docs/plans/BE-004-forgot-password-development-guide.md` (30 min)
- [ ] Review BE-003 implementation (15 min)
- [ ] Create files and database schema (30 min)

### Day 2 (Continued or Next Day)
- [ ] Implement PasswordResetService (1-1.5 hours)
- [ ] Implement PasswordResetController (45 min)
- [ ] Implement Email service mock (15 min)

### Day 2-3 (Testing & Polish)
- [ ] Write unit tests (45 min)
- [ ] Write integration tests (45 min)
- [ ] Manual testing with Postman (30 min)
- [ ] Fix any issues (30 min)

### Day 3-4 (PR & Review)
- [ ] Update documentation (30 min)
- [ ] Create PR with description (15 min)
- [ ] Wait for architect review (variable)
- [ ] Address feedback and merge (30 min)

---

## 🚨 Important Notes

### Email is Mocked
Per GOV-008, emails are mocked with `console.log`. This is temporary until BE-025 (Email Service) is complete. Don't try to send real emails yet.

### Token Security
- Never log raw tokens
- Only store bcrypt hashes
- Always compare with `bcrypt.compare()` (timing-safe)
- Never reveal why token is invalid (prevents enumeration)

### Database Migrations
Create migrations for the new `password_reset_tokens` table:
```bash
npm run db:generate -- --name add_password_reset_tokens
npm run db:migrate
```

### Reuse Code from Guide
The development guide has complete, working code examples. You can copy-paste:
- `PasswordResetService` class (350 lines)
- `PasswordResetController` class (180 lines)
- Test examples (unit + integration)

Just adapt to your project structure if needed.

---

## 🎓 What You'll Learn

By completing BE-004:
1. Security patterns (token management, enumeration prevention)
2. Service architecture (dependency injection, business logic)
3. Controller patterns (Express routing-controllers)
4. Testing strategies (unit + integration)
5. Database design (migrations, relationships)
6. TypeScript (proper typing, no `any`)
7. Git workflow (branching, commits, PR review)

---

## 📞 Quick Reference

### Git Commands
```bash
# Check which branch you're on
git branch

# See your commits
git log --oneline -10

# Stage changes
git add <files>

# Commit
git commit -m "Your message"

# Push to remote (when ready)
git push origin feature/BE-004-forgot-password

# Create PR (from GitHub web interface)
```

### Running Tests
```bash
# Run all tests
npm run test

# Run with coverage
npm run test:coverage

# Run specific test file
npm run test -- password-reset.service.test.ts

# Watch mode
npm run test:watch
```

### Database
```bash
# Create migration
npm run db:generate -- --name add_password_reset_tokens

# Run migrations
npm run db:migrate

# Open Drizzle Studio (optional)
npm run db:studio
```

---

## 💪 You've Got This!

You have everything you need:
- ✅ Clear requirements (7 ACs)
- ✅ Complete implementation guide (code examples)
- ✅ Test strategy (examples provided)
- ✅ Code constraints (AGENTS.md)
- ✅ Reference implementation (BE-003)
- ✅ Success criteria (definition of done)

**Start with reading `.docs/plans/BE-004-READY-TO-START.md` and you're on your way!**

---

**Branch**: `feature/BE-004-forgot-password`  
**Status**: Ready to Code  
**Created**: January 25, 2026  
**Good luck! 🚀**
