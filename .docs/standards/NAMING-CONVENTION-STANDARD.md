# YACC Naming Convention Standard

**Effective Date**: February 1, 2026  
**Status**: ENFORCED VIA ADR-011  
**Audience**: All Developers (Backend, Frontend, QA)  

---

## Quick Reference

| Category | Convention | Example | File/Dir |
|----------|-----------|---------|----------|
| **File Names** | `camelCase` | `messageStatusTracker.ts` | 📄 |
| **Directory Names** | `kebab-case` (preserve current) | `src/auth-handlers` | 📁 |
| **Classes** | `PascalCase` | `class AuthService {}` | 🏷️ |
| **Interfaces** | `PascalCase` | `interface UserRequest {}` | 🏷️ |
| **Types** | `PascalCase` | `type UserRole = 'admin'` | 🏷️ |
| **Constants** | `UPPER_SNAKE_CASE` | `const MAX_RETRIES = 3` | 🏷️ |
| **Variables** | `camelCase` | `const userId = 123` | 🏷️ |
| **Functions** | `camelCase` | `function sendMessage() {}` | 🏷️ |
| **React Components** | `camelCase` file, `PascalCase` export | `loginForm.tsx` exports `LoginForm` | 📄 |
| **React Hooks** | `camelCase` | `useMessages.ts` exports `useMessages` | 📄 |

---

## By Package

### Backend (`packages/backend/src/`)

```
✅ Controllers (camelCase)
   - auth.controller.ts → export class AuthController { }
   - conversations.controller.ts → export class ConversationsController { }

✅ Services (camelCase)
   - auth.service.ts → export class AuthService { }
   - conversation.service.ts → export class ConversationService { }
   - messageStatusTracker.ts → export class MessageStatusTracker { }

✅ Middleware (kebab-case files - preserve)
   - auth-betterauth.middleware.ts
   - correlation-id.middleware.ts
   - request-logging.middleware.ts
   - routing-controllers-auth.ts

✅ Config (camelCase)
   - db.ts → const dbConfig = { }
   - redis.ts → const redisConfig = { }
   - auth.ts → const authConfig = { }

✅ Decorators (kebab-case files - preserve)
   - require-role.decorator.ts
   - require-permission.decorator.ts

✅ Types (camelCase)
   - auth.types.ts
   - express.d.ts
   - password-reset.schema.ts

✅ Connectors (camelCase - to be standardized)
   - connectors/base/baseConnector.ts
   - connectors/base/connectorFactory.ts

✅ WebSockets (camelCase)
   - websockets/wsConstants.ts

✅ Workers (camelCase)
   - workers/messageRetryWorker.ts
```

### Frontend (`packages/frontend/src/`)

```
✅ Components (camelCase files)
   - components/header.tsx → export function Header() { }
   - components/loginForm.tsx → export function LoginForm() { }
   - components/navigation.tsx → export function Navigation() { }
   - components/protectedRoute.tsx → export function ProtectedRoute() { }

✅ Contexts (camelCase files)
   - contexts/authContext.tsx → export const AuthContext = ...

✅ Pages (camelCase files)
   - pages/inboxPage.tsx → export function InboxPage() { }
   - pages/conversationPage.tsx → export function ConversationPage() { }
   - pages/loginPage.tsx → export function LoginPage() { }
   - pages/registerPage.tsx → export function RegisterPage() { }

✅ Hooks (camelCase)
   - hooks/useMessages.ts → export const useMessages = () => { }
   - hooks/useSocket.ts → export const useSocket = () => { }
   - hooks/useConversations.ts → export const useConversations = () => { }

✅ Services (camelCase)
   - services/auth.service.ts → export class AuthService { }
   - services/conversations.service.ts → export class ConversationsService { }

✅ Stores (camelCase)
   - stores/auth.store.ts → export const useAuthStore = ...

✅ API (camelCase)
   - api/client.ts
   - api/error-handler.ts
   - api/schemas.ts

✅ Lib (camelCase)
   - lib/api-client.ts
   - lib/query-client.ts
   - lib/socket.ts
   - lib/navigation.ts

✅ Root (camelCase)
   - app.tsx → export function App() { }
   - main.tsx
```

### Common (`packages/common/src/`)

```
✅ Constants (camelCase files, UPPER_SNAKE_CASE exports)
   - constants/errors.constant.ts → export const ERROR_CODES = { }

✅ Schemas (camelCase files)
   - schemas/loginRequest.schema.ts
   - schemas/sendMessageRequest.schema.ts
   - schemas/routingRule.schema.ts

✅ Types (camelCase files)
   - types/auth.types.ts
   - types/message.types.ts

✅ Requests (camelCase files)
   - requests/passwordReset.request.ts

✅ Responses (camelCase files)
   - responses/passwordReset.response.ts
```

---

## Style Guide Rules

### ✅ DO

```typescript
// ✅ File: messageRetryWorker.ts
export class MessageRetryWorker {
  async retryMessages() { }
}

// ✅ File: useMessages.ts
export const useMessages = () => {
  const [messages, setMessages] = useState([]);
  return { messages };
};

// ✅ File: authContext.tsx
export const AuthContext = createContext<AuthContextType>(null);

// ✅ File: conversationPage.tsx
export function ConversationPage() {
  return <div>Conversation</div>;
}

// ✅ Constants use UPPER_SNAKE_CASE
const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT = 5000;
```

### ❌ DON'T

```typescript
// ❌ File: MessageRetryWorker.ts (PascalCase file)
// ❌ File: UseMessages.ts (PascalCase hook)
// ❌ File: AuthContext.tsx (should be authContext.tsx)
// ❌ File: ConversationPage.tsx (should be conversationPage.tsx)

// ❌ Variables use camelCase, not PascalCase
const MaxRetries = 3;  // ❌ Wrong
const MAX_RETRIES = 3; // ✅ Correct

// ❌ File: message-retry-worker.ts (kebab-case)
// Only middleware/decorators use kebab-case for specific patterns
```

---

## Implementation Timeline

### Phase 1: Enforce Going Forward (NOW)
- Update `eslint.config.js` with camelCase-only rule
- All NEW files MUST follow camelCase
- ESLint flags violations on commits

### Phase 2: Backend Refactoring (Week of Feb 3)
**5 files to rename:**
- `BaseConnector.ts` → `baseConnector.ts`
- `ConnectorFactory.ts` → `connectorFactory.ts`
- `MessageStatusTracker.ts` → `messageStatusTracker.ts`
- `WSConstants.ts` → `wsConstants.ts`
- Verify `messageRetryWorker.ts` is correct

### Phase 3: Frontend Refactoring (Week of Feb 10)
**17 files to rename:**
- All `.tsx` components to camelCase
- All page files to camelCase
- All context files to camelCase

### Phase 4: Common Package Refactoring (Week of Feb 17)
- Standardize schema, type, and constant files to camelCase

### Phase 5: Test Files (Ongoing)
- Ensure all test files follow same convention
- Update references in test configurations

---

## ESLint Configuration

### Current (PERMISSIVE)
```javascript
'unicorn/filename-case': [
  'error',
  {
    cases: {
      kebabCase: true,   // ✅ Allowed
      camelCase: true,   // ✅ Allowed
      pascalCase: true,  // ✅ Allowed
    },
  },
],
```

### After Phase 1 (ENFORCED)
```javascript
'unicorn/filename-case': [
  'error',
  {
    cases: {
      camelCase: true,   // ✅ ONLY option
      kebabCase: false,
      pascalCase: false,
    },
    ignore: [
      'vite.config.ts',
      'vitest.config.ts',
      'playwright.config.ts',
      'drizzle.config.ts',
      'eslint.config.js',
      'turbo.json',
      '.eslintignore',
    ],
  },
],
```

---

## Common Questions

### Q: What about kebab-case for middleware/decorators?
**A**: They currently follow kebab-case and can remain so. The standard prioritizes consistency within file types. Middleware and decorators are a smaller set, and the cognitive load of changing them outweighs the benefit. Focus on the majority.

### Q: What about `index.ts` files?
**A**: `index.ts` is a special case and should not be renamed. It's a barrel export, and all directories have one.

### Q: Can I name files with underscores?
**A**: No. Use camelCase only. Example: `messageRetryWorker.ts`, not `message_retry_worker.ts`.

### Q: What if my IDE autocompletes the wrong case?
**A**: ESLint will flag it. Run `pnpm lint --fix` to attempt auto-correction (though file renames must be manual).

### Q: How do I update imports after renaming?
**A**: Most IDEs (VSCode, WebStorm) have "Rename Symbol" refactoring that updates all imports automatically. Use that instead of manual rename.

---

## Code Review Checklist

**For all new PRs:**

- [ ] All new files use `camelCase` naming
- [ ] No `PascalCase` file names (except `.config.js` files)
- [ ] No `kebab-case` files unless middleware/decorators
- [ ] Imports updated if any files were renamed
- [ ] Tests pass: `pnpm lint`

---

## Feedback & Updates

This standard is enforced by **ADR-011**. If you have questions or need exceptions:

1. Comment on [ADR-011](../adr/ADR-011-file-naming-convention-standardization.md)
2. Tag the architect for review
3. Exceptions require ADR amendment

---

**Last Updated**: January 27, 2026  
**Maintained By**: Architect  
**Next Review**: After Phase 4 completion
