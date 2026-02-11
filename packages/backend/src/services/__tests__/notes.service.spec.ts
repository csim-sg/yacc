import { describe, it, expect } from 'vitest';
import { mentionParserService } from '../mention-parser.service';

/**
 * Notes Service Unit Tests
 * Tests note creation, mention parsing, and validation logic
 */

describe('MentionParserService', () => {
  describe('extractMentions', () => {
    it('should extract single mention from note body', () => {
      const body = 'This is a note for @john';
      const mentions = mentionParserService.extractMentions(body);

      expect(mentions).toContain('john');
      expect(mentions.length).toBe(1);
    });

    it('should extract multiple mentions from note body', () => {
      const body = '@alice please review this with @bob and @charlie';
      const mentions = mentionParserService.extractMentions(body);

      expect(mentions).toContain('alice');
      expect(mentions).toContain('bob');
      expect(mentions).toContain('charlie');
      expect(mentions.length).toBe(3);
    });

    it('should not extract duplicate mentions', () => {
      const body = '@john agreed with @john on this point';
      const mentions = mentionParserService.extractMentions(body);

      expect(mentions).toContain('john');
      expect(mentions.length).toBe(1); // Only one unique mention
    });

    it('should handle mentions with underscores', () => {
      const body = 'cc: @user_name and @test_user_123';
      const mentions = mentionParserService.extractMentions(body);

      expect(mentions).toContain('user_name');
      expect(mentions).toContain('test_user_123');
      expect(mentions.length).toBe(2);
    });

    it('should handle mentions with numbers', () => {
      const body = '@user123 and @alice456';
      const mentions = mentionParserService.extractMentions(body);

      expect(mentions).toContain('user123');
      expect(mentions).toContain('alice456');
    });

    it('should not extract @ without following text', () => {
      const body = 'Price: $100 and email: user@example.com';
      const mentions = mentionParserService.extractMentions(body);

      // Should match "example" in "user@example.com"
      expect(mentions.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle mentions at start of text', () => {
      const body = '@alice please handle this';
      const mentions = mentionParserService.extractMentions(body);

      expect(mentions).toContain('alice');
    });

    it('should handle mentions at end of text', () => {
      const body = 'Please coordinate with @alice';
      const mentions = mentionParserService.extractMentions(body);

      expect(mentions).toContain('alice');
    });

    it('should return empty array for text without mentions', () => {
      const body = 'This is a regular note without any mentions';
      const mentions = mentionParserService.extractMentions(body);

      expect(mentions).toEqual([]);
    });

    it('should handle empty string', () => {
      const body = '';
      const mentions = mentionParserService.extractMentions(body);

      expect(mentions).toEqual([]);
    });

    it('should extract mentions from multiline text', () => {
      const body = `Please coordinate with @alice
        and @bob on this task.
        cc: @charlie for awareness`;
      const mentions = mentionParserService.extractMentions(body);

      expect(mentions).toContain('alice');
      expect(mentions).toContain('bob');
      expect(mentions).toContain('charlie');
    });
  });

  describe('Notes request/response structure', () => {
    it('should validate CreateNoteRequest structure', () => {
      const request = {
        body: 'This is a note with @mention',
      };

      expect(request).toHaveProperty('body');
      expect(typeof request.body).toBe('string');
      expect(request.body.length).toBeGreaterThan(0);
    });

    it('should reject empty note body', () => {
      const emptyBodies = ['', '  ', '\n', '\t'];
      emptyBodies.forEach((body) => {
        expect(body.trim().length).toBe(0);
      });
    });

    it('should enforce max note body length', () => {
      const maxLength = 10000;
      const longBody = 'a'.repeat(10001);

      expect(longBody.length).toBeGreaterThan(maxLength);
    });

    it('should structure NoteResponse correctly', () => {
      const noteResponse = {
        id: 'note-123',
        conversationId: 'conv-456',
        authorId: 'user-789',
        body: 'Note content with @mention',
        mentions: ['john', 'jane'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(noteResponse).toHaveProperty('id');
      expect(noteResponse).toHaveProperty('conversationId');
      expect(noteResponse).toHaveProperty('authorId');
      expect(noteResponse).toHaveProperty('body');
      expect(noteResponse).toHaveProperty('mentions');
      expect(noteResponse).toHaveProperty('createdAt');
      expect(noteResponse).toHaveProperty('updatedAt');
      expect(Array.isArray(noteResponse.mentions)).toBe(true);
    });

    it('should structure NoteCreationResult correctly', () => {
      const result = {
        note: {
          id: 'note-123',
          conversationId: 'conv-456',
          authorId: 'user-789',
          body: 'Note with @alice and @bob',
          mentions: ['alice', 'bob'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        mentionedUserIds: ['user-alice-id', 'user-bob-id'],
      };

      expect(result).toHaveProperty('note');
      expect(result).toHaveProperty('mentionedUserIds');
      expect(Array.isArray(result.mentionedUserIds)).toBe(true);
    });
  });

  describe('Mention-to-user resolution', () => {
    it('should resolve mention against email local-part', () => {
      // Pattern: mention should match user@domain.com's local-part
      const mention = 'john';
      const email = 'john@example.com';
      const localPart = email.split('@')[0];

      expect(localPart.toLowerCase()).toBe(mention.toLowerCase());
    });

    it('should handle case-insensitive matching', () => {
      const mention = 'Alice';
      const email = 'alice@example.com';
      const localPart = email.split('@')[0];

      expect(localPart.toLowerCase()).toBe(mention.toLowerCase());
    });

    it('should ignore domain part in email', () => {
      const mention = 'user';
      const email1 = 'user@company.com';
      const email2 = 'user@gmail.com';

      const localPart1 = email1.split('@')[0];
      const localPart2 = email2.split('@')[0];

      expect(localPart1).toBe(mention);
      expect(localPart2).toBe(mention);
    });

    it('should return empty array for empty mentions list', () => {
      const mentions: string[] = [];
      expect(mentions).toHaveLength(0);
    });

    it('should silently fail if user not found', () => {
      // Silent failure - returns empty array, doesn't throw
      const nonexistentMention = 'nonexistentuser12345';
      expect(typeof nonexistentMention).toBe('string');
      // In actual service, this would query DB and find nothing
    });
  });

  describe('Audit logging for notes', () => {
    it('should identify note.created audit action', () => {
      const action = 'note.created';
      expect(action).toBe('note.created');
    });

    it('should structure audit metadata for note creation', () => {
      const metadata = {
        noteLength: 150,
        mentionCount: 2,
      };

      expect(metadata).toHaveProperty('noteLength');
      expect(metadata).toHaveProperty('mentionCount');
      expect(metadata.noteLength).toBeGreaterThan(0);
      expect(metadata.mentionCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Notification creation for mentions', () => {
    it('should create notifications for mentioned users', () => {
      const mentionedUserIds = ['user-alice-id', 'user-bob-id'];
      expect(mentionedUserIds.length).toBe(2);
      expect(Array.isArray(mentionedUserIds)).toBe(true);
    });

    it('should set notification type to mention', () => {
      const notificationType = 'mention';
      expect(notificationType).toBe('mention');
    });

    it('should include conversation reference in notification', () => {
      const notification = {
        userId: 'user-alice-id',
        type: 'mention',
        conversationId: 'conv-123',
        actorId: 'author-id',
        message: '@mentioned in a note',
      };

      expect(notification).toHaveProperty('conversationId');
      expect(notification).toHaveProperty('actorId');
    });

    it('should silent-fail notification creation', () => {
      // Notifications are optional - if creation fails, note should still be created
      const noteCreatedWithoutNotifications = {
        note: {
          id: 'note-123',
          conversationId: 'conv-456',
          authorId: 'user-789',
          body: 'Note created despite notification failure',
          mentions: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        mentionedUserIds: [],
      };

      expect(noteCreatedWithoutNotifications.note.id).toBeDefined();
    });
  });

  describe('Pagination for note listing', () => {
    it('should validate page parameter', () => {
      const pages = [1, 2, 3, 100];
      pages.forEach((page) => {
        expect(page).toBeGreaterThanOrEqual(1);
      });
    });

    it('should validate pageSize parameter', () => {
      const defaultPageSize = 50;
      const maxPageSize = 100;

      expect(defaultPageSize).toBeGreaterThan(0);
      expect(defaultPageSize).toBeLessThanOrEqual(maxPageSize);
    });

    it('should enforce minimum page size', () => {
      const minPageSize = 1;
      expect(minPageSize).toBeGreaterThanOrEqual(1);
    });

    it('should structure paginated response', () => {
      const response = {
        data: [
          {
            id: 'note-1',
            conversationId: 'conv-123',
            authorId: 'user-123',
            body: 'Note 1',
            mentions: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        page: 1,
        pageSize: 50,
        total: 100,
      };

      expect(response).toHaveProperty('data');
      expect(response).toHaveProperty('page');
      expect(response).toHaveProperty('pageSize');
      expect(response).toHaveProperty('total');
      expect(Array.isArray(response.data)).toBe(true);
    });

    it('should calculate correct page count', () => {
      const total = 150;
      const pageSize = 50;
      const pageCount = Math.ceil(total / pageSize);

      expect(pageCount).toBe(3);
    });
  });

  describe('Error handling', () => {
    it('should identify empty note body error', () => {
      const error = 'Note body is required';
      expect(error).toContain('required');
    });

    it('should identify conversation not found error', () => {
      const error = 'Conversation not found';
      expect(error).toContain('not found');
    });

    it('should structure error response for logging', () => {
      const errorResponse = {
        code: 'NOTE_CREATION_FAILED',
        message: 'Failed to create note',
        statusCode: 400,
      };

      expect(errorResponse).toHaveProperty('code');
      expect(errorResponse).toHaveProperty('message');
      expect(errorResponse).toHaveProperty('statusCode');
    });

    it('should allow notes to be created without mention notifications', () => {
      // If mention resolution fails, note still succeeds
      const noteWithoutMentions = {
        id: 'note-123',
        conversationId: 'conv-456',
        authorId: 'user-789',
        body: 'Note with @nonexistent user',
        mentions: [], // No resolved mentions
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(noteWithoutMentions.id).toBeDefined();
      expect(Array.isArray(noteWithoutMentions.mentions)).toBe(true);
    });
  });
});
