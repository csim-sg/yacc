# 🚀 QUICK START: FE-001 Frontend Auth Integration (5-Minute Briefing)

**TL;DR Version for Busy Developers**

---

## What Am I Building?

Frontend authentication integration for YACC (unified inbox app).

**In Plain English:**
- Make frontend talk to backend auth system
- Store JWT tokens safely
- Auto-refresh tokens when they expire
- Handle API errors gracefully (401, 403, 500)
- Protect routes so only logged-in users see pages
- Write tests to prove it works

---

## ⚡ 30-Second Setup

```bash
# 1. Get latest code
git checkout dev && git pull origin dev

# 2. Create your branch
git checkout -b task/FE-001-auth-integration

# 3. Start development
pnpm --filter @yacc/frontend dev        # Terminal 1
pnpm --filter @yacc/backend dev         # Terminal 2 (reference only)

# 4. Run tests
pnpm --filter @yacc/frontend test       # Check tests pass
pnpm --filter @yacc/frontend test --coverage  # Check coverage (80%+ target)
```

---

## 📋 Your 8 Tasks (In Order)

| # | Task | Time | What It Means |
|---|------|------|--------------|
| 1 | Review backend controller | 5 min | Read the backend files to understand endpoints |
| 2 | Enhance token storage | 1-2 h | Make token tracking smarter (detect expiry) |
| 3 | Add interceptors | 2-3 h | Catch API requests/responses, handle errors |
| 4 | Token refresh on 401 | 1-2 h | When token dies, get a new one automatically |
| 5 | Create Auth Context | 2-3 h | React magic for components to access auth |
| 6 | Protected routes | 1-2 h | Hide pages from non-logged-in users |
| 7 | Write tests | 2-3 h | Prove each piece works (80%+ coverage) |
| 8 | PR + manual test | 1-2 h | Test it works end-to-end, create PR |

**Total Time:** 10-12 hours

---

## 🎯 Key Files (Where You'll Work)

**Review only (don't change):**
- `packages/backend/src/controllers/simple-auth.controller.ts` — Login/logout endpoints

**Enhance (modify these):**
- `packages/frontend/src/lib/api-client.ts` — Add interceptors + token refresh
- `packages/frontend/src/services/auth.service.ts` — Clean up error handling
- `packages/frontend/src/stores/auth.store.ts` — Already decent, minor tweaks

**Create new (write from scratch):**
- `packages/frontend/src/contexts/AuthContext.tsx` — React auth provider
- `packages/frontend/src/components/ProtectedRoute.tsx` — Route protection wrapper
- `packages/frontend/src/lib/auth-interceptors.ts` — Separate interceptor logic (optional)

**Test files (create these):**
- `packages/frontend/src/**/__tests__/*.test.ts` — Unit tests for all the above

---

## ✨ Critical Rules (Don't Forget!)

❌ **Forbidden:**
- No `any` types in TypeScript (strict mode on)
- No nested folder structures (`src/auth/services/` is bad)
- No barrel exports (`index.ts` that re-exports everything)

✅ **Required:**
- Flat folder structure (services/, lib/, contexts/, components/ at same level)
- 80%+ code coverage for new code
- All tests passing
- Clear commit messages with issue reference (#35)

---

## 🔥 What Not to Do (Common Mistakes)

### Mistake 1: Infinite 401 Loop
```typescript
// ❌ BAD: Retries forever on 401
if (response.status === 401) {
  const newToken = await refresh();
  return fetch(url, { headers: { auth: newToken } }); // Infinite!
}

// ✅ GOOD: Retry max 1 time
if (response.status === 401 && !retried) {
  const newToken = await refresh();
  return fetch(url, { headers: { auth: newToken }, retries: 1 });
} else {
  logout();
}
```

### Mistake 2: Multiple Refresh Requests
```typescript
// ❌ BAD: 5 requests come in, 5 refresh calls happen
if (token.expired) {
  token = await refresh(); // Called 5 times!
}

// ✅ GOOD: Only 1 refresh, others wait
let isRefreshing = false;
if (token.expired && !isRefreshing) {
  isRefreshing = true;
  token = await refresh();
  isRefreshing = false;
}
```

### Mistake 3: Context Provider in Wrong Place
```typescript
// ❌ BAD: Provider mounted inside component (resets on navigation)
function LoginPage() {
  return (
    <AuthProvider>
      <LoginForm />
    </AuthProvider>
  );
}

// ✅ GOOD: Provider at root level
function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}
```

---

## 🧪 Testing Checklist

**Run these before PR:**
```bash
# All tests pass
pnpm --filter @yacc/frontend test

# Coverage is 80%+
pnpm --filter @yacc/frontend test --coverage
# Look for: "Lines   : 80% ( ... / ... )"

# No TypeScript errors
pnpm --filter @yacc/frontend lint

# Manual test:
# 1. Go to login page
# 2. Enter credentials
# 3. See success message
# 4. Log out
# 5. Try to access protected page (redirects to login)
```

---

## 📤 PR Template (When Done)

```
Title: feat(FE-001): Implement Frontend Auth Integration

Body:
- ✅ JWT token management with auto-refresh
- ✅ Request/response interceptors (401/403/500)
- ✅ Auth Context + useAuth hook
- ✅ Protected Route wrapper
- ✅ Comprehensive unit tests (80%+ coverage)
- ✅ Manual E2E testing complete

Fixes #35
```

---

## 🆘 Get Stuck? Do This:

1. **Code won't compile?** → Check for `any` types (forbidden)
2. **Tests failing?** → Run `pnpm --filter @yacc/frontend test` (shows why)
3. **Need API details?** → Look at `packages/backend/src/controllers/simple-auth.controller.ts`
4. **Still stuck?** → Check `.docs/SESSION-HANDOFF-FE001-START.md` (full guide) or `.docs/SESSION-WEEK2-KICKOFF.md` (context)

---

## 🎬 After You're Done

Once PR is merged:
1. **FE-002** awaits (Login UI enhancements)
2. **FE-003** awaits (Role-based navigation)
3. Backend devs work on **BE-006/BE-007** (WebSocket + Message routing) in parallel

---

## 📊 Success Criteria (You're Done When...)

- [ ] 8 subtasks implemented
- [ ] All tests passing (80%+ coverage)
- [ ] Manual login/logout/refresh works
- [ ] No `any` types, strict TypeScript
- [ ] PR created + ready for architect review
- [ ] Zero breaking changes

---

## 💡 Pro Tips

1. **Start simple:** Get token storage working first
2. **Test as you go:** Don't wait until end to test
3. **Mock the backend:** In tests, mock fetch (don't call real API)
4. **Use TypeScript:** Let types guide you (they prevent bugs)
5. **Read existing code:** auth.service.ts and api-client.ts already have good patterns

---

**Ready? Start with Task 1: Review backend controller files. Good luck! 🚀**

Next: `cat packages/backend/src/controllers/simple-auth.controller.ts`
