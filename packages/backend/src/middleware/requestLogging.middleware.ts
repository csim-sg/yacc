import pinoHttp from 'pino-http';
import { logger } from '../infrastructure/logger';

/**
 * HTTP request/response logging middleware
 * 
 * Logs all HTTP requests with timing, status codes, and errors.
 * 
 * @order MUST be second middleware (after correlationIdMiddleware)
 * 
 * @example
 * // In index.ts:
 * app.use(correlationIdMiddleware);   // 1. FIRST - inject correlation ID
 * app.use(requestLoggingMiddleware);  // 2. SECOND - log HTTP requests
 * app.use(bodyParserMiddleware);       // 3. THIRD - body parsing (JSON-only; ADR-014 exception)
 * // app.use(routes);                  // LAST - route to controllers
 * 
 * @returns Express middleware function
 */
export const requestLoggingMiddleware = pinoHttp({
  logger,
  
  // Use existing correlation ID from request
  genReqId: (req) => (req as any).correlationId,
  
  // Custom log levels based on status code
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    if (res.statusCode >= 300) return 'info';
    return 'debug';
  },
  
  // Custom success message
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} completed`;
  },
  
  // Custom error message
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} failed: ${err.message}`;
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
