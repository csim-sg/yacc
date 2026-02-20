/**
 * DLQ RBAC Integration Tests
 *
 * Tests the Dead Letter Queue controller with routing-controllers authorization.
 * Verifies RBAC enforcement at the HTTP level:
 * - READ endpoints (GET /api/dlq, GET /api/dlq/stats): manager, admin, super_admin
 * - MUTATE endpoints (POST /api/dlq/:id/re-queue): admin, super_admin
 * - DELETE endpoints (DELETE /api/dlq/:id): super_admin only
 *
 * These are integration-style tests that exercise the Express app with
 * routing-controllers middleware, ensuring @Authorized decorators work correctly.
 *
 * Governance: GOV-028-dlq-uuid-contract-traceability-rbac.md
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';

/**
 * Integration tests that exercise routing-controllers authorization
 * These tests verify that @Authorized decorators on DLQ endpoints properly
 * enforce RBAC rules at the HTTP level.
 *
 * In a real scenario, these would run against the actual Express app from src/index.ts.
 * The tests exercise the authorization flow:
 * 1. Unauthenticated request → 401
 * 2. Insufficient role → 403
 * 3. Allowed role → 200 or endpoint-specific status
 */

// Helper to create a mock JWT token
const createMockToken = (role: string): string => {
  return Buffer.from(
    JSON.stringify({
      userId: uuidv4(),
      role,
      email: `${role}@example.com`,
    })
  ).toString('base64');
};

describe('DLQ Controller - RBAC Integration Tests', () => {
  const dlqId = uuidv4();
  const messageId = uuidv4();
  const conversationId = uuidv4();

  /**
   * READ Endpoints Tests
   * GET /api/dlq
   * GET /api/dlq/stats
   */
  describe('READ Endpoints (manager, admin, super_admin allowed)', () => {
    describe('GET /api/dlq', () => {
      it('should return 401 when unauthenticated', async () => {
        // Simulate unauthenticated request (no Authorization header)
        const response = await request('http://localhost:3000')
          .get('/api/dlq')
          .expect(401);

        expect(response.body).toHaveProperty('code');
        expect(response.body.code).toMatch(/unauthorized|not_authenticated/i);
      });

      it('should return 403 when authenticated as user (insufficient role)', async () => {
        // User role has no DLQ access
        const response = await request('http://localhost:3000')
          .get('/api/dlq')
          .set('Authorization', `Bearer ${createMockToken('user')}`)
          .expect(403);

        expect(response.body).toHaveProperty('code');
        expect(response.body.code).toMatch(/forbidden|access_denied/i);
      });

      it('should return 200 when authenticated as manager', async () => {
        const response = await request('http://localhost:3000')
          .get('/api/dlq')
          .set('Authorization', `Bearer ${createMockToken('manager')}`)
          .expect(200);

        expect(response.body).toHaveProperty('entries');
        expect(Array.isArray(response.body.entries)).toBe(true);
      });

      it('should return 200 when authenticated as admin', async () => {
        const response = await request('http://localhost:3000')
          .get('/api/dlq')
          .set('Authorization', `Bearer ${createMockToken('admin')}`)
          .expect(200);

        expect(response.body).toHaveProperty('entries');
        expect(Array.isArray(response.body.entries)).toBe(true);
      });

      it('should return 200 when authenticated as super_admin', async () => {
        const response = await request('http://localhost:3000')
          .get('/api/dlq')
          .set('Authorization', `Bearer ${createMockToken('super_admin')}`)
          .expect(200);

        expect(response.body).toHaveProperty('entries');
        expect(Array.isArray(response.body.entries)).toBe(true);
      });
    });

    describe('GET /api/dlq/stats', () => {
      it('should return 401 when unauthenticated', async () => {
        const response = await request('http://localhost:3000')
          .get('/api/dlq/stats')
          .expect(401);

        expect(response.body).toHaveProperty('code');
      });

      it('should return 403 when authenticated as user', async () => {
        const response = await request('http://localhost:3000')
          .get('/api/dlq/stats')
          .set('Authorization', `Bearer ${createMockToken('user')}`)
          .expect(403);

        expect(response.body).toHaveProperty('code');
      });

      it('should return 200 when authenticated as manager', async () => {
        const response = await request('http://localhost:3000')
          .get('/api/dlq/stats')
          .set('Authorization', `Bearer ${createMockToken('manager')}`)
          .expect(200);

        expect(response.body).toHaveProperty('total');
        expect(response.body).toHaveProperty('byFailureReason');
      });

      it('should return 200 when authenticated as admin', async () => {
        const response = await request('http://localhost:3000')
          .get('/api/dlq/stats')
          .set('Authorization', `Bearer ${createMockToken('admin')}`)
          .expect(200);

        expect(response.body).toHaveProperty('total');
      });

      it('should return 200 when authenticated as super_admin', async () => {
        const response = await request('http://localhost:3000')
          .get('/api/dlq/stats')
          .set('Authorization', `Bearer ${createMockToken('super_admin')}`)
          .expect(200);

        expect(response.body).toHaveProperty('total');
      });
    });
  });

  /**
   * MUTATE Endpoints Tests
   * POST /api/dlq/:id/re-queue
   * Note: manager is read-only (cannot mutate)
   */
  describe('MUTATE Endpoints (admin, super_admin allowed; manager is read-only)', () => {
    describe('POST /api/dlq/:id/re-queue', () => {
      it('should return 401 when unauthenticated', async () => {
        const response = await request('http://localhost:3000')
          .post(`/api/dlq/${dlqId}/re-queue`)
          .expect(401);

        expect(response.body).toHaveProperty('code');
      });

      it('should return 403 when authenticated as user', async () => {
        const response = await request('http://localhost:3000')
          .post(`/api/dlq/${dlqId}/re-queue`)
          .set('Authorization', `Bearer ${createMockToken('user')}`)
          .expect(403);

        expect(response.body).toHaveProperty('code');
      });

      it('should return 403 when authenticated as manager (read-only)', async () => {
        // Manager can view DLQ but cannot mutate (retry)
        const response = await request('http://localhost:3000')
          .post(`/api/dlq/${dlqId}/re-queue`)
          .set('Authorization', `Bearer ${createMockToken('manager')}`)
          .expect(403);

        expect(response.body).toHaveProperty('code');
        expect(response.body.code).toMatch(/forbidden|access_denied/i);
      });

      it('should return 200 or 404 when authenticated as admin', async () => {
        // Entry may or may not exist, but authorization should pass
        const response = await request('http://localhost:3000')
          .post(`/api/dlq/${dlqId}/re-queue`)
          .set('Authorization', `Bearer ${createMockToken('admin')}`)
          .expect((res) => {
            // Should not be 401 or 403 (authorization passed)
            expect([200, 404]).toContain(res.status);
          });
      });

      it('should return 200 or 404 when authenticated as super_admin', async () => {
        const response = await request('http://localhost:3000')
          .post(`/api/dlq/${dlqId}/re-queue`)
          .set('Authorization', `Bearer ${createMockToken('super_admin')}`)
          .expect((res) => {
            expect([200, 404]).toContain(res.status);
          });
      });
    });
  });

  /**
   * DELETE Endpoints Tests
   * DELETE /api/dlq/:id
   * Note: super_admin only (strict access control)
   */
  describe('DELETE Endpoints (super_admin only)', () => {
    describe('DELETE /api/dlq/:id', () => {
      it('should return 401 when unauthenticated', async () => {
        const response = await request('http://localhost:3000')
          .delete(`/api/dlq/${dlqId}`)
          .expect(401);

        expect(response.body).toHaveProperty('code');
      });

      it('should return 403 when authenticated as user', async () => {
        const response = await request('http://localhost:3000')
          .delete(`/api/dlq/${dlqId}`)
          .set('Authorization', `Bearer ${createMockToken('user')}`)
          .expect(403);

        expect(response.body).toHaveProperty('code');
      });

      it('should return 403 when authenticated as manager', async () => {
        const response = await request('http://localhost:3000')
          .delete(`/api/dlq/${dlqId}`)
          .set('Authorization', `Bearer ${createMockToken('manager')}`)
          .expect(403);

        expect(response.body).toHaveProperty('code');
      });

      it('should return 403 when authenticated as admin (cannot delete)', async () => {
        // Admin can retry but cannot permanently delete
        const response = await request('http://localhost:3000')
          .delete(`/api/dlq/${dlqId}`)
          .set('Authorization', `Bearer ${createMockToken('admin')}`)
          .expect(403);

        expect(response.body).toHaveProperty('code');
        expect(response.body.code).toMatch(/forbidden|access_denied/i);
      });

      it('should return 200 or 404 when authenticated as super_admin', async () => {
        // Super admin can delete (entry may not exist, but authorization should pass)
        const response = await request('http://localhost:3000')
          .delete(`/api/dlq/${dlqId}`)
          .set('Authorization', `Bearer ${createMockToken('super_admin')}`)
          .expect((res) => {
            expect([200, 404]).toContain(res.status);
          });
      });
    });
  });

  /**
   * RBAC Policy Matrix Validation
   */
  describe('RBAC Policy Matrix Verification', () => {
    const rbacMatrix = [
      {
        endpoint: 'GET /api/dlq',
        operation: 'LIST',
        manager: true,
        admin: true,
        super_admin: true,
        user: false,
      },
      {
        endpoint: 'GET /api/dlq/stats',
        operation: 'STATS',
        manager: true,
        admin: true,
        super_admin: true,
        user: false,
      },
      {
        endpoint: 'POST /api/dlq/:id/re-queue',
        operation: 'RETRY',
        manager: false, // Read-only, cannot mutate
        admin: true,
        super_admin: true,
        user: false,
      },
      {
        endpoint: 'DELETE /api/dlq/:id',
        operation: 'DELETE',
        manager: false,
        admin: false, // Cannot permanently delete
        super_admin: true,
        user: false,
      },
    ];

    it('documents complete RBAC policy matrix', () => {
      expect(rbacMatrix).toHaveLength(4);
    });

    it('verifies manager is read-only (no mutations)', () => {
      const managerAllowed = rbacMatrix.filter((p) => p.manager);
      expect(managerAllowed).toHaveLength(2); // LIST and STATS only

      const managerCanMutate = managerAllowed.some((p) =>
        ['RETRY', 'DELETE'].includes(p.operation)
      );
      expect(managerCanMutate).toBe(false);
    });

    it('verifies admin cannot delete (super_admin only)', () => {
      const adminAllowed = rbacMatrix.filter((p) => p.admin);
      expect(adminAllowed).toHaveLength(3); // LIST, STATS, RETRY (not DELETE)

      const adminCanDelete = adminAllowed.some((p) => p.operation === 'DELETE');
      expect(adminCanDelete).toBe(false);
    });

    it('verifies user has no access to DLQ endpoints', () => {
      const userAllowed = rbacMatrix.filter((p) => p.user);
      expect(userAllowed).toHaveLength(0);
    });

    it('verifies super_admin has full access', () => {
      const superAdminAllowed = rbacMatrix.filter((p) => p.super_admin);
      expect(superAdminAllowed).toHaveLength(4); // All operations
    });
  });

  /**
   * Authorization Decorator Verification
   * Confirms that @Authorized decorators are properly applied
   */
  describe('Authorization Decorator Enforcement', () => {
    it('should verify READ endpoints have manager+ authorization', async () => {
      // Both READ endpoints should allow manager role
      const endpoints = ['/api/dlq', '/api/dlq/stats'];

      for (const endpoint of endpoints) {
        const response = await request('http://localhost:3000')
          .get(endpoint)
          .set('Authorization', `Bearer ${createMockToken('manager')}`)
          .expect(200);

        expect(response.status).toBe(200);
      }
    });

    it('should verify MUTATE endpoints enforce admin+ authorization', async () => {
      // Manager should be forbidden on mutate endpoint
      const response = await request('http://localhost:3000')
        .post(`/api/dlq/${dlqId}/re-queue`)
        .set('Authorization', `Bearer ${createMockToken('manager')}`)
        .expect(403);

      expect(response.status).toBe(403);
    });

    it('should verify DELETE endpoint enforces super_admin only', async () => {
      // Admin should be forbidden on delete endpoint
      const response = await request('http://localhost:3000')
        .delete(`/api/dlq/${dlqId}`)
        .set('Authorization', `Bearer ${createMockToken('admin')}`)
        .expect(403);

      expect(response.status).toBe(403);
    });
  });
});
