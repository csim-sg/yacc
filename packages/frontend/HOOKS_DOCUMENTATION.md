# FE-004: Hooks Documentation Guide

Complete documentation for TanStack Query hooks in the YACC frontend.

**Table of Contents**
1. [Quick Start](#quick-start)
2. [Query Hooks](#query-hooks)
3. [Mutation Hooks](#mutation-hooks)
4. [Error Handling](#error-handling)
5. [Cache Management](#cache-management)
6. [Examples](#examples)
7. [API Response Types](#api-response-types)

---

## Quick Start

### Installation & Setup

All hooks are already configured with:
- **TanStack Query v5** - Data fetching and caching
- **Zod** - Runtime validation + TypeScript types
- **Fetch API** - No axios dependency (lighter)

### Basic Import

```typescript
// Query hooks
import { useConversations, useConversation, useSearchConversations } from '../hooks/useConversations';
import { useMessages, useMessage, useSearchMessages } from '../hooks/useMessages';
import { useCurrentUser, useUser, useUserProfile } from '../hooks/useUser';

// Mutation hooks
import { useSendMessage } from '../hooks/useSendMessage';
import { useAssignConversation } from '../hooks/useAssignConversation';
import { useUpdateConversationStatus } from '../hooks/useUpdateConversationStatus';

// Error handling
import { handleQueryError, handleMutationError, errorChecks } from '../api/error-handler';
```

---

## Query Hooks

### useConversations()

Fetch conversations list with filtering, pagination, and search.

**Function Signature**
```typescript
useConversations(filters?: ConversationFilters): UseQueryResult<ConversationsList, Error>
```

**Parameters**
```typescript
interface ConversationFilters {
  channel?: string;           // 'telegram', 'irc', etc.
  status?: 'open' | 'pending' | 'resolved';
  assignedUserId?: string;    // Filter by assignee
  tag?: string;               // Filter by tag name
  search?: string;            // Full-text search
  page?: number;              // 1-based page number
  limit?: number;             // Items per page (default: 20)
  sortBy?: 'createdAt' | 'lastMessageAt' | 'status';
  sortOrder?: 'asc' | 'desc';
}
```

**Returns**
```typescript
{
  data: {
    data: Conversation[];     // Array of conversations
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasMore: boolean;
    }
  };
  isLoading: boolean;         // Initial load in progress
  isPending: boolean;         // Query is loading
  isFetching: boolean;        // Refetch in progress
  error: Error | null;        // Error if occurred
  refetch: () => Promise<...>; // Manual refetch
}
```

**Cache Settings**
- **Stale Time:** 30 seconds
- **GC Time:** 5 minutes
- **Retry:** 3x exponential backoff
- **Auto Refetch:** Disabled on mount and window focus

**Example: Basic Usage**
```typescript
import { useConversations } from '../hooks/useConversations';

export function InboxList() {
  const { data, isLoading, error } = useConversations();

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div>
      {data?.data.map(conversation => (
        <ConversationItem key={conversation.id} {...conversation} />
      ))}
    </div>
  );
}
```

**Example: Filtered & Paginated**
```typescript
export function FilteredInbox() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'open' | 'pending' | 'resolved'>('open');

  const { data, isLoading } = useConversations({
    status,
    page,
    limit: 20,
    sortBy: 'lastMessageAt',
    sortOrder: 'desc',
  });

  return (
    <div>
      <select onChange={(e) => setStatus(e.target.value as any)}>
        <option value="open">Open</option>
        <option value="pending">Pending</option>
        <option value="resolved">Resolved</option>
      </select>

      {data?.data.map(conv => <ConversationItem key={conv.id} {...conv} />)}

      <button onClick={() => setPage(p => p - 1)} disabled={page <= 1}>
        Previous
      </button>
      <button onClick={() => setPage(p => p + 1)} disabled={!data?.pagination.hasMore}>
        Next
      </button>
    </div>
  );
}
```

### useConversation()

Fetch single conversation by ID.

**Function Signature**
```typescript
useConversation(conversationId?: string): UseQueryResult<Conversation, Error>
```

**Example**
```typescript
export function ConversationDetail({ conversationId }: { conversationId: string }) {
  const { data: conversation, isLoading, error } = useConversation(conversationId);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div>
      <h2>{conversation?.title}</h2>
      <p>{conversation?.status}</p>
    </div>
  );
}
```

### useSearchConversations()

Search conversations with optional filters.

**Function Signature**
```typescript
useSearchConversations(
  searchQuery?: string,
  filters?: Omit<ConversationFilters, 'search'>
): UseQueryResult<ConversationsList, Error>
```

**Example**
```typescript
export function SearchConversations() {
  const [query, setQuery] = useState('');

  const { data, isLoading } = useSearchConversations(query, {
    status: 'open',
    limit: 20,
  });

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search conversations..."
      />

      {data?.data.map(conv => (
        <ConversationItem key={conv.id} {...conv} />
      ))}
    </div>
  );
}
```

### useMessages()

Fetch messages for a conversation.

**Function Signature**
```typescript
useMessages(conversationId: string, filters?: MessageFilters): UseQueryResult<MessagesList, Error>
```

**Parameters**
```typescript
interface MessageFilters {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'status';
  sortOrder?: 'asc' | 'desc';
}
```

**Cache Settings**
- **Stale Time:** 10 seconds (more volatile than conversations)
- **GC Time:** 5 minutes
- **Retry:** 3x
- **Enabled:** Only if conversationId is provided

**Example**
```typescript
export function ConversationMessages({ conversationId }: { conversationId: string }) {
  const { data, isLoading, error } = useMessages(conversationId, {
    page: 1,
    limit: 50,
    sortBy: 'createdAt',
    sortOrder: 'asc',
  });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div className="messages">
      {data?.data.map(message => (
        <Message key={message.id} {...message} />
      ))}
    </div>
  );
}
```

### useCurrentUser()

Fetch current logged-in user.

**Function Signature**
```typescript
useCurrentUser(): UseQueryResult<User, Error>
```

**Cache Settings**
- **Stale Time:** 60 seconds
- **GC Time:** 10 minutes
- **Retry:** 3x (except 401)

**Example**
```typescript
export function UserProfile() {
  const { data: user, isLoading, error } = useCurrentUser();

  if (error?.statusCode === 401) {
    return <Redirect to="/login" />;
  }

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <h2>{user?.name}</h2>
      <p>{user?.email}</p>
      <span className="badge">{user?.role}</span>
    </div>
  );
}
```

### useUser()

Fetch specific user by ID.

**Function Signature**
```typescript
useUser(userId?: string): UseQueryResult<User, Error>
```

**Example**
```typescript
export function AssigneeCard({ userId }: { userId: string }) {
  const { data: user } = useUser(userId);

  return (
    <div className="card">
      <p>{user?.name}</p>
      <small>{user?.email}</small>
    </div>
  );
}
```

---

## Mutation Hooks

### useSendMessage()

Send a message to a conversation.

**Function Signature**
```typescript
useSendMessage(): UseMutationResult<SendMessageResponse, Error, SendMessageRequest>
```

**Request Type**
```typescript
interface SendMessageRequest {
  conversationId: string;
  body: string;
  attachmentIds?: string[];  // Optional attachment IDs
}
```

**Response Type**
```typescript
interface SendMessageResponse {
  id: string;
  conversationId: string;
  status: 'pending' | 'sent' | 'failed';
  createdAt: Date;
}
```

**Returns**
```typescript
{
  mutate: (data: SendMessageRequest) => void;      // Async callback
  mutateAsync: (data: SendMessageRequest) => Promise<SendMessageResponse>;
  isPending: boolean;                               // Mutation in progress
  isError: boolean;
  error: Error | null;
  data: SendMessageResponse | null;               // Last response
  isSuccess: boolean;
}
```

**Cache Invalidation**
On success, invalidates:
- Messages list for the conversation
- Conversation detail
- Conversations list

**Example: Using mutate()**
```typescript
export function MessageComposer({ conversationId }: { conversationId: string }) {
  const [message, setMessage] = useState('');
  const sendMessage = useSendMessage();

  const handleSend = () => {
    sendMessage.mutate({
      conversationId,
      body: message,
    },
    {
      onSuccess: () => {
        setMessage('');  // Clear input
      },
      onError: (error) => {
        console.error('Failed to send:', error);
      },
    });
  };

  return (
    <div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type message..."
        disabled={sendMessage.isPending}
      />
      <button onClick={handleSend} disabled={sendMessage.isPending}>
        {sendMessage.isPending ? 'Sending...' : 'Send'}
      </button>
      {sendMessage.error && (
        <div className="error">{sendMessage.error.message}</div>
      )}
    </div>
  );
}
```

**Example: Using mutateAsync()**
```typescript
export function MessageForm({ conversationId }: { conversationId: string }) {
  const [message, setMessage] = useState('');
  const sendMessage = useSendMessage();

  const handleSend = async () => {
    try {
      const response = await sendMessage.mutateAsync({
        conversationId,
        body: message,
      });
      console.log('Message sent:', response.id);
      setMessage('');
    } catch (error) {
      console.error('Failed:', error);
    }
  };

  return (
    <div>
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} />
      <button onClick={handleSend} disabled={sendMessage.isPending}>
        Send
      </button>
    </div>
  );
}
```

### useAssignConversation()

Assign or unassign a conversation.

**Function Signature**
```typescript
useAssignConversation(): UseMutationResult<
  AssignConversationResponse,
  Error,
  AssignConversationRequest
>
```

**Request Type**
```typescript
interface AssignConversationRequest {
  conversationId: string;
  assignedUserId: string | null;  // null to unassign
}
```

**Response Type**
```typescript
interface AssignConversationResponse {
  id: string;
  assignedUserId: string | null;
  assignedUser: User | null;
  updatedAt: Date;
}
```

**Cache Invalidation**
On success, invalidates:
- Conversation detail
- Conversations list (all filters)

**Example**
```typescript
export function AssignConversation({ conversationId, currentAssignee }: any) {
  const assignConversation = useAssignConversation();
  const [selectedUser, setSelectedUser] = useState<string | null>(currentAssignee);

  const handleAssign = (userId: string | null) => {
    assignConversation.mutate({
      conversationId,
      assignedUserId: userId,
    });
  };

  return (
    <select
      value={selectedUser || ''}
      onChange={(e) => handleAssign(e.target.value || null)}
      disabled={assignConversation.isPending}
    >
      <option value="">Unassigned</option>
      <option value="user-1">John Doe</option>
      <option value="user-2">Jane Smith</option>
    </select>
  );
}
```

### useUpdateConversationStatus()

Update conversation status.

**Function Signature**
```typescript
useUpdateConversationStatus(): UseMutationResult<
  UpdateStatusResponse,
  Error,
  UpdateConversationStatusRequest
>
```

**Request Type**
```typescript
interface UpdateConversationStatusRequest {
  conversationId: string;
  status: 'open' | 'pending' | 'resolved';
}
```

**Cache Invalidation**
On success, invalidates:
- Conversation detail
- Conversations list (all variations)

**Example**
```typescript
export function StatusSelector({ conversationId, currentStatus }: any) {
  const updateStatus = useUpdateConversationStatus();

  const handleStatusChange = (newStatus: 'open' | 'pending' | 'resolved') => {
    updateStatus.mutate({
      conversationId,
      status: newStatus,
    });
  };

  return (
    <div>
      <button onClick={() => handleStatusChange('open')}>
        {updateStatus.isPending ? 'Updating...' : 'Open'}
      </button>
      <button onClick={() => handleStatusChange('pending')}>Pending</button>
      <button onClick={() => handleStatusChange('resolved')}>Resolved</button>
    </div>
  );
}
```

---

## Error Handling

### handleQueryError()

Handle errors from query hooks.

**Function Signature**
```typescript
handleQueryError(error: unknown, context?: ErrorContext): void
```

**Error Context**
```typescript
interface ErrorContext {
  operation?: string;    // Operation name for logging
  showToast?: boolean;   // Show toast notification (default: true)
  message?: string;      // Custom error message
}
```

**Example**
```typescript
export function ConversationsList() {
  const { data, error } = useConversations();

  useEffect(() => {
    if (error) {
      handleQueryError(error, {
        operation: 'Load Conversations',
        showToast: true,
      });
    }
  }, [error]);

  // ... render component
}
```

### handleMutationError()

Handle errors from mutation hooks.

**Function Signature**
```typescript
handleMutationError(error: unknown, context?: ErrorContext): void
```

**Example**
```typescript
export function SendMessageForm({ conversationId }: any) {
  const sendMessage = useSendMessage();

  const handleSend = async (messageBody: string) => {
    try {
      await sendMessage.mutateAsync({
        conversationId,
        body: messageBody,
      });
    } catch (error) {
      handleMutationError(error, {
        operation: 'Send Message',
        showToast: true,
      });
    }
  };

  return <>{/* JSX */}</>;
}
```

### Error Type Checking

Type-safe error checking helpers:

```typescript
import { errorChecks } from '../api/error-handler';

// Check specific error types
if (errorChecks.isUnauthorized(error)) {
  // User session expired
}

if (errorChecks.isForbidden(error)) {
  // Permission denied
}

if (errorChecks.isNotFound(error)) {
  // Resource not found
}

if (errorChecks.isServerError(error)) {
  // Server error (5xx)
}

if (errorChecks.isTimeout(error)) {
  // Request timeout
}

if (errorChecks.isValidationError(error)) {
  // Validation error (422)
}

if (errorChecks.isRateLimit(error)) {
  // Rate limited (429)
}
```

---

## Cache Management

### Query Cache Keys

Cache keys are automatically managed by TanStack Query:

```typescript
import { queryKeys } from '../lib/query-client';

// Conversation cache keys
queryKeys.conversations.list()              // All conversations
queryKeys.conversations.filtered(filters)   // Filtered conversations
queryKeys.conversations.detail(id)          // Single conversation

// Message cache keys
queryKeys.messages.list(conversationId)     // Messages for conversation
queryKeys.messages.detail(messageId)        // Single message

// User cache keys
queryKeys.user.current()                    // Current user
queryKeys.user.profile(userId)              // Specific user
```

### Cache Invalidation

Mutations automatically invalidate caches:

**useSendMessage** → Invalidates:
- `messages.list(conversationId)`
- `conversations.detail(conversationId)`
- `conversations.list()`

**useAssignConversation** → Invalidates:
- `conversations.detail(conversationId)`
- `conversations.list()`
- `conversations.filtered()`

**useUpdateConversationStatus** → Invalidates:
- `conversations.detail(conversationId)`
- `conversations.list()`
- `conversations.filtered()`

### Manual Cache Invalidation

If needed, manually invalidate cache:

```typescript
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/query-client';

export function SomeComponent() {
  const queryClient = useQueryClient();

  const handleSpecialAction = async () => {
    // ... do something

    // Manually invalidate specific cache
    await queryClient.invalidateQueries({
      queryKey: queryKeys.conversations.list(),
    });
  };

  return <button onClick={handleSpecialAction}>Action</button>;
}
```

---

## Examples

### Complete Inbox Component

```typescript
import { useState } from 'react';
import { useConversations } from '../hooks/useConversations';
import { handleQueryError } from '../api/error-handler';

export function Inbox() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'open' | 'pending' | 'resolved' | 'all'>('all');
  const [search, setSearch] = useState('');

  const filters = {
    page,
    limit: 20,
    ...(status !== 'all' && { status }),
    ...(search && { search }),
  };

  const { data, isLoading, error, refetch } = useConversations(filters);

  if (error) {
    return (
      <div className="error-container">
        <p>Failed to load conversations</p>
        <button onClick={() => refetch()}>Retry</button>
      </div>
    );
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="inbox">
      <div className="controls">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search conversations..."
        />

        <select value={status} onChange={(e) => setStatus(e.target.value as any)}>
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      <div className="conversations">
        {data?.data.map(conversation => (
          <ConversationItem key={conversation.id} {...conversation} />
        ))}
      </div>

      <div className="pagination">
        <button
          onClick={() => setPage(p => p - 1)}
          disabled={page <= 1}
        >
          Previous
        </button>
        <span>Page {page} of {data?.pagination.totalPages}</span>
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={page >= (data?.pagination.totalPages || 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
```

### Complete Message Composer

```typescript
import { useState } from 'react';
import { useSendMessage } from '../hooks/useSendMessage';
import { handleMutationError } from '../api/error-handler';

export function MessageComposer({ conversationId }: { conversationId: string }) {
  const [message, setMessage] = useState('');
  const sendMessage = useSendMessage();

  const handleSend = async () => {
    if (!message.trim()) return;

    try {
      await sendMessage.mutateAsync({
        conversationId,
        body: message.trim(),
      });
      setMessage('');
    } catch (error) {
      handleMutationError(error, {
        operation: 'Send Message',
        showToast: true,
      });
    }
  };

  return (
    <div className="composer">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.ctrlKey) {
            handleSend();
          }
        }}
        placeholder="Type your message... (Ctrl+Enter to send)"
        disabled={sendMessage.isPending}
      />

      <button
        onClick={handleSend}
        disabled={sendMessage.isPending || !message.trim()}
      >
        {sendMessage.isPending ? 'Sending...' : 'Send'}
      </button>

      {sendMessage.error && (
        <div className="error-message">
          {sendMessage.error.message}
        </div>
      )}
    </div>
  );
}
```

---

## API Response Types

All responses are validated with Zod and typed via TypeScript:

```typescript
// Conversation
interface Conversation {
  id: string;
  channel: 'telegram' | 'irc';
  externalThreadId: string;
  status: 'open' | 'pending' | 'resolved';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  title?: string;
  assignedUserId?: string;
  assignedUser?: User;
  tags?: string[];
  unreadCount?: number;
  lastMessage?: Message;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Message
interface Message {
  id: string;
  conversationId: string;
  sender: Sender;
  senderId: string;
  body: string;
  status: 'pending' | 'sent' | 'failed';
  direction: 'inbound' | 'outbound';
  attachments?: Attachment[];
  createdAt: Date;
  updatedAt: Date;
}

// User
interface User {
  id: string;
  email: string;
  name?: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER';
  status?: 'active' | 'disabled';
  createdAt: Date;
}

// Attachment
interface Attachment {
  id: string;
  name: string;
  type: string;  // MIME type
  size: number;
  url: string;
  storageKey?: string;
  uploadedAt: Date;
}
```

---

## Troubleshooting

### Cache Not Invalidating

If cache doesn't seem to invalidate after a mutation:

1. Check mutation hook is using correct `onSuccess` callbacks
2. Verify query key matches cache key in query hook
3. Check browser DevTools → Network to see API calls
4. Use React Query DevTools to inspect cache

### Stale Data Displayed

If stale data appears after mutation:

1. Check `staleTime` settings (30s for conversations, 10s for messages)
2. Verify mutation invalidates correct cache keys
3. Check if query has `refetchOnMount: true` (should be false)

### Refetch Loops

If hooks are refetching too frequently:

1. Check component re-render cycle with React DevTools
2. Verify hook dependencies in useEffect
3. Disable `refetchOnWindowFocus` if not needed
4. Check if staleTime is too low

---

**Last Updated:** January 26, 2026  
**Maintained By:** Frontend Team  
**Framework:** TanStack Query v5 + React 18
