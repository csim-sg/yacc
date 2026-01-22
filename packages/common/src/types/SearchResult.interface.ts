import type { Conversation } from './Conversation.interface';

export interface SearchResult {
  conversation: Conversation;
  snippet: string;
  relevanceScore: number;
}
