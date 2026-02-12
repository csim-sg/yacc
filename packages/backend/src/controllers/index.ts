/**
 * REST API Controllers - Unified export for all routing-controllers
 *
 * These controllers handle HTTP endpoints using the routing-controllers library.
 *
 * Controllers:
 * - AuthController: Authentication endpoints (sign-up, sign-in, forgot password)
 * - ConversationsController: Inbox & conversation management
 * - TagsController: Tag CRUD endpoints
 * - NotesController: Note CRUD endpoints with @mention parsing
 * - AssignmentsController: Conversation assignment endpoints
 * - NotificationsController: Notification CRUD endpoints
 * - RoutingRulesController: Routing rules CRUD + evaluation endpoints
 * - BulkActionsController: Bulk action endpoints (assign/tag/status)
 * - AuditController: Audit logging endpoints
 * - HealthController: Health check endpoints
 * - QueueController: Message queue status endpoints
 */

import { AssignmentsController } from './assignments.controller.js';
import { AuditController } from './audit.controller.js';
import { AuditLogsQueryController } from './auditLogsQuery.controller.js';
import { AuthController } from './auth.controller.js';
import { BulkActionsController } from './bulkActions.controller.js';
import { ConversationsController } from './conversations.controller.js';
import { DLQController } from './dlq.controller.js';
import { HealthController } from './health.controller.js';
import { MessageController } from './message.controller.js';
import { NotesController } from './notes.controller.js';
import { NotificationsController } from './notifications.controller.js';
import { QueueController } from './queue.controller.js';
import { RoutingRulesController } from './routing-rules.controller.js';
import { TagsController } from './tags.controller.js';

export const controllers = [
  AssignmentsController,
  AuditController,
  AuditLogsQueryController,
  AuthController,
  BulkActionsController,
  ConversationsController,
  DLQController,
  HealthController,
  MessageController,
  NotesController,
  NotificationsController,
  QueueController,
  RoutingRulesController,
  TagsController,
];
