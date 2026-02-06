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

import { AuthController } from './auth.controller';
import { ConversationsController } from './conversations.controller';
import { AuditController } from './audit.controller';
import { HealthController } from './health.controller';
import { QueueController } from './queue.controller';

export const controllers = [
  AuthController,
  ConversationsController,
  AuditController,
  HealthController,
  QueueController,
];
