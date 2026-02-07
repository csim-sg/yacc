/**
 * Rate Limiting Middleware
 *
 * Implements request rate limiting to prevent brute force attacks.
 * Uses in-memory store (suitable for single-instance deployment).
 * For multi-instance deployments, use Redis store.
 */

import rateLimit from 'express-rate-limit';

/**
 * Login rate limiter: 5 attempts per 15 minutes per IP
 *
 * Prevents brute force attacks on authentication endpoints.
 * After exceeding the limit, clients receive 429 Too Many Requests.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per windowMs
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
 * Password reset rate limiter: 3 attempts per hour per IP
 *
 * Prevents abuse of password reset functionality.
 */
export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per windowMs
  message: 'Too many password reset requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return req.method === 'OPTIONS';
  },
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many password reset attempts. Please try again in 1 hour.',
    });
  },
});

/**
 * General API rate limiter: 100 requests per 15 minutes per IP
 *
 * Broad limit to prevent API abuse and DoS attacks.
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windowMs
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
