/**
 * Validation Middleware Tests
 *
 * Tests for Zod validation middleware used with routing-controllers.
 *
 * @see validation.middleware.ts
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createValidationMiddleware, ValidationType } from '../../../src/middleware/validation.middleware';

// Mock the logger
vi.mock('../../../src/infrastructure/logger', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Validation Middleware', () => {
  let mockReq: Partial<Request> & { correlationId?: string; validated?: { body?: unknown; query?: unknown; params?: unknown } };
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();

    mockReq = {
      correlationId: 'test-correlation-id',
      body: {},
      query: {},
      params: {},
    };

    mockRes = {};

    mockNext = vi.fn();
  });

  describe('createValidationMiddleware', () => {
    describe('BODY validation', () => {
      it('should pass validation with valid body', async () => {
        const schema = z.object({
          email: z.string().email(),
          password: z.string().min(8),
        });

        mockReq.body = {
          email: 'test@example.com',
          password: 'password123',
        };

        const middleware = createValidationMiddleware(ValidationType.BODY, schema);
        await middleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(mockNext).toHaveBeenCalledWith();

        // Check validated data is attached
        const validatedReq = mockReq as Request & { validated: { body: unknown } };
        expect(validatedReq.validated).toBeDefined();
        expect(validatedReq.validated.body).toEqual({
          email: 'test@example.com',
          password: 'password123',
        });
      });

      it('should return 400 for invalid body', async () => {
        const schema = z.object({
          email: z.string().email(),
          password: z.string().min(8),
        });

        mockReq.body = {
          email: 'invalid-email',
          password: 'short',
        };

        const middleware = createValidationMiddleware(ValidationType.BODY, schema);
        await middleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalledTimes(1);
        const calledArg = (mockNext as Mock).mock.calls[0][0];

        expect(calledArg).toBeDefined();
        expect(calledArg.httpCode).toBe(400);

        // Check error response format
        const errorResponse = JSON.parse(calledArg.message);
        expect(errorResponse.error).toBe('Validation failed');
        expect(errorResponse.details).toBeInstanceOf(Array);
        expect(errorResponse.details.length).toBeGreaterThan(0);
      });

      it('should include field-level error details', async () => {
        const schema = z.object({
          email: z.string().email(),
          password: z.string().min(8),
        });

        mockReq.body = {
          email: 'invalid-email',
          password: 'short',
        };

        const middleware = createValidationMiddleware(ValidationType.BODY, schema);
        await middleware(mockReq as Request, mockRes as Response, mockNext);

        const calledArg = (mockNext as Mock).mock.calls[0][0];
        const errorResponse = JSON.parse(calledArg.message);

        // Check that errors include field, message, and code
        errorResponse.details.forEach((detail: { field: string; message: string; code: string }) => {
          expect(detail).toHaveProperty('field');
          expect(detail).toHaveProperty('message');
          expect(detail).toHaveProperty('code');
        });
      });

      it('should report multiple validation errors', async () => {
        const schema = z.object({
          name: z.string().min(1),
          email: z.string().email(),
          age: z.number().min(0).max(150),
        });

        mockReq.body = {
          name: '',
          email: 'invalid',
          age: -5,
        };

        const middleware = createValidationMiddleware(ValidationType.BODY, schema);
        await middleware(mockReq as Request, mockRes as Response, mockNext);

        const calledArg = (mockNext as Mock).mock.calls[0][0];
        const errorResponse = JSON.parse(calledArg.message);

        // Should have multiple errors
        expect(errorResponse.details.length).toBeGreaterThanOrEqual(2);
      });
    });

    describe('QUERY validation', () => {
      it('should pass validation with valid query params', async () => {
        const schema = z.object({
          page: z.coerce.number().int().positive().optional(),
          limit: z.coerce.number().int().min(1).max(100).optional(),
        });

        mockReq.query = {
          page: '1',
          limit: '20',
        };

        const middleware = createValidationMiddleware(ValidationType.QUERY, schema);
        await middleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(mockNext).toHaveBeenCalledWith();

        const validatedReq = mockReq as Request & { validated: { query: unknown } };
        expect(validatedReq.validated.query).toEqual({
          page: 1,
          limit: 20,
        });
      });

      it('should return 400 for invalid query params', async () => {
        const schema = z.object({
          page: z.coerce.number().int().positive(),
        });

        mockReq.query = {
          page: '-1',
        };

        const middleware = createValidationMiddleware(ValidationType.QUERY, schema);
        await middleware(mockReq as Request, mockRes as Response, mockNext);

        const calledArg = (mockNext as Mock).mock.calls[0][0];
        expect(calledArg.httpCode).toBe(400);
      });
    });

    describe('PARAMS validation', () => {
      it('should pass validation with valid path params', async () => {
        const schema = z.object({
          id: z.string().uuid(),
        });

        mockReq.params = {
          id: '550e8400-e29b-41d4-a716-446655440000',
        };

        const middleware = createValidationMiddleware(ValidationType.PARAMS, schema);
        await middleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(mockNext).toHaveBeenCalledWith();

        const validatedReq = mockReq as Request & { validated: { params: unknown } };
        expect(validatedReq.validated.params).toEqual({
          id: '550e8400-e29b-41d4-a716-446655440000',
        });
      });

      it('should return 400 for invalid path params', async () => {
        const schema = z.object({
          id: z.string().uuid(),
        });

        mockReq.params = {
          id: 'invalid-uuid',
        };

        const middleware = createValidationMiddleware(ValidationType.PARAMS, schema);
        await middleware(mockReq as Request, mockRes as Response, mockNext);

        const calledArg = (mockNext as Mock).mock.calls[0][0];
        expect(calledArg.httpCode).toBe(400);
      });
    });

    describe('Non-Zod errors', () => {
      it('should pass non-Zod errors to global error handler', async () => {
        // Schema that throws a non-Zod error
        const schema = z.object({
          value: z.string().refine(() => {
            throw new Error('Unexpected error');
          }),
        });

        mockReq.body = {
          value: 'test',
        };

        const middleware = createValidationMiddleware(ValidationType.BODY, schema);
        await middleware(mockReq as Request, mockRes as Response, mockNext);

        const calledArg = (mockNext as Mock).mock.calls[0][0];
        expect(calledArg).toBeInstanceOf(Error);
        expect(calledArg.message).toBe('Unexpected error');
        // Should not be an HttpError
        expect(calledArg.httpCode).toBeUndefined();
      });
    });

    describe('Multiple validation types', () => {
      it('should support multiple validation decorators on same endpoint', async () => {
        const bodySchema = z.object({
          status: z.enum(['open', 'pending', 'resolved']),
        });

        const paramsSchema = z.object({
          id: z.string().uuid(),
        });

        // First middleware validates body
        mockReq.body = { status: 'open' };
        const bodyMiddleware = createValidationMiddleware(ValidationType.BODY, bodySchema);
        await bodyMiddleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalledTimes(1);

        // Second middleware validates params
        mockReq.params = { id: '550e8400-e29b-41d4-a716-446655440000' };
        mockNext = vi.fn(); // Reset for second middleware
        const paramsMiddleware = createValidationMiddleware(ValidationType.PARAMS, paramsSchema);
        await paramsMiddleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(mockNext).toHaveBeenCalledWith();

        // Both validated data should be present
        const validatedReq = mockReq as Request & {
          validated: { body: unknown; params: unknown };
        };
        expect(validatedReq.validated.body).toEqual({ status: 'open' });
        expect(validatedReq.validated.params).toEqual({
          id: '550e8400-e29b-41d4-a716-446655440000',
        });
      });
    });
  });
});
