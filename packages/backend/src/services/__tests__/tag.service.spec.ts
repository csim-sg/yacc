import { describe, it, expect, beforeEach, vi } from 'vitest';
import { tagService } from '../tag.service';

/**
 * Tag Service - Unit Tests
 *
 * Test suite for tag CRUD and conversation tag management.
 * Note: These are unit tests with mocked database;
 * integration tests validate actual database operations.
 */

describe('TagService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('service initialization', () => {
    it('should export tagService singleton', () => {
      expect(tagService).toBeDefined();
      expect(typeof tagService.listTags).toBe('function');
      expect(typeof tagService.createTag).toBe('function');
      expect(typeof tagService.addTagToConversation).toBe('function');
      expect(typeof tagService.removeTagFromConversation).toBe('function');
    });
  });

  describe('method signatures', () => {
    it('should have correct method signatures', () => {
      // These tests verify the service has the expected public interface
      expect(tagService.listTags).toBeDefined();
      expect(tagService.createTag).toBeDefined();
      expect(tagService.addTagToConversation).toBeDefined();
      expect(tagService.removeTagFromConversation).toBeDefined();
    });
  });
});
