/**
 * Tests for WebSocket Event Types
 *
 * These tests verify:
 * 1. Type assertions compile correctly
 * 2. Discriminated union narrowing works
 * 3. Type guards function correctly
 * 4. All 9 events are properly defined
 *
 * @module @yacc/common/types/events/__tests__
 */

import { describe, it, expect } from 'vitest';
import type {
  WebSocketEvent,
  WebSocketEventName,
  MessageReceivedEvent,
  MessageSentEvent,
  MessageFailedEvent,
  ConversationUpdatedEvent,
  ConversationReopenedEvent,
  NotificationReceivedEvent,
  PresenceUpdatedEvent,
  TypingStartedEvent,
  TypingStoppedEvent,
} from '../index';
import {
  isMessageEvent,
  isConversationEvent,
  isNotificationEvent,
  isPresenceEvent,
} from '../index';

describe('WebSocketEventName', () => {
  it('should include all 9 event names', () => {
    const eventNames: WebSocketEventName[] = [
      'message.received',
      'message.sent',
      'message.failed',
      'conversation.updated',
      'conversation.reopened',
      'notification.received',
      'presence.updated',
      'typing.started',
      'typing.stopped',
    ];

    expect(eventNames).toHaveLength(9);
  });
});

describe('MessageReceivedEvent', () => {
  it('should create a valid message.received event', () => {
    const event: MessageReceivedEvent = {
      event: 'message.received',
      payload: {
        conversationId: 'conv-123',
        messageId: 'msg-456',
        platform: 'telegram',
        senderId: 'sender-789',
        senderName: 'John Doe',
        body: 'Hello, world!',
        direction: 'inbound',
        timestamp: '2026-01-16T10:00:00Z',
      },
      timestamp: '2026-01-16T10:00:00Z',
    };

    expect(event.event).toBe('message.received');
    expect(event.payload.direction).toBe('inbound');
    expect(event.payload.platform).toBe('telegram');
  });

  it('should support optional attachments', () => {
    const event: MessageReceivedEvent = {
      event: 'message.received',
      payload: {
        conversationId: 'conv-123',
        messageId: 'msg-456',
        platform: 'irc',
        senderId: 'sender-789',
        senderName: 'Jane Doe',
        body: 'Check this image',
        direction: 'inbound',
        timestamp: '2026-01-16T10:00:00Z',
        attachments: [
          {
            id: 'att-1',
            messageId: 'msg-456',
            url: 'https://example.com/image.jpg',
            storageKey: 'uploads/image.jpg',
            type: 'image',
            name: 'image.jpg',
            size: 1024,
            uploadedAt: '2026-01-16T10:00:00Z',
          },
        ],
      },
      timestamp: '2026-01-16T10:00:00Z',
    };

    expect(event.payload.attachments).toHaveLength(1);
    expect(event.payload.attachments?.[0]?.type).toBe('image');
  });
});

describe('MessageSentEvent', () => {
  it('should create a valid message.sent event', () => {
    const event: MessageSentEvent = {
      event: 'message.sent',
      payload: {
        conversationId: 'conv-123',
        messageId: 'msg-456',
        direction: 'outbound',
        status: 'sent',
        timestamp: '2026-01-16T10:00:00Z',
      },
      timestamp: '2026-01-16T10:00:00Z',
    };

    expect(event.event).toBe('message.sent');
    expect(event.payload.status).toBe('sent');
    expect(event.payload.direction).toBe('outbound');
  });
});

describe('MessageFailedEvent', () => {
  it('should create a valid message.failed event with retry', () => {
    const event: MessageFailedEvent = {
      event: 'message.failed',
      payload: {
        conversationId: 'conv-123',
        messageId: 'msg-456',
        error: 'Network timeout',
        retryAt: '2026-01-16T10:01:00Z',
        attempt: 1,
        timestamp: '2026-01-16T10:00:00Z',
      },
      timestamp: '2026-01-16T10:00:00Z',
    };

    expect(event.event).toBe('message.failed');
    expect(event.payload.attempt).toBe(1);
    expect(event.payload.retryAt).toBe('2026-01-16T10:01:00Z');
  });

  it('should create a valid message.failed event without retry (max attempts)', () => {
    const event: MessageFailedEvent = {
      event: 'message.failed',
      payload: {
        conversationId: 'conv-123',
        messageId: 'msg-456',
        error: 'Max retries exceeded',
        retryAt: null,
        attempt: 3,
        timestamp: '2026-01-16T10:00:00Z',
      },
      timestamp: '2026-01-16T10:00:00Z',
    };

    expect(event.payload.retryAt).toBeNull();
    expect(event.payload.attempt).toBe(3);
  });
});

describe('ConversationUpdatedEvent', () => {
  it('should create a valid conversation.updated event', () => {
    const event: ConversationUpdatedEvent = {
      event: 'conversation.updated',
      payload: {
        conversationId: 'conv-123',
        updatedFields: {
          status: 'pending',
          priority: 'high',
        },
        changedBy: 'user-456',
        timestamp: '2026-01-16T10:00:00Z',
      },
      timestamp: '2026-01-16T10:00:00Z',
    };

    expect(event.event).toBe('conversation.updated');
    expect(event.payload.updatedFields.status).toBe('pending');
    expect(event.payload.updatedFields.priority).toBe('high');
  });

  it('should support assignment changes', () => {
    const event: ConversationUpdatedEvent = {
      event: 'conversation.updated',
      payload: {
        conversationId: 'conv-123',
        updatedFields: {
          assignedUserId: 'user-789',
        },
        changedBy: null, // System change
        timestamp: '2026-01-16T10:00:00Z',
      },
      timestamp: '2026-01-16T10:00:00Z',
    };

    expect(event.payload.updatedFields.assignedUserId).toBe('user-789');
    expect(event.payload.changedBy).toBeNull();
  });
});

describe('ConversationReopenedEvent', () => {
  it('should create a valid conversation.reopened event', () => {
    const event: ConversationReopenedEvent = {
      event: 'conversation.reopened',
      payload: {
        conversation: {
          id: 'conv-123',
          channel: 'telegram',
          externalThreadId: 'tg-123456',
          title: 'Customer Support',
          status: 'open',
        },
        reason: 'new_inbound_message',
        reopenedBy: null,
        timestamp: '2026-01-16T10:00:00Z',
      },
      timestamp: '2026-01-16T10:00:00Z',
    };

    expect(event.event).toBe('conversation.reopened');
    expect(event.payload.conversation.status).toBe('open');
    expect(event.payload.reason).toBe('new_inbound_message');
  });
});

describe('NotificationReceivedEvent', () => {
  it('should create a valid notification.received event', () => {
    const event: NotificationReceivedEvent = {
      event: 'notification.received',
      payload: {
        notificationId: 'notif-123',
        userId: 'user-456',
        type: 'assignment',
        conversationId: 'conv-789',
        actorId: 'actor-012',
        actorName: 'Admin User',
        message: 'You have been assigned to a conversation',
        timestamp: '2026-01-16T10:00:00Z',
      },
      timestamp: '2026-01-16T10:00:00Z',
    };

    expect(event.event).toBe('notification.received');
    expect(event.payload.type).toBe('assignment');
  });

  it('should support conversation preview', () => {
    const event: NotificationReceivedEvent = {
      event: 'notification.received',
      payload: {
        notificationId: 'notif-123',
        userId: 'user-456',
        type: 'mention',
        conversationId: 'conv-789',
        actorId: 'actor-012',
        actorName: 'Team Member',
        message: 'You were mentioned in a note',
        conversationPreview: {
          id: 'conv-789',
          channel: 'telegram',
          latestMessage: 'Hello, I need help',
          senderName: 'Customer',
        },
        timestamp: '2026-01-16T10:00:00Z',
      },
      timestamp: '2026-01-16T10:00:00Z',
    };

    expect(event.payload.conversationPreview?.latestMessage).toBe(
      'Hello, I need help'
    );
  });
});

describe('PresenceUpdatedEvent', () => {
  it('should create a valid presence.updated event', () => {
    const event: PresenceUpdatedEvent = {
      event: 'presence.updated',
      payload: {
        userId: 'user-123',
        status: 'online',
        previousStatus: 'offline',
        timestamp: '2026-01-16T10:00:00Z',
      },
      timestamp: '2026-01-16T10:00:00Z',
    };

    expect(event.event).toBe('presence.updated');
    expect(event.payload.status).toBe('online');
    expect(event.payload.previousStatus).toBe('offline');
  });
});

describe('TypingStartedEvent', () => {
  it('should create a valid typing.started event', () => {
    const event: TypingStartedEvent = {
      event: 'typing.started',
      payload: {
        conversationId: 'conv-123',
        userId: 'user-456',
        userName: 'Agent Smith',
        timestamp: '2026-01-16T10:00:00Z',
      },
      timestamp: '2026-01-16T10:00:00Z',
    };

    expect(event.event).toBe('typing.started');
    expect(event.payload.conversationId).toBe('conv-123');
  });
});

describe('TypingStoppedEvent', () => {
  it('should create a valid typing.stopped event', () => {
    const event: TypingStoppedEvent = {
      event: 'typing.stopped',
      payload: {
        conversationId: 'conv-123',
        userId: 'user-456',
        timestamp: '2026-01-16T10:00:00Z',
      },
      timestamp: '2026-01-16T10:00:00Z',
    };

    expect(event.event).toBe('typing.stopped');
    expect(event.payload.userId).toBe('user-456');
  });
});

describe('WebSocketEvent discriminated union', () => {
  it('should allow all event types in union', () => {
    const events: WebSocketEvent[] = [
      {
        event: 'message.received',
        payload: {
          conversationId: 'conv-1',
          messageId: 'msg-1',
          platform: 'telegram',
          senderId: 'sender-1',
          senderName: 'User',
          body: 'Hello',
          direction: 'inbound',
          timestamp: '2026-01-16T10:00:00Z',
        },
        timestamp: '2026-01-16T10:00:00Z',
      },
      {
        event: 'message.sent',
        payload: {
          conversationId: 'conv-1',
          messageId: 'msg-1',
          direction: 'outbound',
          status: 'sent',
          timestamp: '2026-01-16T10:00:00Z',
        },
        timestamp: '2026-01-16T10:00:00Z',
      },
      {
        event: 'message.failed',
        payload: {
          conversationId: 'conv-1',
          messageId: 'msg-1',
          error: 'Error',
          retryAt: null,
          attempt: 3,
          timestamp: '2026-01-16T10:00:00Z',
        },
        timestamp: '2026-01-16T10:00:00Z',
      },
      {
        event: 'conversation.updated',
        payload: {
          conversationId: 'conv-1',
          updatedFields: { status: 'pending' },
          changedBy: null,
          timestamp: '2026-01-16T10:00:00Z',
        },
        timestamp: '2026-01-16T10:00:00Z',
      },
      {
        event: 'conversation.reopened',
        payload: {
          conversation: {
            id: 'conv-1',
            channel: 'telegram',
            externalThreadId: 'tg-1',
            status: 'open',
          },
          reason: 'new_inbound_message',
          reopenedBy: null,
          timestamp: '2026-01-16T10:00:00Z',
        },
        timestamp: '2026-01-16T10:00:00Z',
      },
      {
        event: 'notification.received',
        payload: {
          notificationId: 'notif-1',
          userId: 'user-1',
          type: 'assignment',
          conversationId: 'conv-1',
          actorId: 'actor-1',
          actorName: 'Admin',
          message: 'Assigned',
          timestamp: '2026-01-16T10:00:00Z',
        },
        timestamp: '2026-01-16T10:00:00Z',
      },
      {
        event: 'presence.updated',
        payload: {
          userId: 'user-1',
          status: 'online',
          timestamp: '2026-01-16T10:00:00Z',
        },
        timestamp: '2026-01-16T10:00:00Z',
      },
      {
        event: 'typing.started',
        payload: {
          conversationId: 'conv-1',
          userId: 'user-1',
          timestamp: '2026-01-16T10:00:00Z',
        },
        timestamp: '2026-01-16T10:00:00Z',
      },
      {
        event: 'typing.stopped',
        payload: {
          conversationId: 'conv-1',
          userId: 'user-1',
          timestamp: '2026-01-16T10:00:00Z',
        },
        timestamp: '2026-01-16T10:00:00Z',
      },
    ];

    expect(events).toHaveLength(9);
  });

  it('should narrow types correctly with switch statement', () => {
    const handleEvent = (event: WebSocketEvent): string => {
      switch (event.event) {
        case 'message.received':
          return `Message from ${event.payload.senderName}`;
        case 'message.sent':
          return `Message ${event.payload.messageId} sent`;
        case 'message.failed':
          return `Message failed: ${event.payload.error}`;
        case 'conversation.updated':
          return `Conversation ${event.payload.conversationId} updated`;
        case 'conversation.reopened':
          return `Conversation ${event.payload.conversation.id} reopened`;
        case 'notification.received':
          return `Notification: ${event.payload.message}`;
        case 'presence.updated':
          return `User ${event.payload.userId} is ${event.payload.status}`;
        case 'typing.started':
          return `User typing in ${event.payload.conversationId}`;
        case 'typing.stopped':
          return `User stopped typing in ${event.payload.conversationId}`;
      }
    };

    const event: WebSocketEvent = {
      event: 'message.received',
      payload: {
        conversationId: 'conv-1',
        messageId: 'msg-1',
        platform: 'telegram',
        senderId: 'sender-1',
        senderName: 'Test User',
        body: 'Hello',
        direction: 'inbound',
        timestamp: '2026-01-16T10:00:00Z',
      },
      timestamp: '2026-01-16T10:00:00Z',
    };

    expect(handleEvent(event)).toBe('Message from Test User');
  });
});

describe('Type guards', () => {
  const messageReceivedEvent: WebSocketEvent = {
    event: 'message.received',
    payload: {
      conversationId: 'conv-1',
      messageId: 'msg-1',
      platform: 'telegram',
      senderId: 'sender-1',
      senderName: 'User',
      body: 'Hello',
      direction: 'inbound',
      timestamp: '2026-01-16T10:00:00Z',
    },
    timestamp: '2026-01-16T10:00:00Z',
  };

  const conversationUpdatedEvent: WebSocketEvent = {
    event: 'conversation.updated',
    payload: {
      conversationId: 'conv-1',
      updatedFields: { status: 'pending' },
      changedBy: null,
      timestamp: '2026-01-16T10:00:00Z',
    },
    timestamp: '2026-01-16T10:00:00Z',
  };

  const notificationEvent: WebSocketEvent = {
    event: 'notification.received',
    payload: {
      notificationId: 'notif-1',
      userId: 'user-1',
      type: 'assignment',
      conversationId: 'conv-1',
      actorId: 'actor-1',
      actorName: 'Admin',
      message: 'Assigned',
      timestamp: '2026-01-16T10:00:00Z',
    },
    timestamp: '2026-01-16T10:00:00Z',
  };

  const presenceEvent: WebSocketEvent = {
    event: 'presence.updated',
    payload: {
      userId: 'user-1',
      status: 'online',
      timestamp: '2026-01-16T10:00:00Z',
    },
    timestamp: '2026-01-16T10:00:00Z',
  };

  describe('isMessageEvent', () => {
    it('should return true for message events', () => {
      expect(isMessageEvent(messageReceivedEvent)).toBe(true);
    });

    it('should return false for non-message events', () => {
      expect(isMessageEvent(conversationUpdatedEvent)).toBe(false);
      expect(isMessageEvent(notificationEvent)).toBe(false);
      expect(isMessageEvent(presenceEvent)).toBe(false);
    });
  });

  describe('isConversationEvent', () => {
    it('should return true for conversation events', () => {
      expect(isConversationEvent(conversationUpdatedEvent)).toBe(true);
    });

    it('should return false for non-conversation events', () => {
      expect(isConversationEvent(messageReceivedEvent)).toBe(false);
      expect(isConversationEvent(notificationEvent)).toBe(false);
      expect(isConversationEvent(presenceEvent)).toBe(false);
    });
  });

  describe('isNotificationEvent', () => {
    it('should return true for notification events', () => {
      expect(isNotificationEvent(notificationEvent)).toBe(true);
    });

    it('should return false for non-notification events', () => {
      expect(isNotificationEvent(messageReceivedEvent)).toBe(false);
      expect(isNotificationEvent(conversationUpdatedEvent)).toBe(false);
      expect(isNotificationEvent(presenceEvent)).toBe(false);
    });
  });

  describe('isPresenceEvent', () => {
    it('should return true for presence events', () => {
      expect(isPresenceEvent(presenceEvent)).toBe(true);
    });

    it('should return false for non-presence events', () => {
      expect(isPresenceEvent(messageReceivedEvent)).toBe(false);
      expect(isPresenceEvent(conversationUpdatedEvent)).toBe(false);
      expect(isPresenceEvent(notificationEvent)).toBe(false);
    });
  });
});
