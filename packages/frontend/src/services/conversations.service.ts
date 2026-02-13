/**
 * Conversations Service
 * Handles conversation list API calls
 */

import { api } from '../lib/apiClient';

export type ConversationStatus = 'open' | 'pending' | 'resolved';
export type ConversationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type ChannelType = 'telegram' | 'irc' | 'whatsapp' | 'wechat' | 'meta' | 'x' | 'email' | 'slack';
export const PHASE1_CHANNELS = ['telegram', 'irc'] as const;
export type Phase1ChannelType = (typeof PHASE1_CHANNELS)[number];

export interface ConversationTag {
  id: string;
  name: string;
  color: string;
}

export interface Participant {
  id: string;
  name: string;
  type: 'contact' | 'agent';
}

export interface ConversationListItem {
  id: string;
  channel: ChannelType;
  externalThreadId: string;
  title?: string | null;
  status: ConversationStatus;
  priority: ConversationPriority;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  tags?: ConversationTag[];
  participants?: Participant[];
  unreadCount?: number;
  latestMessagePreview?: string | null;
  latestMessageAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  senderId?: string | null;
  senderName: string;
  body: string;
  status: 'pending' | 'sent' | 'failed';
  direction: 'inbound' | 'outbound';
  externalMessageId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationDetail {
  id: string;
  channel: ChannelType;
  externalThreadId: string;
  title?: string | null;
  status: ConversationStatus;
  priority: ConversationPriority;
  assignedUserId?: string | null;
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
  assignedUserId?: string;
  tagId?: number;
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

   async getById(id: string): Promise<GetConversationResponse> {
     return api.get<GetConversationResponse>(`/api/conversations/${id}`);
   },

   async getMessages(
     conversationId: string,
     page: number = 1,
     limit: number = 50
   ): Promise<ListMessagesResponse> {
     const query = new URLSearchParams({
       page: String(page),
       limit: String(limit),
     });

     return api.get<ListMessagesResponse>(`/api/conversations/${conversationId}/messages?${query}`);
   },

   async sendMessage(conversationId: string, body: string): Promise<SendMessageResponse> {
     return api.post<SendMessageResponse>(`/api/conversations/${conversationId}/messages`, {
       body,
     });
   },
};
