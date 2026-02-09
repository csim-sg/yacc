/**
 * REST API Controllers - Unified export for all routing-controllers
 *
 * These controllers handle HTTP endpoints using the routing-controllers library.
 *
 * Controllers:
 * - AuthController: Authentication endpoints (sign-up, sign-in, forgot password)
 * - ConversationsController: Inbox & conversation management
 * - AuditController: Audit logging endpoints
 * - HealthController: Health check endpoints
 * - QueueController: Message queue status endpoints
 */

import { AuthController } from './auth.controller.js';
import { ConversationsController } from './conversations.controller.js';
import { DLQController } from './dlq.controller.js';
import { MessageController } from './message.controller.js';
import { AuditController } from './audit.controller.js';
import { HealthController } from './health.controller.js';
import { QueueController } from './queue.controller.js';

export const controllers = [
  AuthController,
  ConversationsController,
  DLQController,
  MessageController,
  AuditController,
  HealthController,
  QueueController,
];
