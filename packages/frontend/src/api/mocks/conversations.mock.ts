/**
 * Mock Conversation Data for Frontend Development
 * 
 * Provides realistic mock data that matches the API contract in .docs/02-api-and-data-model.md
 * Use these mocks for local development without a running backend
 */

// ============================================
// Data Types (matching API contract)
// ============================================

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Participant {
  id: string;
  name: string;
  type: 'contact' | 'agent';
}

export interface Message {
  id: string;
  conversationId: string;
  senderName: string;
  body: string;
  status: 'pending' | 'sent' | 'failed';
  direction: 'inbound' | 'outbound';
  createdAt: string;
  updatedAt: string;
}

export interface ConversationSummary {
  id: string;
  channel: 'telegram' | 'irc';
  externalThreadId: string;
  status: 'open' | 'pending' | 'resolved';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  assignedUserId: string | null;
  assignedUserName: string | null;
  tags: Tag[];
  participants: Participant[];
  unreadCount: number;
  latestMessagePreview: string | null;
  latestMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationDetail extends Omit<ConversationSummary, 'latestMessagePreview' | 'latestMessageAt' | 'unreadCount'> {
  // Detail version includes full messages instead of preview
}

export interface ListConversationsResponse {
  data: ConversationSummary[];
  page: number;
  pageSize: number;
  total: number;
}

export interface GetConversationResponse {
  data: ConversationDetail;
}

// ============================================
// Mock Data Generators
// ============================================

const mockTags: Tag[] = [
  { id: 'tag-1', name: 'VIP', color: '#FF5A5F' },
  { id: 'tag-2', name: 'Follow Up', color: '#FFB400' },
  { id: 'tag-3', name: 'Urgent', color: '#F50' },
  { id: 'tag-4', name: 'Resolved', color: '#52C41A' },
];

const mockParticipants: Participant[] = [
  { id: 'contact-alice', name: 'Alice Johnson', type: 'contact' },
  { id: 'contact-bob', name: 'Bob Smith', type: 'contact' },
  { id: 'contact-charlie', name: 'Charlie Brown', type: 'contact' },
];

const mockMessages: Message[] = [
  {
    id: 'msg-1',
    conversationId: 'conv-1',
    senderName: 'Alice Johnson',
    body: 'Hi, I have a question about my account',
    status: 'sent',
    direction: 'inbound',
    createdAt: '2026-02-06T08:00:00Z',
    updatedAt: '2026-02-06T08:00:00Z',
  },
  {
    id: 'msg-2',
    conversationId: 'conv-1',
    senderName: 'Support Agent',
    body: "Sure! I'd be happy to help. What's your question?",
    status: 'sent',
    direction: 'outbound',
    createdAt: '2026-02-06T08:05:00Z',
    updatedAt: '2026-02-06T08:05:00Z',
  },
  {
    id: 'msg-3',
    conversationId: 'conv-1',
    senderName: 'Alice Johnson',
    body: 'Can I upgrade my subscription?',
    status: 'sent',
    direction: 'inbound',
    createdAt: '2026-02-06T08:10:00Z',
    updatedAt: '2026-02-06T08:10:00Z',
  },
];

// ============================================
// Mock Conversation Data
// ============================================

export function createMockConversationSummary(
  overrides?: Partial<ConversationSummary>
): ConversationSummary {
  const baseId = overrides?.id || `conv-${Math.random().toString(36).substr(2, 9)}`;
  return {
    id: baseId,
    channel: 'telegram',
    externalThreadId: `ext-${Math.random().toString(36).substr(2, 9)}`,
    status: 'open',
    priority: 'normal',
    assignedUserId: 'user-123',
    assignedUserName: 'John Doe',
    tags: [mockTags[0]],
    participants: [mockParticipants[0]],
    unreadCount: 2,
    latestMessagePreview: 'Can I upgrade my subscription?',
    latestMessageAt: '2026-02-06T08:10:00Z',
    createdAt: '2026-02-01T10:00:00Z',
    updatedAt: '2026-02-06T08:10:00Z',
    ...overrides,
  };
}

export function createMockConversationDetail(
  overrides?: Partial<ConversationDetail>
): ConversationDetail {
  const baseId = overrides?.id || `conv-${Math.random().toString(36).substr(2, 9)}`;
  return {
    id: baseId,
    channel: 'telegram',
    externalThreadId: `ext-${Math.random().toString(36).substr(2, 9)}`,
    status: 'open',
    priority: 'normal',
    assignedUserId: 'user-123',
    assignedUserName: 'John Doe',
    tags: [mockTags[0]],
    participants: [mockParticipants[0]],
    createdAt: '2026-02-01T10:00:00Z',
    updatedAt: '2026-02-06T08:10:00Z',
    ...overrides,
  };
}

// ============================================
// Mock API Response Data
// ============================================

/**
 * Mock response for GET /conversations (single item for list)
 */
export const mockConversationSummary = createMockConversationSummary({
  id: 'conv-1',
  channel: 'telegram',
  externalThreadId: 'tg-group-123',
  status: 'open',
  priority: 'high',
  assignedUserId: 'user-123',
  assignedUserName: 'John Doe',
  tags: [mockTags[0], mockTags[1]],
  participants: [mockParticipants[0]],
  unreadCount: 2,
  latestMessagePreview: 'Can I upgrade my subscription?',
  latestMessageAt: '2026-02-06T08:10:00Z',
});

/**
 * Mock response for GET /conversations (full paginated list)
 */
export const mockConversationsList: ListConversationsResponse = {
  data: [
    createMockConversationSummary({
      id: 'conv-1',
      channel: 'telegram',
      externalThreadId: 'tg-group-1',
      status: 'open',
      priority: 'high',
      assignedUserName: 'John Doe',
      participants: [mockParticipants[0]],
      latestMessagePreview: 'Can I upgrade my subscription?',
      latestMessageAt: '2026-02-06T08:10:00Z',
      unreadCount: 2,
    }),
    createMockConversationSummary({
      id: 'conv-2',
      channel: 'irc',
      externalThreadId: 'irc-channel-2',
      status: 'pending',
      priority: 'normal',
      assignedUserName: 'Jane Smith',
      participants: [mockParticipants[1]],
      latestMessagePreview: 'Thank you for your help!',
      latestMessageAt: '2026-02-06T07:45:00Z',
      unreadCount: 0,
    }),
    createMockConversationSummary({
      id: 'conv-3',
      channel: 'telegram',
      externalThreadId: 'tg-group-3',
      status: 'resolved',
      priority: 'low',
      assignedUserName: null,
      participants: [mockParticipants[2]],
      latestMessagePreview: 'Issue resolved',
      latestMessageAt: '2026-02-06T06:20:00Z',
      unreadCount: 0,
    }),
  ],
  page: 1,
  pageSize: 20,
  total: 35,
};

/**
 * Mock response for GET /conversations/:id (detailed conversation)
 */
export const mockConversationDetail: GetConversationResponse = {
  data: createMockConversationDetail({
    id: 'conv-1',
    channel: 'telegram',
    externalThreadId: 'tg-group-1',
    status: 'open',
    priority: 'high',
    assignedUserName: 'John Doe',
    participants: [mockParticipants[0]],
  }),
};

// ============================================
// Mock Message Data
// ============================================

export const mockMessageHistory = {
  data: mockMessages,
  page: 1,
  pageSize: 50,
  total: 3,
};

// ============================================
// Mock WebSocket Events
// ============================================

export const mockWebSocketEvents = {
  messageReceived: {
    type: 'message.received',
    conversationId: 'conv-1',
    message: {
      id: 'msg-new-1',
      conversationId: 'conv-1',
      senderName: 'Alice Johnson',
      body: 'New message in real-time',
      status: 'sent' as const,
      direction: 'inbound' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  },
  messageSent: {
    type: 'message.sent',
    conversationId: 'conv-1',
    message: {
      id: 'msg-sent-1',
      conversationId: 'conv-1',
      senderName: 'Support Agent',
      body: 'Message sent successfully',
      status: 'sent' as const,
      direction: 'outbound' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  },
  messageFailed: {
    type: 'message.failed',
    conversationId: 'conv-1',
    message: {
      id: 'msg-failed-1',
      conversationId: 'conv-1',
      senderName: 'Support Agent',
      body: 'Failed to send message',
      status: 'failed' as const,
      direction: 'outbound' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    error: 'Network timeout',
  },
};

// ============================================
// Mock Filter Variations
// ============================================

/**
 * Mock responses for different filter combinations
 */
export const mockFilteredResponses = {
  byChannel: {
    telegram: mockConversationsList,
    irc: {
      ...mockConversationsList,
      data: mockConversationsList.data.filter((c) => c.channel === 'irc'),
      total: 12,
    },
  },
  byStatus: {
    open: {
      ...mockConversationsList,
      data: mockConversationsList.data.filter((c) => c.status === 'open'),
      total: 20,
    },
    pending: {
      ...mockConversationsList,
      data: mockConversationsList.data.filter((c) => c.status === 'pending'),
      total: 10,
    },
    resolved: {
      ...mockConversationsList,
      data: mockConversationsList.data.filter((c) => c.status === 'resolved'),
      total: 5,
    },
  },
  byPriority: {
    high: {
      ...mockConversationsList,
      data: mockConversationsList.data.filter((c) => c.priority === 'high'),
      total: 8,
    },
    normal: {
      ...mockConversationsList,
      data: mockConversationsList.data.filter((c) => c.priority === 'normal'),
      total: 20,
    },
    low: {
      ...mockConversationsList,
      data: mockConversationsList.data.filter((c) => c.priority === 'low'),
      total: 7,
    },
  },
  byAssignee: {
    'user-123': {
      ...mockConversationsList,
      data: mockConversationsList.data.filter((c) => c.assignedUserName === 'John Doe'),
      total: 15,
    },
    unassigned: {
      ...mockConversationsList,
      data: mockConversationsList.data.filter((c) => c.assignedUserId === null),
      total: 5,
    },
  },
  combined: {
    telegramOpenHighPriority: {
      ...mockConversationsList,
      data: mockConversationsList.data.filter(
        (c) => c.channel === 'telegram' && c.status === 'open' && c.priority === 'high'
      ),
      total: 3,
    },
  },
};

// ============================================
// Pagination Variations
// ============================================

export const mockPaginationVariations = {
  page1Limit10: {
    ...mockConversationsList,
    page: 1,
    pageSize: 10,
    data: mockConversationsList.data.slice(0, 10),
  },
  page2Limit10: {
    ...mockConversationsList,
    page: 2,
    pageSize: 10,
    data: mockConversationsList.data.slice(10, 20),
  },
  page3Limit20: {
    ...mockConversationsList,
    page: 3,
    pageSize: 20,
    data: mockConversationsList.data.slice(40, 60),
  },
};
