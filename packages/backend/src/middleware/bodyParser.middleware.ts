import express from 'express';

/**
 * Body Parser Middleware
 *
 * Parses incoming request bodies in JSON format.
 *
 * NOTE: This middleware is an exception to the normal routing-controllers middleware pattern.
 * It is registered via app.use() at the entrypoint rather than in the routing-controllers
 * middlewares array. This is necessary because body parsing must occur before routing-controllers
 * processes the request (BetterAuth delegated handlers rely on req.body being available).
 *
 * See ADR-014 for the architectural rationale for this exception.
 *
 * @see .docs/adr/ADR-014-middleware-registration-exception.md
 */
export const bodyParserMiddleware = express.json();
