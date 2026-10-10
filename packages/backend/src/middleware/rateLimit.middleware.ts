/**
 * Rate Limiting Middleware
 *
 * Implements request rate limiting to prevent brute force attacks.
 * Uses in-memory store (suitable for single-instance deployment).
 * For multi-instance deployments, use Redis store.
 *
 * Limiter values come from `config/rateLimit.config.ts`: production keeps the
 * contractual values (login 5/15m, password reset 3/1h, API 100/15m per IP);
 * an explicit non-production (test) environment lifts the request ceilings so
 * full E2E runs from a shared IP are deterministic (PREREQ-ANG-003 / #408).
 */

import rateLimit from 'express-rate-limit';
import { rateLimitConfig } from '../config/rateLimit.config';

/**
 * Login rate limiter: 5 attempts per 15 minutes per IP in production
 *
 * Prevents brute force attacks on authentication endpoints.
 * After exceeding the limit, clients receive 429 Too Many Requests.
 */
export const loginRateLimiter = rateLimit({
  windowMs: rateLimitConfig.login.windowMs, // 15 minutes
  max: rateLimitConfig.login.max, // 5 requests per windowMs in production
  message: 'Too many login attempts, please try again later',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skip: (req) => {
    // Don't count OPTIONS requests
    return req.method === 'OPTIONS';
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many login attempts. Please try again in 15 minutes.',
    });
  },
});

/**
 * Password reset rate limiter: 3 attempts per hour per IP in production
 *
 * Prevents abuse of password reset functionality.
 */
export const passwordResetRateLimiter = rateLimit({
  windowMs: rateLimitConfig.passwordReset.windowMs, // 1 hour
  max: rateLimitConfig.passwordReset.max, // 3 requests per windowMs in production
  message: 'Too many password reset requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return req.method === 'OPTIONS';
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many password reset attempts. Please try again in 1 hour.',
    });
  },
});

/**
 * General API rate limiter: 100 requests per 15 minutes per IP in production
 *
 * Broad limit to prevent API abuse and DoS attacks.
 */
export const apiRateLimiter = rateLimit({
  windowMs: rateLimitConfig.api.windowMs, // 15 minutes
  max: rateLimitConfig.api.max, // 100 requests per windowMs in production
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return req.method === 'OPTIONS';
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Rate limit exceeded. Please try again later.',
    });
  },
});
