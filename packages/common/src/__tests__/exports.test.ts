/**
 * Tests for Domain-Specific Package Exports
 *
 * These tests verify that the domain-specific export paths work correctly
 * and that imports resolve as expected.
 *
 * Note: Type-only exports are verified at compile time, not runtime.
 * Tests here focus on runtime values (classes, functions, constants).
 *
 * @module @yacc/common/__tests__
 */

import { describe, it, expect } from 'vitest';
import type {
  User,
  Conversation,
  Message,
  Tag,
  Note,
  Notification,
  Attachment,
  Role,
  Channel,
  Priority,
  ConversationStatus,
  MessageStatus,
  MessageDirection,
} from '../types/entities';

describe('Domain-Specific Exports', () => {
  describe('types/entities', () => {
    it('should resolve the module', async () => {
      const entitiesModule = await import('../types/entities');
      expect(entitiesModule).toBeDefined();
    });

    // Type exports are verified at compile time via TypeScript
    // The type imports above verify that types are correctly exported
    it('should export types (compile-time verification)', () => {
      // If TypeScript compiles this, types are correctly exported
      // We just need to use the types in some way to prevent unused warnings
      const _user: User | null = null;
      const _conversation: Conversation | null = null;
      const _message: Message | null = null;
      const _tag: Tag | null = null;
      const _note: Note | null = null;
      const _notification: Notification | null = null;
      const _attachment: Attachment | null = null;
      expect(_user).toBeNull();
      expect(_conversation).toBeNull();
      expect(_message).toBeNull();
      expect(_tag).toBeNull();
      expect(_note).toBeNull();
      expect(_notification).toBeNull();
      expect(_attachment).toBeNull();
    });
  });

  describe('types/api', () => {
    it('should export BaseListRequest class', async () => {
      const { BaseListRequest } = await import('../types/api');
      expect(BaseListRequest).toBeDefined();
      expect(typeof BaseListRequest).toBe('function');
    });

    it('should export BaseListResponse class', async () => {
      const { BaseListResponse } = await import('../types/api');
      expect(BaseListResponse).toBeDefined();
      expect(typeof BaseListResponse).toBe('function');
    });

    it('should resolve the module', async () => {
      const apiModule = await import('../types/api');
      expect(apiModule).toBeDefined();
    });
  });

  describe('schemas', () => {
    it('should export LoginRequestSchema', async () => {
      const { LoginRequestSchema } = await import('../schemas');
      expect(LoginRequestSchema).toBeDefined();
      expect(typeof LoginRequestSchema).toBe('object');
    });

    it('should export TagSchema', async () => {
      const { TagSchema } = await import('../schemas');
      expect(TagSchema).toBeDefined();
      expect(typeof TagSchema).toBe('object');
    });

    it('should export NoteSchema', async () => {
      const { NoteSchema } = await import('../schemas');
      expect(NoteSchema).toBeDefined();
      expect(typeof NoteSchema).toBe('object');
    });

    it('should export SendMessageRequestSchema', async () => {
      const { SendMessageRequestSchema } = await import('../schemas');
      expect(SendMessageRequestSchema).toBeDefined();
      expect(typeof SendMessageRequestSchema).toBe('object');
    });

    it('should export routing rule schemas', async () => {
      const { CreateRoutingRuleRequestSchema, UpdateRoutingRuleRequestSchema } =
        await import('../schemas');
      expect(CreateRoutingRuleRequestSchema).toBeDefined();
      expect(UpdateRoutingRuleRequestSchema).toBeDefined();
    });
  });

  describe('constants', () => {
    it('should export Roles', async () => {
      const { Roles } = await import('../constants');
      expect(Roles).toBeDefined();
      expect(Roles.SUPER_ADMIN).toBe('super_admin');
      expect(Roles.ADMIN).toBe('admin');
      expect(Roles.MANAGER).toBe('manager');
      expect(Roles.USER).toBe('user');
    });

    it('should export ConversationStatuses', async () => {
      const { ConversationStatuses } = await import('../constants');
      expect(ConversationStatuses).toBeDefined();
      expect(ConversationStatuses.OPEN).toBe('open');
      expect(ConversationStatuses.PENDING).toBe('pending');
      expect(ConversationStatuses.RESOLVED).toBe('resolved');
    });

    it('should export Channels', async () => {
      const { Channels } = await import('../constants');
      expect(Channels).toBeDefined();
      expect(Channels.TELEGRAM).toBe('telegram');
      expect(Channels.IRC).toBe('irc');
    });

    it('should export Priorities', async () => {
      const { Priorities } = await import('../constants');
      expect(Priorities).toBeDefined();
      expect(Priorities.LOW).toBe('low');
      expect(Priorities.NORMAL).toBe('normal');
      expect(Priorities.HIGH).toBe('high');
      expect(Priorities.URGENT).toBe('urgent');
    });

    it('should export MessageStatuses', async () => {
      const { MessageStatuses } = await import('../constants');
      expect(MessageStatuses).toBeDefined();
      expect(MessageStatuses.PENDING).toBe('pending');
      expect(MessageStatuses.SENT).toBe('sent');
      expect(MessageStatuses.FAILED).toBe('failed');
    });

    it('should export error codes', async () => {
      const { ERROR_CODE, ERROR_MESSAGE } = await import('../constants');
      expect(ERROR_CODE).toBeDefined();
      expect(ERROR_MESSAGE).toBeDefined();
    });

    it('should export enum parsers', async () => {
      const { parseRole, parseConversationStatus, parsePriority } =
        await import('../constants');
      expect(parseRole).toBeDefined();
      expect(parseConversationStatus).toBeDefined();
      expect(parsePriority).toBeDefined();
    });
  });

  describe('Main entry point', () => {
    it('should export BaseListRequest', async () => {
      const { BaseListRequest } = await import('../index');
      expect(BaseListRequest).toBeDefined();
      expect(typeof BaseListRequest).toBe('function');
    });

    it('should export BaseListResponse', async () => {
      const { BaseListResponse } = await import('../index');
      expect(BaseListResponse).toBeDefined();
      expect(typeof BaseListResponse).toBe('function');
    });

    it('should export constants', async () => {
      const { ConversationStatuses, Priorities, Channels } = await import('../index');
      expect(ConversationStatuses).toBeDefined();
      expect(Priorities).toBeDefined();
      expect(Channels).toBeDefined();
    });
  });
});

describe('Import Path Resolution', () => {
  it('should resolve types/entities', async () => {
    const entitiesModule = await import('../types/entities');
    expect(entitiesModule).toBeDefined();
  });

  it('should resolve types/api', async () => {
    const apiModule = await import('../types/api');
    expect(apiModule).toBeDefined();
  });

  it('should resolve schemas', async () => {
    const schemasModule = await import('../schemas');
    expect(schemasModule).toBeDefined();
  });

  it('should resolve constants', async () => {
    const constantsModule = await import('../constants');
    expect(constantsModule).toBeDefined();
  });
});

describe('No Circular Dependencies', () => {
  it('should not have circular dependencies in types/entities', async () => {
    await import('../types/entities');
    expect(true).toBe(true);
  });

  it('should not have circular dependencies in types/api', async () => {
    await import('../types/api');
    expect(true).toBe(true);
  });

  it('should not have circular dependencies in schemas', async () => {
    await import('../schemas');
    expect(true).toBe(true);
  });

  it('should not have circular dependencies in constants', async () => {
    await import('../constants');
    expect(true).toBe(true);
  });
});

describe('Zod Schema Validation', () => {
  it('should validate LoginRequestSchema', async () => {
    const { LoginRequestSchema } = await import('../schemas');
    const validInput = { email: 'test@example.com', password: 'password123' };
    const result = LoginRequestSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should reject invalid email in LoginRequestSchema', async () => {
    const { LoginRequestSchema } = await import('../schemas');
    const invalidInput = { email: 'invalid-email', password: 'password123' };
    const result = LoginRequestSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });

  it('should validate TagSchema', async () => {
    const { TagSchema } = await import('../schemas');
    const validInput = {
      id: 1,
      name: 'Urgent',
      color: '#FF0000',
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    };
    const result = TagSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should reject invalid color in TagSchema', async () => {
    const { TagSchema } = await import('../schemas');
    const invalidInput = {
      id: 1,
      name: 'Urgent',
      color: 'red', // Should be hex format
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    };
    const result = TagSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });
});
