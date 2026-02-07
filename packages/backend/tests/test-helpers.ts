/**
 * Test helpers for integration tests (BE-007, etc.)
 * - createTestApp: returns Express app from src/app (no server listen)
 * - createTestUser: logs in via POST /auth/sign-in/email, returns { id, token }
 * - seedTestConversations: inserts test conversations (requires DB)
 *
 * Prerequisites for full run: test DB with migrations, and a user (e.g. run db:fixtures or seed).
 */

import type { Express } from 'express';
import request from 'supertest';

export interface TestUserOptions {
  email: string;
  password: string;
  role?: string;
}

export interface TestUser {
  id: string;
  token: string;
}

/**
 * Returns a fully configured Express app for testing.
 * Sets up routing-controllers with same configuration as src/index.ts.
 */
export async function createTestApp(): Promise<Express> {
  const express = await import('express');
  const { useExpressServer } = await import('routing-controllers');
  const { authorizationChecker, currentUserChecker } = await import('../src/middleware/routingControllersAuth');
  const { correlationIdMiddleware } = await import('../src/middleware/correlationId.middleware');
  const { requestLoggingMiddleware } = await import('../src/middleware/requestLogging.middleware');
  const { controllers } = await import('../src/controllers');
  const { appConfig } = await import('../src/config/appConfig');

  const testApp = express.default();

  useExpressServer(testApp, {
    controllers: controllers,
    authorizationChecker: authorizationChecker,
    currentUserChecker: currentUserChecker,
    defaultErrorHandler: true,
    validation: {
      whitelist: true,
      forbidNonWhitelisted: true,
    },
    classTransformer: true,
    cors: {
      origin: appConfig.APP_FRONTEND_URL,
      credentials: true,
      exposedHeaders: ['set-auth-token', 'x-total-count', 'x-current-page', 'x-total-pages'],
    },
    middlewares: [
      correlationIdMiddleware,
      requestLoggingMiddleware,
    ],
  });

  return testApp as Express;
}

/**
 * Logs in via POST /auth/sign-in/email and returns user id and token.
 * The user must exist in the database (e.g. seed-test-fixtures or db:fixtures).
 */
export async function createTestUser(app: Express, options: TestUserOptions): Promise<TestUser> {
  const res = await request(app)
    .post('/auth/sign-in/email')
    .set('Content-Type', 'application/json')
    .send({ email: options.email, password: options.password });

  if (res.status !== 200) {
    throw new Error(
      `Login failed: ${res.status} - ${JSON.stringify(res.body)}`
    );
  }

  // BetterAuth sign-in/email returns { user, accessToken, refreshToken } at top level
  const body = res.body as {
    user?: { id: string };
    accessToken?: string;
    refreshToken?: string;
    session?: { accessToken?: string; token?: string };
    token?: string;
  };
  const id = body.user?.id;
  const token =
    body.accessToken ??
    body.session?.accessToken ??
    body.session?.token ??
    body.token ??
    (res.headers['set-auth-token'] as string) ??
    (Array.isArray(res.headers['set-cookie'])
      ? res.headers['set-cookie'][0]?.split(';')[0]?.replace(/^[^=]+=/, '')
      : undefined);

  if (!id || !token) {
    throw new Error(
      `Login response missing id or token: ${JSON.stringify(body)}`
    );
  }

  return { id, token };
}

/**
 * Seeds the database with test conversations for the given user.
 * Requires dbClient and conversation schema. userId is UUID (optional assignee).
 */
export async function seedTestConversations(
  userId: string,
  count: number
): Promise<void> {
  const { dbClient } = await import('../src/infrastructure/db.client.js');
  const { conversations } = await import('../src/schemas/conversation.schema.js');

  for (let i = 0; i < count; i++) {
    await dbClient.insert(conversations).values({
      channel: i % 2 === 0 ? 'telegram' : 'irc',
      externalThreadId: `test-${Date.now()}-${i}`,
      title: `Test conversation ${i}`,
      status: i % 3 === 0 ? 'open' : i % 3 === 1 ? 'pending' : 'resolved',
      priority: (['low', 'medium', 'high', 'urgent'] as const)[i % 4],
      assignedUserId: i % 5 === 0 ? null : userId,
    }).onConflictDoNothing();
  }
}
