import { ilike } from 'drizzle-orm';
import { users } from '../schemas/user.schema';
import { dbClient } from '../infrastructure/db.client';
import { logger } from '../infrastructure/logger';

/**
 * Mention Parser Service
 * Extracts @mention syntax from note bodies and resolves mentions to user IDs
 */
export class MentionParserService {
  /**
   * Pattern to match @mentions in text
   * Matches @username where username is alphanumeric/underscore
   */
  private readonly MENTION_PATTERN = /@(\w+)/g;

  /**
   * Extract mentions from a note body
   * Returns list of @mentions found (without the @ symbol)
   */
  extractMentions(body: string): string[] {
    try {
      const mentions: string[] = [];
      const matches = body.matchAll(this.MENTION_PATTERN);

      for (const match of matches) {
        const mention = match[1]; // Capture group 1: the username part
        if (mention && !mentions.includes(mention)) {
          mentions.push(mention);
        }
      }

      return mentions;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(
        { error: message, bodyLength: body.length },
        'Failed to extract mentions'
      );
      return [];
    }
  }

  /**
   * Resolve mentions to user IDs
   * Matches mention against user email local-parts (case-insensitive)
   * Returns only matched user IDs; silent if no matches
   */
  async resolveMentions(mentions: string[]): Promise<string[]> {
    if (mentions.length === 0) {
      return [];
    }

    try {
      const matchedUserIds: string[] = [];

      // For each mention, try to find a matching user by email local-part
      for (const mention of mentions) {
        // User email format: "username@domain.com"
        // We match against "username" (local-part), case-insensitive
        const searchPattern = `${mention}@%`; // Matches any domain

        const matchedUsers = await dbClient
          .select({ id: users.id })
          .from(users)
          .where(ilike(users.email, searchPattern))
          .limit(1);

        if (matchedUsers.length > 0) {
          matchedUserIds.push(matchedUsers[0].id);
        }
        // Silent failure if no match found - note still posts, just no notification
      }

      logger.debug(
        { mentions, matchedCount: matchedUserIds.length },
        'Resolved mentions to user IDs'
      );

      return matchedUserIds;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: message, mentionCount: mentions.length },
        'Failed to resolve mentions'
      );
      // Silent failure - return empty list so note still posts
      return [];
    }
  }

  /**
   * Parse and resolve mentions in one step
   * Extracts mentions and resolves them to user IDs
   */
  async parseMentions(body: string): Promise<string[]> {
    try {
      const mentions = this.extractMentions(body);
      const userIds = await this.resolveMentions(mentions);
      return userIds;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: message },
        'Failed to parse mentions'
      );
      // Silent failure - return empty list
      return [];
    }
  }
}

export const mentionParserService = new MentionParserService();
