/**
 * Conversations Service
 * Handles conversation list API calls
 */

import { api } from '../lib/apiClient';

export type ConversationStatus = 'open' | 'pending' | 'resolved';
export type ConversationPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ChannelType = 'telegram' | 'irc' | 'whatsapp' | 'wechat' | 'meta' | 'x' | 'email' | 'slack';
export const PHASE1_CHANNELS = ['telegram', 'irc'] as const;
export type Phase1ChannelType = (typeof PHASE1_CHANNELS)[number];

export interface ConversationTag {
  id: number;
  name: string;
  color: string;
}

export interface LatestMessage {
  id: number;
  body: string;
  senderName: string;
  createdAt: string;
}

export interface ConversationListItem {
  id: number;
  channel: ChannelType;
  externalThreadId: string;
  title?: string | null;
  status: ConversationStatus;
  priority: ConversationPriority;
  assignedUserId?: number | null;
  latestMessage?: LatestMessage | null;
  tags?: ConversationTag[];
  unreadCount?: number;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
}

export interface ConversationMessage {
  id: number;
  conversationId: number;
  senderId?: number | null;
  senderName: string;
  body: string;
  status: 'pending' | 'sent' | 'failed';
  direction: 'inbound' | 'outbound';
  externalMessageId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationDetail {
  id: number;
  channel: ChannelType;
  externalThreadId: string;
  title?: string | null;
  status: ConversationStatus;
  priority: ConversationPriority;
  assignedUserId?: number | null;
  createdAt: string;
  updatedAt: string;
  tags?: ConversationTag[];
}

export interface ListConversationsResponse {
  data: ConversationListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListConversationsParams {
  page?: number;
  limit?: number;
  channel?: ChannelType;
  status?: ConversationStatus;
  priority?: ConversationPriority;
  assignedUserId?: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  unread?: boolean;
  sortBy?: 'lastActivity' | 'created' | 'priority';
  sortOrder?: 'asc' | 'desc';
}

export interface GetConversationResponse {
  data: ConversationDetail;
}

export interface ListMessagesResponse {
  data: ConversationMessage[];
  page: number;
  pageSize: number;
  total: number;
}

export interface SendMessageRequest {
  body: string;
}

export interface SendMessageResponse {
  data: ConversationMessage;
}

export const conversationsService = {
  async list(params: ListConversationsParams = {}): Promise<ListConversationsResponse> {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.set(key, String(value));
      }
    });

    const queryString = query.toString();
    const endpoint = queryString ? `/api/conversations?${queryString}` : '/api/conversations';

    return api.get<ListConversationsResponse>(endpoint);
  },

  async getById(id: number): Promise<GetConversationResponse> {
    return api.get<GetConversationResponse>(`/api/conversations/${id}`);
  },

  async getMessages(
    conversationId: number,
    page: number = 1,
    limit: number = 50
  ): Promise<ListMessagesResponse> {
    const query = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });

    return api.get<ListMessagesResponse>(`/api/conversations/${conversationId}/messages?${query}`);
  },

  async sendMessage(conversationId: number, body: string): Promise<SendMessageResponse> {
    return api.post<SendMessageResponse>(`/api/conversations/${conversationId}/messages`, {
      body,
    });
  },
};
