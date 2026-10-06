import type { ListAuditLogsParams } from './http/audit-logs.schema';
import type { ListConversationsParams } from './http/conversations.schema';
import type { ListUsersParams } from './http/users.schema';

/**
 * Canonical cache-key registry (T2 §3.1; SPEC-003 TR-03/TR-05).
 *
 * The ONE place resource cache keys are defined. The React app ships
 * three ad-hoc spellings for the message cache alone (B2) — ad-hoc keys
 * outside this registry are a review-blocking grep gate (cache-key
 * literals live only in this file; stores in ANG-005+ build on these
 * factories only).
 *
 * Keys mirror the live React cache keys 1:1 where they exist today
 * (`['conversations', params]`, `['conversation', id]`,
 * `['conversationMessages', id]`, `['notifications']`); the remaining
 * families are defined canonically here so future family issues cannot
 * invent new spellings.
 */

/**
 * Resource cache key — a readonly array of primitives/param objects.
 * (Structurally the cache-backend key; the store layer in ANG-005+
 * consumes these factories, never inline literals.)
 */
export type CacheKey = readonly unknown[];

export const cacheKeys = {
  conversations: {
    /** Root of the conversations family (invalidation anchor). */
    all: (): CacheKey => ['conversations'],
    /** Live list key: `['conversations', listParams]`. */
    list: (params: ListConversationsParams): CacheKey => ['conversations', params],
    /** Live detail key: `['conversation', id]`. */
    detail: (conversationId: string): CacheKey => ['conversation', conversationId],
    /** Live message-list key: `['conversationMessages', id]`. */
    messages: (conversationId: string): CacheKey => ['conversationMessages', conversationId],
    /** Notes for a conversation. */
    notes: (conversationId: string): CacheKey => ['conversationNotes', conversationId],
    /** Conversation-scoped audit logs. */
    auditLogs: (conversationId: string): CacheKey => ['conversationAuditLogs', conversationId],
  },
  tags: {
    all: (): CacheKey => ['tags'],
  },
  users: {
    all: (): CacheKey => ['users'],
    list: (params: ListUsersParams): CacheKey => ['users', params],
  },
  routingRules: {
    all: (): CacheKey => ['routingRules'],
    executions: (ruleId: string): CacheKey => ['routingRuleExecutions', ruleId],
  },
  auditLogs: {
    list: (params: ListAuditLogsParams): CacheKey => ['auditLogs', params],
  },
  ircProfiles: {
    all: (): CacheKey => ['ircProfiles'],
    detail: (profileId: number): CacheKey => ['ircProfile', profileId],
  },
  notifications: {
    /** Live notifications-store cache anchor (`['notifications']`). */
    all: (): CacheKey => ['notifications'],
  },
} as const;

export type CacheKeys = typeof cacheKeys;
