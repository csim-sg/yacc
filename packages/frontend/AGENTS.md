# YACC Frontend - Agent Guide

This is the **frontend package** for YACC. This guide supplements the root `AGENTS.md` with frontend-specific guidance.

## 📍 Location
- **Path**: `/packages/frontend/`
- **Runtime**: Browser (React 18+)
- **Framework**: TanStack Start (Next.js alternative)

## 🎯 Frontend Developer Responsibilities

### What You Build
- React SPA components (inbox, conversations, admin panel, settings)
- WebSocket client (real-time inbox updates, notifications, typing indicators)
- API integration layer (REST calls with error handling)
- State management (Zustand + TanStack Query)
- Authentication UI (login, forgot password, session management)
- E2E tests (Playwright)

### Key Dependencies
- **TanStack Start**: Full-stack React framework
- **React 18**: UI library
- **Tailwind CSS**: Utility-first styling
- **Zustand**: Client state management
- **TanStack Query**: Server state & data fetching
- **BetterAuth**: Client-side session management
- **Socket.io-client**: WebSocket client
- **Playwright**: E2E testing

## 🔧 Development Setup

### Prerequisites

```bash
node --version         # v18+
pnpm --version        # v9+ (install: npm install -g pnpm@9)
```

### First-Time Setup

```bash
# From repo root, install all workspace dependencies
pnpm install

# Or install frontend-only dependencies
pnpm --filter @yacc/frontend install
```

### Common Frontend Commands

```bash
pnpm --filter @yacc/frontend dev       # Start Vite dev server (port 5173)
pnpm --filter @yacc/frontend build     # Build for production
pnpm --filter @yacc/frontend test      # Run E2E tests (Playwright)
pnpm --filter @yacc/frontend lint      # Run ESLint

# Or from frontend directory
cd packages/frontend
pnpm dev              # Same as above
pnpm build
pnpm test
pnpm lint
```

### Backend Dependency

Frontend requires the backend API to be running:

```bash
# In one terminal: start backend
pnpm --filter @yacc/backend dev

# In another terminal: start frontend
pnpm --filter @yacc/frontend dev
```

Both will be accessible:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000

---

## 📂 Folder Structure

### Current Structure
```
packages/frontend/
├── src/
│   ├── components/     # Reusable React components
│   ├── pages/          # Page components (routes)
│   ├── stores/         # Zustand stores (state management)
│   ├── hooks/          # Custom React hooks
│   ├── services/       # API client, WebSocket, auth
│   ├── types/          # TypeScript types & interfaces
│   ├── utils/          # Utility functions
│   ├── styles/         # Global CSS, Tailwind config
│   └── app.tsx         # Root component
├── e2e/                # Playwright E2E tests
├── tests/              # Unit tests
└── package.json
```

## 🔧 Key Technical Constraints

### 1. Component Organization
```typescript
// ✅ CORRECT: One component per file
// components/inbox/conversation-list.tsx
export const ConversationList = () => {
  // ...
};

// components/inbox/conversation-item.tsx
export const ConversationItem = () => {
  // ...
};

// ❌ WRONG: Multiple components in one file
// components/inbox.tsx (DON'T DO THIS)
export const ConversationList = () => {};
export const ConversationItem = () => {};
```

### 2. TypeScript Typing (No `any`)
```typescript
// ❌ WRONG
const ConversationList = (props: any) => {
  return <div>{props.conversations.map(...)}</div>;
};

// ✅ CORRECT
interface ConversationListProps {
  conversations: Conversation[];
  onSelect: (id: string) => void;
}

const ConversationList = ({
  conversations,
  onSelect,
}: ConversationListProps) => {
  return <div>{conversations.map(...)}</div>;
};
```

### 3. State Management (Zustand)
```typescript
// stores/conversation-store.ts
import { create } from 'zustand';

interface ConversationStore {
  conversations: Conversation[];
  selected: string | null;
  setConversations: (conversations: Conversation[]) => void;
  selectConversation: (id: string) => void;
}

export const useConversationStore = create<ConversationStore>((set) => ({
  conversations: [],
  selected: null,
  setConversations: (conversations) => set({ conversations }),
  selectConversation: (id) => set({ selected: id }),
}));
```

### 4. API Integration (TanStack Query)
```typescript
// services/api-client.ts
import { useQuery, useMutation } from '@tanstack/react-query';

export const useConversations = () => {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const response = await fetch('/api/conversations');
      if (!response.ok) throw new Error('Failed to fetch');
      return response.json();
    },
  });
};

export const useSendMessage = () => {
  return useMutation({
    mutationFn: async (payload: SendMessagePayload) => {
      const response = await fetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Failed to send');
      return response.json();
    },
  });
};
```

### 5. WebSocket Integration (Socket.io)
```typescript
// services/websocket.ts
import { io } from 'socket.io-client';
import { useEffect } from 'react';

let socket: Socket;

export const useWebSocket = () => {
  useEffect(() => {
    socket = io(process.env.REACT_APP_WS_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socket.on('conversation:updated', (data) => {
      // Update Zustand store
      useConversationStore.setState({ conversations: data });
    });

    socket.on('message:received', (data) => {
      // Add message to state
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return socket;
};
```

## 📋 Development Workflow

### Starting a New Feature
1. Create feature branch from `dev`:
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/FE-XXX-description
   ```

2. Implement component following constraints above
3. Write tests (target ≥ 85% coverage with Jest + Playwright)
4. Create component story or E2E test
5. Create PR against `dev` with clear description
6. Wait for architect review

### Code Review Checklist (Self-Check Before PR)
- [ ] No `any` types used (all props properly typed)
- [ ] One component per file
- [ ] Zustand for client state, TanStack Query for server state
- [ ] API calls via centralized API client
- [ ] Error handling implemented
- [ ] Loading states implemented
- [ ] Tests ≥ 85% coverage
- [ ] E2E tests added for critical flows
- [ ] Clear commit messages
- [ ] `.docs/` files updated if needed

## 🧪 Testing Strategy

### Jest Unit Tests
```bash
npm run test                # Run all tests
npm run test:coverage       # Run with coverage
npm run test:watch         # Watch mode
```

### Playwright E2E Tests
```bash
npm run e2e                 # Run E2E tests
npm run e2e:ui             # Run with UI
npm run e2e:debug          # Debug mode
```

### Coverage Target
- **Minimum**: 85% for new code
- **Focus**: Critical user flows (auth, inbox, messaging)
- **Location**: `tests/` folder for unit tests, `e2e/` folder for E2E tests

## 🎨 Component Development Best Practices

### 1. Props Interface
```typescript
// ✅ CORRECT: Explicit interface
interface CardProps {
  title: string;
  children: React.ReactNode;
  onClick?: () => void;
}

export const Card = ({ title, children, onClick }: CardProps) => {
  // ...
};
```

### 2. Error Boundaries
```typescript
// ✅ CORRECT: Handle errors gracefully
export const ConversationList = () => {
  const { data, isLoading, error } = useConversations();

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorMessage error={error} />;
  if (!data) return <EmptyState />;

  return <ul>{data.map(c => <li key={c.id}>{c.title}</li>)}</ul>;
};
```

### 3. Async Data Loading
```typescript
// ✅ CORRECT: Use TanStack Query + Suspense
export const ConversationList = () => {
  const query = useConversations();

  if (query.isLoading) return <div>Loading...</div>;
  if (query.error) return <div>Error: {query.error.message}</div>;

  return (
    <ul>
      {query.data?.map(c => (
        <li key={c.id}>{c.title}</li>
      ))}
    </ul>
  );
};
```

### 4. Form Handling
```typescript
// ✅ CORRECT: Controlled components with state management
interface LoginFormProps {
  onSubmit: (email: string, password: string) => void;
}

export const LoginForm = ({ onSubmit }: LoginFormProps) => {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(email, password);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />
      <button type="submit">Login</button>
    </form>
  );
};
```

## 🔗 API Integration Patterns

### 1. Centralized API Client
```typescript
// services/api.ts
const API_BASE_URL = process.env.REACT_APP_API_URL;

export const apiClient = {
  conversations: {
    list: async () => {
      const res = await fetch(`${API_BASE_URL}/conversations`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    get: async (id: string) => {
      const res = await fetch(`${API_BASE_URL}/conversations/${id}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  },
  messages: {
    send: async (payload: SendMessagePayload) => {
      const res = await fetch(`${API_BASE_URL}/messages`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to send');
      return res.json();
    },
  },
};
```

### 2. Error Handling
```typescript
// ✅ CORRECT: Handle different error types
export const useConversations = () => {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/conversations');
        if (response.status === 401) {
          // Handle unauthorized
          throw new UnauthorizedError('Session expired');
        }
        if (response.status === 403) {
          // Handle forbidden
          throw new ForbiddenError('Access denied');
        }
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      } catch (error) {
        console.error('Failed to fetch conversations', error);
        throw error;
      }
    },
  });
};
```

## 🚀 Common Components

### Inbox Page
- Conversation list (with filters, search)
- Conversation detail view
- Message composer
- Right panel (tags, notes, assignment)

### Auth Pages
- Login page
- Forgot password page
- Reset password page

### Admin Pages
- User management
- Routing rules
- Audit logs
- Integration settings

## 📖 Documentation References

- **AGENTS.md** (root): Overall project guidance
- **02-api-and-data-model.md**: API endpoints, request/response formats, WebSocket events
- **01-product-specification.md**: User stories, UI requirements, flows
- **04-qa-and-testing.md**: Testing strategy for E2E tests

## 🔗 Frontend-Specific Links

| Document | Purpose |
|----------|---------|
| `.docs/02-api-and-data-model.md` (sections 5-6) | REST endpoints, WebSocket events |
| `.docs/01-product-specification.md` | User stories, UI flows, acceptance criteria |
| `.docs/04-qa-and-testing.md` | E2E test cases, regression suite |
| `packages/frontend/package.json` | Dependencies, build scripts |

## ⚡ Quick Commands

```bash
# Development
npm run dev                 # Start dev server with hot reload
npm run build               # Build for production
npm start                   # Run built app

# Testing
npm run test                # Run unit tests
npm run test:coverage       # Run with coverage
npm run test:watch         # Watch mode
npm run e2e                 # Run E2E tests
npm run e2e:ui             # E2E with UI
npm run e2e:debug          # Debug E2E tests

# Linting
npm run lint                # Check code style
npm run lint:fix            # Fix linting issues
```

## 🚨 Common Pitfalls

1. **Using `any` types**: Always create proper component interfaces
2. **Multiple components per file**: One component per file
3. **Mixing state management**: Use Zustand for client state, TanStack Query for server state
4. **Not handling loading/error states**: Always show loading, error, and empty states
5. **Hardcoded API URLs**: Use centralized `apiClient` with environment variables
6. **Not testing critical flows**: Add E2E tests for auth, messaging, inbox flows
7. **Forgetting correlation IDs in logs**: Include for debugging
8. **Not handling WebSocket disconnections**: Implement reconnection logic

## 💬 When to Ask for Help

- **API contract unclear**: Ask architect + backend dev
- **Component design uncertain**: Ask architect (product owner for UX feedback)
- **WebSocket event format unclear**: Ask backend dev
- **Testing strategy unclear**: Ask QA
- **Performance issues**: Ask architect

---

**Last Updated**: January 25, 2026  
**Maintained By**: Enterprise Architect  
**Status**: Active (FE-001 Ready)
