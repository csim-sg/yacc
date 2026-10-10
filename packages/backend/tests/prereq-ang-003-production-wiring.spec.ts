/**
 * PREREQ-ANG-003 (#408) — RC-1 regression test.
 *
 * Exercises the REAL production entrypoint wiring (`src/index.ts`), not
 * `createTestApp()` from `tests/test-helpers.ts`. This is the gap that let the
 * regression slip: the test helper registers `bodyParserMiddleware` via
 * `app.use()` (correct per ADR-014) while the production entrypoint had it in
 * the routing-controllers `middlewares` array, so every integration suite
 * passed while the booted backend returned a body-undefined 400 on
 * `POST /api/auth/sign-in/email`.
 *
 * ADR-014 mandates: `app.use(bodyParserMiddleware)` BEFORE `useExpressServer(...)`.
 *
 * Assertion strategy: a valid JSON sign-in body for a user that does not exist
 * must reach BetterAuth parsed, so BetterAuth evaluates credentials and answers
 * 401 (invalid credentials). With the pre-fix wiring the body never arrives and
 * BetterAuth rejects the request with 400 before credential evaluation.
 *
 * @see .docs/adr/ADR-014-middleware-registration-exception.md
 * @see https://github.com/csim-sg/yacc/issues/408
 */

import 'reflect-metadata';

import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/index';

describe('RC-1: production entrypoint parses JSON bodies for BetterAuth (ADR-014)', () => {
  it('POST /api/auth/sign-in/email receives a parsed body via the real src/index wiring', async () => {
    const response = await request(app)
      .post('/api/auth/sign-in/email')
      .set('Content-Type', 'application/json')
      .send({ email: 'prereq-408-nonexistent@example.com', password: 'WrongPassword123!' });

    // Body parsed => BetterAuth evaluates credentials => 401 invalid credentials.
    // Body undefined (pre-fix wiring) => BetterAuth rejects with 400 before credential evaluation.
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('INVALID_EMAIL_OR_PASSWORD');
  });
});
