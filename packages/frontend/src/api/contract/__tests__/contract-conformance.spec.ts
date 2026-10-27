/**
 * Frontend contract conformance (MIG-041; SPEC-002 AC-02/AC-07; ADR-023).
 *
 * Two-sided conformance, TS side: fixtures are declared with the GENERATED
 * contract types (so wire-shape drift fails `npm run type-check`, compile-time)
 * and then parsed by the runtime Zod layer (so the validators accept exactly
 * the frozen contract shapes, runtime). The Java DTO side of the same
 * conformance runs in `services/backend-java` (`./gradlew contractTest`).
 */
import { describe, expect, it } from 'vitest';
import {
  ConversationSchema,
  ConversationsListSchema,
  MessageSchema,
  MessagesListSchema,
  SendMessageResponseSchema,
  UserSchema,
} from '../../schemas';
import type { components as realtimeComponents } from '../realtime.gen';
import type { components } from '../rest-api.gen';

type Schemas = components['schemas'];
type Realtime = realtimeComponents['schemas'];

const ISO = '2026-10-16T08:00:00.000Z';
const UUID = '00000000-0000-4000-8000-000000000001';

describe('REST contract conformance (frozen openapi.yaml ↔ Zod layer)', () => {
  it('UserSchema accepts a contract `UserResponse` fixture', () => {
    const fixture: Schemas['UserResponse'] = {
      id: UUID,
      email: 'admin@yacc.local',
      name: 'System Administrator',
      role: 'super_admin',
      status: 'active',
      createdAt: ISO,
      updatedAt: ISO,
      deletedAt: null,
    };

    const parsed = UserSchema.parse(fixture);
    // Compile-time identity: validated output is the generated contract type.
    const assigned: Schemas['UserResponse'] = parsed;
    expect(assigned.role).toBe('super_admin');
  });

  it('MessageSchema accepts a contract `Message` fixture', () => {
    const fixture: Schemas['Message'] = {
      id: UUID,
      conversationId: UUID,
      senderId: null,
      senderName: 'irc-bot',
      body: 'hello from IRC',
      status: 'sent',
      direction: 'inbound',
      metadata: null,
      createdAt: ISO,
      updatedAt: ISO,
    };

    const parsed = MessageSchema.parse(fixture);
    const assigned: Schemas['Message'] = parsed;
    expect(assigned.senderName).toBe('irc-bot');
  });

  it('ConversationSchema accepts a contract `Conversation` fixture and passes extensions through', () => {
    const fixture: Schemas['Conversation'] = {
      id: UUID,
      status: 'open',
      priority: 'high',
      assignedUserId: null,
      // Contract `additionalProperties: true` — POC extensions stay legal.
      channel: 'irc',
      title: 'Support',
    };

    const parsed = ConversationSchema.parse(fixture);
    const assigned: Schemas['Conversation'] = parsed;
    expect(assigned.status).toBe('open');
    expect(parsed['channel']).toBe('irc');
  });

  it('list envelope validates the frozen BaseListResponse shape `{data,page,limit,total}`', () => {
    const conversation: Schemas['Conversation'] = { id: UUID, status: 'open' };
    const envelope = {
      data: [conversation],
      page: 1,
      limit: 20,
      total: 1,
    };

    const parsed = ConversationsListSchema.parse(envelope);
    // The parsed envelope is assignable to the generated listConversations
    // 200 response (BaseListResponse allOf with Conversation items).
    const asListResponse: Schemas['BaseListResponse'] = parsed;
    expect(asListResponse.total).toBe(1);
    expect(parsed.data[0]?.id).toBe(UUID);
  });

  it('MessagesListSchema validates the custom `MessageListResponse` shape', () => {
    const envelope: Schemas['MessageListResponse'] = {
      messages: [
        {
          id: UUID,
          conversationId: UUID,
          senderId: UUID,
          senderName: 'admin',
          body: 'hi',
          status: 'sent',
          direction: 'outbound',
          metadata: null,
          createdAt: ISO,
          updatedAt: ISO,
        },
      ],
      total: 1,
      page: 1,
      limit: 50,
    };

    const parsed = MessagesListSchema.parse(envelope);
    expect(parsed.messages).toHaveLength(1);
  });

  it('SendMessageResponseSchema validates the frozen 201 envelope `{data: Message}`', () => {
    const response = {
      data: {
        id: UUID,
        conversationId: UUID,
        senderId: UUID,
        senderName: 'admin',
        body: 'hi',
        status: 'pending',
        direction: 'outbound',
        metadata: null,
        createdAt: ISO,
        updatedAt: ISO,
      } satisfies Schemas['Message'],
    };

    const parsed = SendMessageResponseSchema.parse(response);
    expect(parsed.data.status).toBe('pending');
  });

  it('UserSchema rejects wire shapes the contract does not declare as required', () => {
    // Contract `UserResponse` requires lowercase role labels.
    expect(() =>
      UserSchema.parse({
        id: UUID,
        email: 'admin@yacc.local',
        name: 'Admin',
        role: 'SUPER_ADMIN',
        status: 'active',
        createdAt: ISO,
        updatedAt: ISO,
      })
    ).toThrow();
  });
});

describe('Real-time contract conformance (frozen AsyncAPI JSON Schemas ↔ generated types)', () => {
  it('envelope + payload fixtures satisfy the generated contract types', () => {
    const envelope: Realtime['envelope'] = {
      event: 'message.sent',
      data: {
        messageId: UUID,
        conversationId: UUID,
        status: 'sent',
        sentAt: ISO,
      } satisfies Realtime['message-sent'],
      timestamp: ISO,
    };

    expect(envelope.event).toBe('message.sent');
    expect(envelope.data).toHaveProperty('messageId');
  });

  it('canonical presence payload is `{userId, status, lastSeen}` (MIG-003 §4.5)', () => {
    const payload: Realtime['presence-updated'] = {
      userId: UUID,
      status: 'online',
      lastSeen: ISO,
    };

    expect(Object.keys(payload).sort()).toEqual(['lastSeen', 'status', 'userId']);
  });
});
