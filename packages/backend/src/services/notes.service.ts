import { eq, desc } from 'drizzle-orm';
import { dbClient } from '../infrastructure/db.client';
import { logger } from '../infrastructure/logger';
import { conversations } from '../schemas/conversation.schema';
import { notes } from '../schemas/note.schema';
import { notifications } from '../schemas/notification.schema';
import type { CreateNoteRequest, NoteResponse, NoteCreationResult, ListNotesServiceResponse } from '../types/notes.types';
import { auditService } from './audit.service';
import { mentionParserService } from './mention-parser.service';

/**
 * Notes Service
 * Handles note creation, listing, and mention parsing/notification
 */
export class NotesService {
  /**
   * Create a new note with mention parsing and notification
   */
  async createNote(
    userId: string,
    conversationId: string,
    request: CreateNoteRequest
  ): Promise<NoteCreationResult> {
    const { body } = request;

    try {
      // Validate input
      if (!body || body.trim().length === 0) {
        throw new Error('Note body is required');
      }

      if (body.length > 10000) {
        throw new Error('Note body must be 10000 characters or less');
      }

      // Verify conversation exists
      const conversation = await dbClient
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);

      if (conversation.length === 0) {
        throw new Error('Conversation not found');
      }

      // Parse mentions from note body
      const mentionedUserIds = await mentionParserService.parseMentions(body);

      // Create note with mentions metadata
      const result = await dbClient
        .insert(notes)
        .values({
          conversationId,
          authorId: userId,
          body: body.trim(),
          mentions: mentionedUserIds.length > 0 ? mentionedUserIds : null,
        })
        .returning();

      const createdNote = result[0];

      // Create notifications for mentioned users
      if (mentionedUserIds.length > 0) {
        await this.createMentionNotifications(
          userId,
          conversationId,
          mentionedUserIds,
          body
        );
      }

      // Log audit event
      await this.logAudit({
        actorId: userId,
        action: 'note.created',
        conversationId,
        metadata: {
          noteLength: body.length,
          mentionCount: mentionedUserIds.length,
        },
      });

      logger.info(
        {
          noteId: createdNote.id,
          userId,
          conversationId,
          mentionCount: mentionedUserIds.length,
        },
        'Note created successfully'
      );

      // Convert to response DTO
      const noteResponse: NoteResponse = {
        id: createdNote.id,
        conversationId: createdNote.conversationId,
        authorId: createdNote.authorId,
        body: createdNote.body,
        mentions: mentionedUserIds,
        createdAt: createdNote.createdAt.toISOString(),
        updatedAt: createdNote.updatedAt.toISOString(),
      };

      return {
        note: noteResponse,
        mentionedUserIds,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: message, userId, conversationId },
        'Failed to create note'
      );
      throw error;
    }
  }

  /**
   * List notes for a conversation with pagination
   */
  async listNotes(
    conversationId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<ListNotesServiceResponse> {
    try {
      // Validate conversation exists
      const conversation = await dbClient
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);

      if (conversation.length === 0) {
        throw new Error('Conversation not found');
      }

      const offset = (page - 1) * limit;

      // Get total count
      const countResult = await dbClient
        .select()
        .from(notes)
        .where(eq(notes.conversationId, conversationId));

      const total = countResult.length;

      // Get paginated notes
      const noteList = await dbClient
        .select()
        .from(notes)
        .where(eq(notes.conversationId, conversationId))
        .orderBy(desc(notes.createdAt))
        .limit(limit)
        .offset(offset);

      // Convert to response DTOs
      const noteResponses: NoteResponse[] = noteList.map((note) => ({
        id: note.id,
        conversationId: note.conversationId,
        authorId: note.authorId,
        body: note.body,
        mentions: note.mentions as string[] | undefined,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
      }));

      logger.info(
        { conversationId, page, count: noteList.length, total },
        'Notes listed successfully'
      );

      return {
        data: noteResponses,
        total,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: message, conversationId },
        'Failed to list notes'
      );
      throw error;
    }
  }

  /**
   * Create mention notifications for mentioned users
   * Silent failure - if notification creation fails, note still posts
   */
  private async createMentionNotifications(
    authorId: string,
    conversationId: string,
    mentionedUserIds: string[],
    noteBody: string
  ) {
    try {
      // Create notification for each mentioned user
      const notificationValues = mentionedUserIds.map((userId) => ({
        userId,
        type: 'mention',
        conversationId,
        actorId: authorId,
        message: `@mentioned in a note`,
        metadata: {
          mentionedInNote: true,
          noteExcerpt: noteBody.substring(0, 100), // First 100 chars
        },
      }));

      await dbClient.insert(notifications).values(notificationValues);

      logger.debug(
        { conversationId, mentionedCount: mentionedUserIds.length },
        'Mention notifications created'
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(
        { error: message, conversationId, mentionedCount: mentionedUserIds.length },
        'Failed to create mention notifications'
      );
      // Silent failure - note was already created, notifications are optional
    }
  }

  /**
   * Log audit event for note operations
   */
  private async logAudit(params: {
    actorId: string;
    action: string;
    conversationId: string;
    metadata?: Record<string, unknown>;
  }) {
    try {
      const { actorId, action, conversationId, metadata } = params;

      await auditService.logAction({
        actorId,
        action,
        entityType: 'conversation',
        entityId: conversationId,
        metadata,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(
        { error: message },
        'Failed to log audit event for note'
      );
      // Don't throw - audit failures shouldn't break application
    }
  }
}

export const notesService = new NotesService();
