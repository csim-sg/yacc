import { baseListResponseSchema, dataEnvelopeSchema } from './common/envelope.schema';
import { ErrorEnvelopeSchema } from './common/error.schema';
import { RoleSchema, UserStatusSchema } from './common/role.schema';
import { cacheKeys } from './cache-keys';
import { AuthSessionResponseSchema, AuthSessionGetResponseSchema, AuthRefreshResponseSchema, AuthSignOutResponseSchema, ChangePasswordRequestSchema, ForgotPasswordRequestSchema, ResetPasswordRequestSchema, SignInRequestSchema, SignUpRequestSchema, VerifyEmailRequestSchema } from './http/auth.schema';
import { AssignConversationRequestSchema } from './http/assignments.schema';
import { ExportAuditLogsRequestSchema, ListAuditLogsParamsSchema } from './http/audit-logs.schema';
import { ListConversationsParamsSchema } from './http/conversations.schema';
import { CreateIrcProfileRequestSchema, IrcProfileConfigSchema } from './http/irc.schema';
import { SendMessageRequestSchema } from './http/messages.schema';
import { CreateNoteRequestSchema } from './http/notes.schema';
import { CreateRoutingRuleRequestSchema, RoutingRuleActionSchema, RoutingRuleConditionSchema } from './http/routing-rules.schema';
import { AttachTagRequestSchema, CreateTagRequestSchema } from './http/tags.schema';
import { CreateUserRequestSchema } from './http/users.schema';
import { WS_CONNECTION_TIMEOUT_MS, WS_CORRELATION_HEADER, WS_MAX_RECONNECTION_ATTEMPTS, WS_PING_INTERVAL_MS, WS_RECONNECTION_DELAYS_MS, WS_TRANSPORTS } from './ws/connection';
import { ConversationUpdatedEventSchema, MessageFailedEventSchema, MessageSentEventSchema } from './ws/events.schema';

/**
 * Contract-layer smoke spec (ANG-004 PB-3 support).
 *
 * Freezes the canonical wire shapes the auth surface and the remaining
 * contract families encode (frozen `.docs/migration/openapi.yaml`
 * adaptation, ADR-023): envelope helpers, the lowercase role wire form,
 * the full auth contract family, per-family request schemas, the
 * canonical cache-key registry, and the socket connection constants.
 * Full row-shape parsing per family rides the family issues
 * (ANG-005/007..013) that consume them.
 */
describe('contract layer (frozen wire shapes)', () => {
  /** Canonical wire user used across fixtures (lowercase labels, G9). */
  const wireUser = {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'admin@yacc.local',
    name: 'System Administrator',
    role: 'super_admin',
    status: 'active',
    emailVerified: true,
    createdAt: '2026-09-27T08:00:00',
    updatedAt: '2026-09-27T08:00:00',
  };

  describe('envelope helpers', () => {
    it('wraps single resources in `{ data }`', () => {
      const schema = dataEnvelopeSchema(RoleSchema);
      expect(schema.parse({ data: 'admin' })).toEqual({ data: 'admin' });
      expect(schema.safeParse({ wrong: 'admin' }).success).toBe(false);
    });

    it('wraps lists in the `BaseListResponse` wire shape', () => {
      const schema = baseListResponseSchema(RoleSchema);
      expect(schema.parse({ data: ['user'], page: 1, limit: 25, total: 42 })).toEqual({
        data: ['user'],
        page: 1,
        limit: 25,
        total: 42,
      });
      // The React type-claim drift shapes (`pageSize`, `items`) do not parse.
      expect(schema.safeParse({ data: [], page: 1, pageSize: 25, total: 0 }).success).toBe(false);
    });

    it('encodes both live error-envelope shapes', () => {
      expect(ErrorEnvelopeSchema.parse({ error: 'Invalid credentials' })).toEqual({
        error: 'Invalid credentials',
      });
      expect(
        ErrorEnvelopeSchema.parse({ code: 'IRC_CONFIG_INVALID', message: 'bad config' })
      ).toEqual({ code: 'IRC_CONFIG_INVALID', message: 'bad config' });
      expect(ErrorEnvelopeSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('role labels (G9)', () => {
    it('accepts exactly the lowercase wire roles and statuses', () => {
      for (const role of ['super_admin', 'admin', 'manager', 'user']) {
        expect(RoleSchema.parse(role)).toBe(role);
      }
      for (const status of ['active', 'inactive', 'suspended']) {
        expect(UserStatusSchema.parse(status)).toBe(status);
      }
      // The uppercase UI labels are NOT wire-valid.
      expect(RoleSchema.safeParse('SUPER_ADMIN').success).toBe(false);
      expect(RoleSchema.safeParse('root').success).toBe(false);
    });
  });

  describe('auth contract family (frozen /api/auth/* surface)', () => {
    it('parses the canonical sign-in session (user + token pair + forced-change flag)', () => {
      const session = AuthSessionResponseSchema.parse({
        user: wireUser,
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        mustChangePassword: false,
      });
      expect(session.user.role).toBe('super_admin');
      expect(session.mustChangePassword).toBe(false);

      // An uppercase role is not wire-valid (normalization is frontend-only).
      expect(
        AuthSessionResponseSchema.safeParse({
          user: { ...wireUser, role: 'SUPER_ADMIN' },
          accessToken: 'a',
          refreshToken: 'r',
          mustChangePassword: false,
        }).success
      ).toBe(false);
    });

    it('parses the session lookup, refresh rotation, and sign-out shapes', () => {
      expect(
        AuthSessionGetResponseSchema.parse({ user: wireUser, mustChangePassword: true })
      ).toMatchObject({ mustChangePassword: true });
      expect(
        AuthRefreshResponseSchema.parse({ accessToken: 'a2', refreshToken: 'r2' })
      ).toEqual({ accessToken: 'a2', refreshToken: 'r2' });
      expect(AuthSignOutResponseSchema.parse({ success: true })).toEqual({ success: true });
      expect(AuthSignOutResponseSchema.safeParse({ success: false }).success).toBe(false);
    });

    it('parses the request payloads for the whole frozen surface', () => {
      expect(SignInRequestSchema.parse({ email: 'a@b.c', password: 'pw' })).toBeTruthy();
      expect(
        SignUpRequestSchema.parse({ email: 'a@b.c', password: 'pw', name: 'New' })
      ).toBeTruthy();
      expect(
        ChangePasswordRequestSchema.parse({ currentPassword: 'one', newPassword: 'two-long' })
      ).toBeTruthy();
      expect(ForgotPasswordRequestSchema.parse({ email: 'a@b.c' })).toBeTruthy();
      expect(ResetPasswordRequestSchema.parse({ token: 't', password: 'pw-long' })).toBeTruthy();
      expect(VerifyEmailRequestSchema.parse({ token: 't' })).toBeTruthy();
      // Structural rejection: a payload without the token field is invalid.
      expect(VerifyEmailRequestSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('remaining family request schemas', () => {
    it('parses canonical request payloads per family', () => {
      expect(
        CreateUserRequestSchema.parse({
          email: 'a@b.c',
          password: 'pw',
          name: 'User',
          role: 'manager',
        })
      ).toBeTruthy();
      expect(CreateTagRequestSchema.parse({ name: 'Billing', color: '#ff0000' })).toBeTruthy();
      expect(AttachTagRequestSchema.parse({ tagId: 3 })).toBeTruthy();
      expect(CreateNoteRequestSchema.parse({ body: 'note body' })).toBeTruthy();
      expect(SendMessageRequestSchema.parse({ body: 'hello' })).toBeTruthy();
      expect(
        AssignConversationRequestSchema.parse({
          assignedUserId: '00000000-0000-0000-0000-000000000002',
        })
      ).toBeTruthy();
      expect(
        RoutingRuleConditionSchema.parse({ field: 'subject', operator: 'contains', value: 'urgent' })
      ).toBeTruthy();
      expect(RoutingRuleActionSchema.parse({ type: 'assign', value: 1 })).toBeTruthy();
      expect(
        CreateRoutingRuleRequestSchema.parse({
          name: 'Urgent routing',
          priority: 1,
          conditions: [{ field: 'subject', operator: 'contains', value: 'urgent' }],
          actions: [{ type: 'assign', value: 1 }],
        })
      ).toBeTruthy();
      expect(
        IrcProfileConfigSchema.parse({
          server: 'irc.example.com',
          port: 6697,
          username: 'yacc',
          channels: ['#ops'],
        })
      ).toBeTruthy();
      expect(
        CreateIrcProfileRequestSchema.parse({
          name: 'Ops profile',
          config: { server: 'irc.example.com', port: 6697, username: 'yacc', channels: ['#ops'] },
        })
      ).toBeTruthy();
      expect(ListConversationsParamsSchema.parse({ page: 1, limit: 25, status: 'open' })).toBeTruthy();
      expect(ListAuditLogsParamsSchema.parse({ page: 1, action: 'user.login' })).toBeTruthy();
      expect(ExportAuditLogsRequestSchema.parse({ format: 'csv', filters: { entityType: 'user' } })).toBeTruthy();
    });

    it('rejects wire-invalid enum values on request params', () => {
      expect(ListConversationsParamsSchema.safeParse({ status: 'closed' }).success).toBe(false);
      expect(
        CreateUserRequestSchema.safeParse({
          email: 'a@b.c',
          password: 'pw',
          name: 'User',
          role: 'SUPER_ADMIN',
        }).success
      ).toBe(false);
    });
  });

  describe('canonical cache-key registry', () => {
    it('produces the live cache keys 1:1', () => {
      const params = { page: 1, limit: 25 };
      expect(cacheKeys.conversations.all()).toEqual(['conversations']);
      expect(cacheKeys.conversations.list(params)).toEqual(['conversations', params]);
      expect(cacheKeys.conversations.detail('c1')).toEqual(['conversation', 'c1']);
      expect(cacheKeys.conversations.messages('c1')).toEqual(['conversationMessages', 'c1']);
      expect(cacheKeys.conversations.notes('c1')).toEqual(['conversationNotes', 'c1']);
      expect(cacheKeys.conversations.auditLogs('c1')).toEqual(['conversationAuditLogs', 'c1']);
      expect(cacheKeys.tags.all()).toEqual(['tags']);
      expect(cacheKeys.users.all()).toEqual(['users']);
      expect(cacheKeys.users.list(params)).toEqual(['users', params]);
      expect(cacheKeys.routingRules.all()).toEqual(['routingRules']);
      expect(cacheKeys.routingRules.executions('r1')).toEqual(['routingRuleExecutions', 'r1']);
      expect(cacheKeys.auditLogs.list(params)).toEqual(['auditLogs', params]);
      expect(cacheKeys.ircProfiles.all()).toEqual(['ircProfiles']);
      expect(cacheKeys.ircProfiles.detail(7)).toEqual(['ircProfile', 7]);
      expect(cacheKeys.notifications.all()).toEqual(['notifications']);
    });
  });

  describe('socket connection constants (T2 §3.5 pins)', () => {
    it('carries the React client reconnection/transport/correlation pins', () => {
      expect(WS_RECONNECTION_DELAYS_MS).toEqual([1000, 2000, 4000, 8000, 30000]);
      expect(WS_MAX_RECONNECTION_ATTEMPTS).toBe(10);
      expect(WS_CONNECTION_TIMEOUT_MS).toBe(10000);
      expect(WS_PING_INTERVAL_MS).toBe(60000);
      expect(WS_TRANSPORTS).toEqual(['websocket', 'polling']);
      expect(WS_CORRELATION_HEADER).toBe('X-Request-ID');
    });

    it('encodes the legacy-gateway `{event, data, timestamp}` envelope (T3-G5)', () => {
      const sent = MessageSentEventSchema.parse({
        event: 'message.sent',
        data: {
          messageId: 'm1',
          conversationId: 'c1',
          status: 'sent',
          platformMessageId: 'tg-1',
          timestamp: '2026-10-18T00:00:00',
        },
        timestamp: '2026-10-18T00:00:00',
      });
      expect(sent.data.status).toBe('sent');

      expect(
        MessageFailedEventSchema.parse({
          event: 'message.failed',
          data: {
            messageId: 'm1',
            conversationId: 'c1',
            status: 'failed',
            attempt: 3,
            maxAttempts: 3,
            error: 'delivery timeout',
            isFinal: true,
          },
          timestamp: '2026-10-18T00:00:00',
        }).data.isFinal
      ).toBe(true);

      expect(
        ConversationUpdatedEventSchema.parse({
          conversationId: '00000000-0000-0000-0000-00000000000c',
          updatedFields: { status: 'open' },
          changedBy: 'user-1',
          changedAt: '2026-10-18T00:00:00',
        }).updatedFields
      ).toEqual({ status: 'open' });

      // A wrong event literal does not parse (envelope duality guard).
      expect(MessageSentEventSchema.safeParse({ event: 'message.failed', data: {}, timestamp: 't' }).success).toBe(
        false
      );
    });
  });
});
