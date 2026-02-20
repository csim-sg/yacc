import pinoHttp from 'pino-http';
import type { Request, Response } from 'express';
import { logger } from '../infrastructure/logger';

/**
 * Request Logging Middleware
 *
 * Logs incoming HTTP requests with correlation ID, method, path, and status.
 *
 * Registration: This middleware is registered via the routing-controllers
 * `middlewares` array in `useExpressServer()` configuration (normal pattern).
 *
 * Note: Body parser middleware (`bodyParserMiddleware`) runs BEFORE this middleware.
 * See ADR-014 for the rationale of the body parser exception.
 *
 * Execution Order (at entrypoint):
 * 1. `app.use(bodyParserMiddleware)` - exception to routing-controllers pattern
 * 2. `useExpressServer(...middlewares: [correlationIdMiddleware, requestLoggingMiddleware])`
 *
 * See ADR-004 for logging strategy and ADR-014 for middleware exceptions.
 *
 * @see .docs/adr/ADR-004-logging-strategy.md
 * @see .docs/adr/ADR-014-middleware-registration-exception.md
 */
export const requestLoggingMiddleware = pinoHttp({
  logger,
  
  // Use existing correlation ID from request
  genReqId: (req: Request) => (req.correlationId || 'unknown'),
  
  // Custom log levels based on status code
  customLogLevel: (req: Request, res: Response, err: unknown) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    if (res.statusCode >= 300) return 'info';
    return 'debug';
  },
  
  // Custom success message
  customSuccessMessage: (req: Request, _res: Response) => {
    return `${req.method} ${req.url} completed`;
  },
  
  // Custom error message
  customErrorMessage: (req: Request, _res: Response, err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    return `${req.method} ${req.url} failed: ${message}`;
  },
  
  // Serialize request (exclude sensitive headers and body)
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      query: req.query,
      params: req.params,
      headers: {
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
        'content-length': req.headers['content-length'],
      },
      remoteAddress: req.remoteAddress,
      remotePort: req.remotePort,
    }),
    
    // Serialize response (exclude sensitive body)
    res: (res) => ({
      statusCode: res.statusCode,
      headers: {
        'content-type': res.getHeader('content-type'),
        'content-length': res.getHeader('content-length'),
      },
    }),
  },
});
