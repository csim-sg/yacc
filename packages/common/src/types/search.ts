/**
 * Search API Types
 */

export interface SearchConversationsQuery {
  q: string;
  page?: number;
  pageSize?: number;
  channel?: 'telegram' | 'irc' | 'whatsapp' | 'twitter';
  tagId?: string;
  assigneeId?: string;
  status?: 'open' | 'pending' | 'resolved';
  dateFrom?: string;
  dateTo?: string;
}
