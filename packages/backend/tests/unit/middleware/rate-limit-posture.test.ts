/**
 * PREREQ-ANG-003 (#408) — RC-2 limiter posture + safety tests.
 *
 * Contract under test (production protections must remain unchanged):
 * - login:          5 requests  / 15 minutes / IP
 * - password reset: 3 requests  / 1 hour     / IP
 * - API:            100 requests / 15 minutes / IP
 *
 * The deterministic non-production (test) posture may only be active when the
 * environment is explicitly a test environment (`APP_ENV === 'test'` or
 * `NODE_ENV === 'test'`) and must be unreachable when `APP_ENV === 'production'`.
 *
 * @see packages/backend/src/config/rateLimit.config.ts
 * @see https://github.com/csim-sg/yacc/issues/408
 */

import type { Express } from 'express';
import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type RateLimitConfig,
  rateLimitConfig,
  resolveRateLimitConfig,
} from '../../../src/config/rateLimit.config';

const PRODUCTION_RATE_LIMITS: RateLimitConfig = {
  login: { windowMs: 15 * 60 * 1000, max: 5 },
  passwordReset: { windowMs: 60 * 60 * 1000, max: 3 },
  api: { windowMs: 15 * 60 * 1000, max: 100 },
};

const LOGIN_429_MESSAGE = { error: 'Too many login attempts. Please try again in 15 minutes.' };
const RESET_429_MESSAGE = { error: 'Too many password reset attempts. Please try again in 1 hour.' };
const API_429_MESSAGE = { error: 'Rate limit exceeded. Please try again later.' };

describe('rate limit posture resolution (config gate)', () => {
  it('keeps exact production values when APP_ENV is production', () => {
    expect(resolveRateLimitConfig({ APP_ENV: 'production' })).toEqual(PRODUCTION_RATE_LIMITS);
  });

  it('keeps exact production values when APP_ENV is development (posture inactive outside test)', () => {
    expect(resolveRateLimitConfig({ APP_ENV: 'development' })).toEqual(PRODUCTION_RATE_LIMITS);
  });

  it('keeps exact production values when no environment is set', () => {
    expect(resolveRateLimitConfig({})).toEqual(PRODUCTION_RATE_LIMITS);
  });

  it('is unreachable in production even if NODE_ENV is test', () => {
    expect(resolveRateLimitConfig({ APP_ENV: 'production', NODE_ENV: 'test' })).toEqual(
      PRODUCTION_RATE_LIMITS
    );
  });

  it('activates the posture when APP_ENV is test', () => {
    expect(resolveRateLimitConfig({ APP_ENV: 'test' })).not.toEqual(PRODUCTION_RATE_LIMITS);
    expect(resolveRateLimitConfig({ APP_ENV: 'test' }).login.max).toBeGreaterThan(
      PRODUCTION_RATE_LIMITS.login.max
    );
  });

  it('activates the posture when NODE_ENV is test and APP_ENV is not production', () => {
    expect(resolveRateLimitConfig({ NODE_ENV: 'test' })).not.toEqual(PRODUCTION_RATE_LIMITS);
    expect(resolveRateLimitConfig({ APP_ENV: 'development', NODE_ENV: 'test' })).not.toEqual(
      PRODUCTION_RATE_LIMITS
    );
  });

  it('keeps the 15m/1h windows identical in both postures', () => {
    const testPosture = resolveRateLimitConfig({ APP_ENV: 'test' });
    expect(testPosture.login.windowMs).toBe(PRODUCTION_RATE_LIMITS.login.windowMs);
    expect(testPosture.passwordReset.windowMs).toBe(PRODUCTION_RATE_LIMITS.passwordReset.windowMs);
    expect(testPosture.api.windowMs).toBe(PRODUCTION_RATE_LIMITS.api.windowMs);
  });

  it('uses the test posture for the loaded module under vitest (NODE_ENV=test)', () => {
    expect(rateLimitConfig).not.toEqual(PRODUCTION_RATE_LIMITS);
    expect(rateLimitConfig.login.max).toBeGreaterThan(PRODUCTION_RATE_LIMITS.login.max);
  });
});

describe('rate limiter middleware behavior', () => {
  const originalAppEnv = process.env.APP_ENV;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalAppEnv === undefined) {
      delete process.env.APP_ENV;
    } else {
      process.env.APP_ENV = originalAppEnv;
    }
    process.env.NODE_ENV = originalNodeEnv;
    vi.resetModules();
  });

  async function loadProductionLimiters(): Promise<{
    app: Express;
    loginRateLimiter: express.RequestHandler;
    passwordResetRateLimiter: express.RequestHandler;
    apiRateLimiter: express.RequestHandler;
  }> {
    vi.resetModules();
    process.env.APP_ENV = 'production';
    process.env.NODE_ENV = 'production';
    const middleware = await import('../../../src/middleware/rateLimit.middleware');

    const app = express();
    app.post('/login', middleware.loginRateLimiter, (_req, res) => res.status(200).json({ ok: true }));
    app.post('/reset', middleware.passwordResetRateLimiter, (_req, res) =>
      res.status(200).json({ ok: true })
    );
    app.get('/api', middleware.apiRateLimiter, (_req, res) => res.status(200).json({ ok: true }));
    return {
      app,
      loginRateLimiter: middleware.loginRateLimiter,
      passwordResetRateLimiter: middleware.passwordResetRateLimiter,
      apiRateLimiter: middleware.apiRateLimiter,
    };
  }

  it('blocks the 6th login within the window in production (5/15m per IP unchanged)', async () => {
    const { app } = await loadProductionLimiters();

    for (let i = 0; i < 5; i++) {
      await request(app).post('/login').expect(200);
    }
    const blocked = await request(app).post('/login').expect(429);
    expect(blocked.body).toEqual(LOGIN_429_MESSAGE);
    // Limit header proves the contractual max is wired
    expect(blocked.headers['ratelimit-limit']).toBe('5');
    expect(blocked.headers['ratelimit-policy']).toContain('w=900');
  });

  it('blocks the 4th password reset within the hour in production (3/1h per IP unchanged)', async () => {
    const { app } = await loadProductionLimiters();

    for (let i = 0; i < 3; i++) {
      await request(app).post('/reset').expect(200);
    }
    const blocked = await request(app).post('/reset').expect(429);
    expect(blocked.body).toEqual(RESET_429_MESSAGE);
    expect(blocked.headers['ratelimit-limit']).toBe('3');
    expect(blocked.headers['ratelimit-policy']).toContain('w=3600');
  });

  it('blocks the 101st API request within the window in production (100/15m per IP unchanged)', async () => {
    const { app } = await loadProductionLimiters();

    for (let i = 0; i < 100; i++) {
      await request(app).get('/api').expect(200);
    }
    const blocked = await request(app).get('/api').expect(429);
    expect(blocked.body).toEqual(API_429_MESSAGE);
    expect(blocked.headers['ratelimit-limit']).toBe('100');
  });

  it('does not block the 6th login under the test posture (full E2E runs stay deterministic)', async () => {
    // Under vitest NODE_ENV=test, the loaded module uses the relaxed posture
    const { loginRateLimiter } = await import('../../../src/middleware/rateLimit.middleware');
    const app = express();
    app.post('/login', loginRateLimiter, (_req, res) => res.status(200).json({ ok: true }));

    for (let i = 0; i < 6; i++) {
      await request(app).post('/login').expect(200);
    }
  });
});
