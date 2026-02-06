/**
 * Socket Controllers - Unified export for all WebSocket event handlers
 *
 * These controllers use the socket-controllers library to handle WebSocket events
 * declaratively using decorators instead of manual event registration.
 *
 * Controllers:
 * - ConversationController: Room management (join/leave/list)
 * - MessageController: Message events (sent, failed, retry)
 * - TypingController: Typing indicators and timeouts
 * - PresenceController: User online/offline/status updates
 * - ReactionController: Message reactions (add, remove, list)
 * - ConnectorController: External platform integration events (Telegram, IRC)
 */

import { ConversationController } from './conversation.controller';
import { MessageController } from './message.controller';
import { TypingController } from './typing.controller';
import { PresenceController } from './presence.controller';
import { ReactionController } from './reaction.controller';
import { ConnectorController } from './connector.controller';

export const socketControllers = [
  ConversationController,
  MessageController,
  TypingController,
  PresenceController,
  ReactionController,
  ConnectorController,
];
