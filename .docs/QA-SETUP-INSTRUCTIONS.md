# QA Test Setup Instructions: PR #249

**Date**: 2026-02-12  
**Target**: Execute 80 test scenarios from `.docs/QA-PR249-TEST-PLAN.md`  
**Duration**: Feb 13-14 (approximately 9 hours)  

---

## 🚀 Quick Start (15 minutes)

### Step 1: Verify Environment (5 min)

```bash
cd /home/chrissim/Projects/Antpolis/yacc-client

# Check Docker services
docker ps | grep -E "postgres|redis|mailhog"
# Expected: 3 containers running

# Verify pnpm
pnpm --version
# Expected: 9.0.0+

# Check git status
git status
# Expected: On branch feature/FE-P2-frontend-ui, working tree clean
```

### Step 2: Install Dependencies (5 min)

```bash
pnpm install
# Wait for completion (~2-3 min)
```

### Step 3: Start Dev Servers (5 min)

```bash
# Terminal 1: Backend
pnpm --filter @yacc/backend dev

# Terminal 2: Frontend (in new terminal)
pnpm --filter @yacc/frontend dev

# Wait for messages:
# Backend: "✓ Server running at http://localhost:3000"
# Frontend: "VITE v4.0.18  ready in 1234 ms"
```

**URLs**:
- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- MailHog: http://localhost:8025

---

## 🔐 Test Users Setup (10 minutes)

### Create Test Users via API

Run in sequence (using curl or Postman):

#### 1. Super Admin User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "super_admin@test.com",
    "password": "TestPassword123!",
    "name": "Super Admin"
  }'

# Response: { success: true, user: { id: "...", email: "super_admin@test.com", role: "super_admin" } }
```

#### 2. Admin User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "TestPassword123!",
    "name": "Admin User"
  }'
```

#### 3. Manager User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@test.com",
    "password": "TestPassword123!",
    "name": "Manager User"
  }'
```

#### 4. Regular User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@test.com",
    "password": "TestPassword123!",
    "name": "Regular User"
  }'
```

**Note**: Adjust roles in database if registration endpoint doesn't support role selection.

---

## 📊 Test Data Seeding (10 minutes)

### Seed Sample Data

Login as super_admin@test.com first, then run:

#### Create Tags
```bash
# Tag 1: Bug
curl -X POST http://localhost:3000/api/tags \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Bug", "color": "#dc2626" }'

# Tag 2: Feature
curl -X POST http://localhost:3000/api/tags \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Feature", "color": "#2563eb" }'

# Tag 3: Urgent
curl -X POST http://localhost:3000/api/tags \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Urgent", "color": "#ea580c" }'
```

#### Create Conversations (if not auto-created)
- Via Telegram: Send messages to monitored groups
- Via IRC: Connect and send messages to monitored channels
- Or create directly via backend (if API exists)

#### Create Routing Rules
```bash
# Rule 1: Auto-tag bugs
curl -X POST http://localhost:3000/api/routing-rules \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Auto-tag bugs",
    "conditions": [
      { "type": "keyword", "operator": "contains", "value": "bug" }
    ],
    "actions": [
      { "type": "tag", "tagId": "<tag-id-of-bug>" }
    ],
    "status": "active",
    "priority": 1
  }'
```

---

## 🧪 Test Execution Approach

### Manual E2E Testing (Preferred for QA)

1. **Open Browser**: Navigate to http://localhost:5173
2. **Login**: Use test user email/password
3. **Navigate**: Test each feature area
4. **Log Results**: Document in `.docs/QA-EXECUTION-LOG.md`
5. **Report Defects**: File GitHub issues with screenshots

### Automated Testing (Optional)

```bash
# Run Playwright E2E tests (if available)
pnpm --filter @yacc/frontend test:e2e

# Run specific test file
pnpm --filter @yacc/frontend test:e2e -- AuditLogsPage.spec.ts
```

---

## 📋 Test Execution Checklist

### Pre-Testing (30 min)
- [ ] Docker services running (postgres, redis, mailhog)
- [ ] Backend dev server running (port 3000)
- [ ] Frontend dev server running (port 5173)
- [ ] 4 test users created (super_admin, admin, manager, user)
- [ ] Test data seeded (tags, conversations, rules)
- [ ] Execution log opened and ready for notes

### Testing (8-9 hours)

**Priority 1 (4-5 hours - Must Pass)**:
- [ ] RBAC enforcement (8 scenarios) - 1 hour
- [ ] Audit Logs page (8 scenarios) - 1 hour
- [ ] Assignments (10 scenarios) - 1.5 hours
- [ ] Bulk Actions (8 scenarios) - 1.5 hours

**Priority 2 (2-3 hours - Should Pass)**:
- [ ] Routing Rules (6 scenarios) - 0.5 hours
- [ ] Tags (6 scenarios) - 0.5 hours
- [ ] Notes (6 scenarios) - 0.5 hours
- [ ] Status management (4 scenarios) - 0.5 hours
- [ ] Conversation integration (4 scenarios) - 0.5 hours

**Priority 3 (1-2 hours - Optional)**:
- [ ] Error scenarios (5 scenarios) - 0.5 hours
- [ ] UI/UX checks (5 scenarios) - 0.5 hours
- [ ] Performance (10 scenarios) - 0.5 hours

### Post-Testing (30 min)
- [ ] All results logged in `.docs/QA-EXECUTION-LOG.md`
- [ ] Defects filed as GitHub issues (if any)
- [ ] QA sign-off completed
- [ ] Pass rate calculated

---

## 📝 Test Execution Template

For each test scenario:

```markdown
### [Test ID]: [Test Name]

**Preconditions**:
- User: [role]
- Data: [setup needed]

**Steps**:
1. Login as [role]
2. Navigate to [page]
3. Perform [action]
4. Verify [expected result]

**Expected Result**:
✅ [What should happen]

**Actual Result**:
✅ / ❌ [What actually happened]

**Status**: ✅ PASS / ❌ FAIL / ⏳ PENDING / ⊘ SKIPPED

**Notes**: [Any observations or defects]
```

---

## 🐛 Defect Logging Template

When you find an issue:

```markdown
### Defect: [Short Title]

**Severity**: Critical | High | Medium | Low
**PR**: #249
**Feature**: [Feature area]

**Description**:
[What is broken]

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Result**:
[What should happen]

**Actual Result**:
[What actually happens]

**Screenshot/Video**:
[Attach if possible]

**Environment**:
- Browser: [Chrome/Firefox/Safari]
- OS: [Linux/Mac/Windows]
- User Role: [super_admin/admin/manager/user]

**Impact**:
[How does this affect users]
```

---

## ✅ Success Criteria

### Pass/Fail Decision

- **✅ PASS PR for Merge**: ≥75/80 tests pass (93%+)
  - All Priority 1 tests must pass
  - Critical/High defects must be fixed
  - Low-severity issues can be tech debt

- **⚠️ CONDITIONAL PASS**: 70-75 tests pass
  - Critical/High defects must be fixed
  - Re-test after fixes
  - Document deferred low-priority issues

- **❌ FAIL - BLOCK MERGE**: <70 tests pass
  - Critical/High blockers identified
  - Must be fixed before re-testing
  - Cannot merge until resolved

---

## 🔗 Quick Links

- **Test Plan**: `.docs/QA-PR249-TEST-PLAN.md` (80 scenarios)
- **Execution Log**: `.docs/QA-EXECUTION-LOG.md` (update as you test)
- **PR**: https://github.com/csim-sg/yacc/pull/249
- **Backend API**: `.docs/02-api-and-data-model.md`
- **Feature Spec**: `.docs/01-product-specification.md`

---

## 📞 Support

**Issues during testing**:
1. Check backend logs: `docker logs yacc-client-postgres-1`
2. Check frontend console: DevTools → Console tab
3. Check network requests: DevTools → Network tab
4. Review `.docs/05-quick-reference.md` for troubleshooting

**Questions**:
- API Questions: See `.docs/02-api-and-data-model.md`
- Feature Questions: See `.docs/01-product-specification.md`
- Architecture: See `.docs/03-implementation-guide.md`

---

## ⏰ Timeline

- **Feb 13 (Day 1)**: Priority 1 execution (4-5 hours)
- **Feb 13 (Evening)**: Priority 2 execution (2-3 hours)
- **Feb 14 (Day 2)**: Priority 3 + defect verification (1-2 hours)
- **Feb 14 (Afternoon)**: QA sign-off + final report

---

**Status**: Ready to begin QA execution  
**Date**: 2026-02-12  
**Test Lead**: [Your Name]

