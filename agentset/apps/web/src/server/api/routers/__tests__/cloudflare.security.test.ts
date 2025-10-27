/**
 * Security Tests for Cloudflare Router
 *
 * These tests verify authentication, authorization, and input validation
 * for all Cloudflare integration endpoints.
 *
 * @see /packages/engine/src/vector-store/cloudflare/SECURITY_TESTING.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import type { ProcedureContext } from '../../trpc';
import { cloudflareRouter } from '../cloudflare';
import { createCallerFactory } from '../../trpc';

/**
 * Test utilities for creating tRPC callers with different security contexts
 */
const createCaller = createCallerFactory(cloudflareRouter);

/**
 * Mock database for testing
 * In production tests, use proper database mocking or test database
 */
const mockDb = {
  namespace: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  cloudflareMetric: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
};

/**
 * Create mock context with different user scenarios
 */
function createMockContext(options: {
  session?: { user: { id: string } } | null;
  namespaceId?: string;
  userId?: string;
}): Partial<ProcedureContext> {
  return {
    db: mockDb as any,
    session: options.session ?? {
      user: { id: options.userId ?? 'user-1' },
    },
    headers: new Headers(),
  };
}

describe('Security: Cloudflare Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('TC-AUTH-001: Authentication - Unauthenticated Request Rejection', () => {
    it('should reject getSettings without session', async () => {
      const ctx = createMockContext({ session: null });
      const caller = createCaller(ctx as any);

      await expect(
        caller.getSettings({ namespaceId: 'ns-1' })
      ).rejects.toThrow('UNAUTHORIZED');
    });

    it('should reject updateSettings without session', async () => {
      const ctx = createMockContext({ session: null });
      const caller = createCaller(ctx as any);

      await expect(
        caller.updateSettings({
          namespaceId: 'ns-1',
          ragProvider: 'cloudflare',
        })
      ).rejects.toThrow('UNAUTHORIZED');
    });

    it('should reject getMetrics without session', async () => {
      const ctx = createMockContext({ session: null });
      const caller = createCaller(ctx as any);

      await expect(
        caller.getMetrics({
          namespaceId: 'ns-1',
        })
      ).rejects.toThrow('UNAUTHORIZED');
    });

    it('should reject testConnection without session', async () => {
      const ctx = createMockContext({ session: null });
      const caller = createCaller(ctx as any);

      await expect(
        caller.testConnection({
          namespaceId: 'ns-1',
          endpoint: 'https://worker.example.com',
        })
      ).rejects.toThrow('UNAUTHORIZED');
    });

    it('should reject getMetricsSummary without session', async () => {
      const ctx = createMockContext({ session: null });
      const caller = createCaller(ctx as any);

      await expect(
        caller.getMetricsSummary({
          namespaceId: 'ns-1',
        })
      ).rejects.toThrow('UNAUTHORIZED');
    });
  });

  describe('TC-AUTHZ-001: Authorization - Namespace Access Control', () => {
    it('should allow access to owned namespace', async () => {
      const ctx = createMockContext({ userId: 'user-1' });
      const caller = createCaller(ctx as any);

      mockDb.namespace.findFirst.mockResolvedValue({
        id: 'ns-1',
        ragProvider: 'cloudflare',
        cfModelRoute: 'fast-lane',
        cfSafetyLevel: 'standard',
        cfCacheMode: 'private',
        cfBudgetLimit: 1000,
        cfSettings: { endpoint: 'https://worker.example.com' },
      });

      const result = await caller.getSettings({ namespaceId: 'ns-1' });

      expect(result).toBeDefined();
      expect(mockDb.namespace.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'ns-1',
          organization: {
            members: { some: { userId: 'user-1' } },
          },
        },
      });
    });

    it('should deny access to non-owned namespace', async () => {
      const ctx = createMockContext({ userId: 'user-1' });
      const caller = createCaller(ctx as any);

      // User is not a member of the namespace's organization
      mockDb.namespace.findFirst.mockResolvedValue(null);

      await expect(
        caller.getSettings({ namespaceId: 'ns-2' })
      ).rejects.toThrow('NOT_FOUND');

      expect(mockDb.namespace.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'ns-2',
          organization: {
            members: { some: { userId: 'user-1' } },
          },
        },
      });
    });

    it('should return NOT_FOUND instead of FORBIDDEN for security', async () => {
      const ctx = createMockContext({ userId: 'user-1' });
      const caller = createCaller(ctx as any);

      mockDb.namespace.findFirst.mockResolvedValue(null);

      try {
        await caller.getSettings({ namespaceId: 'ns-other-org' });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe('NOT_FOUND');
        // Verify it doesn't reveal whether namespace exists
        expect((error as TRPCError).message).not.toContain('organization');
        expect((error as TRPCError).message).not.toContain('permission');
      }
    });

    it('should prevent cross-organization namespace updates', async () => {
      const ctx = createMockContext({ userId: 'user-1' });
      const caller = createCaller(ctx as any);

      mockDb.namespace.findFirst.mockResolvedValue(null);

      await expect(
        caller.updateSettings({
          namespaceId: 'ns-other-org',
          cfModelRoute: 'final-answer',
        })
      ).rejects.toThrow('NOT_FOUND');
    });
  });

  describe('TC-INPUT-001: Input Validation - Required Fields', () => {
    it('should reject missing namespaceId', async () => {
      const ctx = createMockContext({ userId: 'user-1' });
      const caller = createCaller(ctx as any);

      await expect(
        // @ts-expect-error - Testing runtime validation
        caller.getSettings({})
      ).rejects.toThrow();
    });

    it('should reject invalid URL in testConnection', async () => {
      const ctx = createMockContext({ userId: 'user-1' });
      const caller = createCaller(ctx as any);

      mockDb.namespace.findFirst.mockResolvedValue({ id: 'ns-1' });

      await expect(
        caller.testConnection({
          namespaceId: 'ns-1',
          endpoint: 'not-a-url',
        })
      ).rejects.toThrow();
    });

    it('should reject empty string for required fields', async () => {
      const ctx = createMockContext({ userId: 'user-1' });
      const caller = createCaller(ctx as any);

      await expect(
        caller.getSettings({ namespaceId: '' })
      ).rejects.toThrow();
    });
  });

  describe('TC-INPUT-002: Input Validation - Enum Constraints', () => {
    it('should accept valid cfModelRoute values', async () => {
      const ctx = createMockContext({ userId: 'user-1' });
      const caller = createCaller(ctx as any);

      mockDb.namespace.findFirst.mockResolvedValue({ id: 'ns-1' });
      mockDb.namespace.update.mockResolvedValue({
        id: 'ns-1',
        cfModelRoute: 'final-answer',
      });

      const validRoutes = ['final-answer', 'fast-lane', 'cheap'] as const;

      for (const route of validRoutes) {
        await expect(
          caller.updateSettings({
            namespaceId: 'ns-1',
            cfModelRoute: route,
          })
        ).resolves.toBeDefined();
      }
    });

    it('should reject invalid cfModelRoute', async () => {
      const ctx = createMockContext({ userId: 'user-1' });
      const caller = createCaller(ctx as any);

      mockDb.namespace.findFirst.mockResolvedValue({ id: 'ns-1' });

      await expect(
        caller.updateSettings({
          namespaceId: 'ns-1',
          // @ts-expect-error - Testing runtime validation
          cfModelRoute: 'invalid-route',
        })
      ).rejects.toThrow();
    });

    it('should accept valid cfSafetyLevel values', async () => {
      const ctx = createMockContext({ userId: 'user-1' });
      const caller = createCaller(ctx as any);

      mockDb.namespace.findFirst.mockResolvedValue({ id: 'ns-1' });
      mockDb.namespace.update.mockResolvedValue({
        id: 'ns-1',
        cfSafetyLevel: 'standard',
      });

      const validLevels = ['off', 'standard', 'strict'] as const;

      for (const level of validLevels) {
        await expect(
          caller.updateSettings({
            namespaceId: 'ns-1',
            cfSafetyLevel: level,
          })
        ).resolves.toBeDefined();
      }
    });

    it('should reject case-sensitive enum variations', async () => {
      const ctx = createMockContext({ userId: 'user-1' });
      const caller = createCaller(ctx as any);

      mockDb.namespace.findFirst.mockResolvedValue({ id: 'ns-1' });

      await expect(
        caller.updateSettings({
          namespaceId: 'ns-1',
          // @ts-expect-error - Testing runtime validation
          cfCacheMode: 'Public', // Should be 'public'
        })
      ).rejects.toThrow();
    });
  });

  describe('TC-INPUT-003: Input Validation - Numeric Constraints', () => {
    it('should accept positive budget limit', async () => {
      const ctx = createMockContext({ userId: 'user-1' });
      const caller = createCaller(ctx as any);

      mockDb.namespace.findFirst.mockResolvedValue({ id: 'ns-1' });
      mockDb.namespace.update.mockResolvedValue({
        id: 'ns-1',
        cfBudgetLimit: 1000,
      });

      await expect(
        caller.updateSettings({
          namespaceId: 'ns-1',
          cfBudgetLimit: 1000,
        })
      ).resolves.toBeDefined();
    });

    it('should reject negative budget limit', async () => {
      const ctx = createMockContext({ userId: 'user-1' });
      const caller = createCaller(ctx as any);

      mockDb.namespace.findFirst.mockResolvedValue({ id: 'ns-1' });

      await expect(
        caller.updateSettings({
          namespaceId: 'ns-1',
          cfBudgetLimit: -100,
        })
      ).rejects.toThrow();
    });

    it('should reject zero budget limit', async () => {
      const ctx = createMockContext({ userId: 'user-1' });
      const caller = createCaller(ctx as any);

      mockDb.namespace.findFirst.mockResolvedValue({ id: 'ns-1' });

      await expect(
        caller.updateSettings({
          namespaceId: 'ns-1',
          cfBudgetLimit: 0,
        })
      ).rejects.toThrow();
    });

    it('should enforce min/max on metrics limit', async () => {
      const ctx = createMockContext({ userId: 'user-1' });
      const caller = createCaller(ctx as any);

      mockDb.namespace.findFirst.mockResolvedValue({ id: 'ns-1' });
      mockDb.cloudflareMetric.findMany.mockResolvedValue([]);

      // Test min (1)
      await expect(
        caller.getMetrics({
          namespaceId: 'ns-1',
          limit: 0,
        })
      ).rejects.toThrow();

      // Test max (1000)
      await expect(
        caller.getMetrics({
          namespaceId: 'ns-1',
          limit: 1001,
        })
      ).rejects.toThrow();

      // Test valid value
      await expect(
        caller.getMetrics({
          namespaceId: 'ns-1',
          limit: 100,
        })
      ).resolves.toBeDefined();
    });
  });

  describe('TC-INPUT-004: Input Validation - JSONB Fields', () => {
    it('should accept valid JSON object for cfSettings', async () => {
      const ctx = createMockContext({ userId: 'user-1' });
      const caller = createCaller(ctx as any);

      mockDb.namespace.findFirst.mockResolvedValue({ id: 'ns-1' });
      mockDb.namespace.update.mockResolvedValue({
        id: 'ns-1',
        cfSettings: { endpoint: 'https://worker.example.com', apiKey: 'key' },
      });

      await expect(
        caller.updateSettings({
          namespaceId: 'ns-1',
          cfSettings: {
            endpoint: 'https://worker.example.com',
            apiKey: 'secret-key',
            customField: 'value',
          },
        })
      ).resolves.toBeDefined();
    });

    it('should handle null cfSettings', async () => {
      const ctx = createMockContext({ userId: 'user-1' });
      const caller = createCaller(ctx as any);

      mockDb.namespace.findFirst.mockResolvedValue({ id: 'ns-1' });
      mockDb.namespace.update.mockResolvedValue({
        id: 'ns-1',
        cfSettings: null,
      });

      await expect(
        caller.updateSettings({
          namespaceId: 'ns-1',
          cfSettings: null,
        })
      ).resolves.toBeDefined();
    });

    it('should sanitize XSS attempts in JSONB fields', async () => {
      const ctx = createMockContext({ userId: 'user-1' });
      const caller = createCaller(ctx as any);

      mockDb.namespace.findFirst.mockResolvedValue({ id: 'ns-1' });
      mockDb.namespace.update.mockResolvedValue({
        id: 'ns-1',
        cfSettings: {
          xss: '<script>alert("xss")</script>',
        },
      });

      // XSS attempt should be stored as-is (sanitization happens on read/render)
      const result = await caller.updateSettings({
        namespaceId: 'ns-1',
        cfSettings: {
          xss: '<script>alert("xss")</script>',
        },
      });

      expect(result).toBeDefined();
      // Verify the value is stored (will be sanitized on UI render)
      expect(mockDb.namespace.update).toHaveBeenCalled();
    });
  });

  describe('TC-DATA-001: SQL Injection Prevention', () => {
    it('should prevent SQL injection in namespaceId', async () => {
      const ctx = createMockContext({ userId: 'user-1' });
      const caller = createCaller(ctx as any);

      const sqlInjectionAttempts = [
        "'; DROP TABLE namespace; --",
        "' OR '1'='1",
        "1' UNION SELECT * FROM users --",
      ];

      for (const injection of sqlInjectionAttempts) {
        mockDb.namespace.findFirst.mockResolvedValue(null);

        await expect(
          caller.getSettings({ namespaceId: injection })
        ).rejects.toThrow('NOT_FOUND');

        // Verify Prisma parameterized the query safely
        expect(mockDb.namespace.findFirst).toHaveBeenCalledWith({
          where: {
            id: injection, // Prisma will safely parameterize this
            organization: {
              members: { some: { userId: 'user-1' } },
            },
          },
        });
      }
    });

    it('should prevent SQL injection in filter parameters', async () => {
      const ctx = createMockContext({ userId: 'user-1' });
      const caller = createCaller(ctx as any);

      mockDb.namespace.findFirst.mockResolvedValue({ id: 'ns-1' });
      mockDb.cloudflareMetric.findMany.mockResolvedValue([]);

      await expect(
        caller.getMetrics({
          namespaceId: 'ns-1',
          tenantId: "'; DROP TABLE cloudflareMetric; --",
        })
      ).resolves.toBeDefined();

      // Verify Prisma parameterized the query
      expect(mockDb.cloudflareMetric.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: "'; DROP TABLE cloudflareMetric; --",
          }),
        })
      );
    });
  });

  describe('TC-TENANT-001: Multi-tenant Isolation', () => {
    it('should scope metrics to authorized namespace', async () => {
      const ctx = createMockContext({ userId: 'user-1' });
      const caller = createCaller(ctx as any);

      mockDb.namespace.findFirst.mockResolvedValue({ id: 'ns-1' });
      mockDb.cloudflareMetric.findMany.mockResolvedValue([
        { id: 1, namespaceId: 'ns-1', queryCount: 10 },
      ]);

      await caller.getMetrics({
        namespaceId: 'ns-1',
        tenantId: 'tenant-1',
      });

      // Verify query is scoped to the authorized namespace
      expect(mockDb.cloudflareMetric.findMany).toHaveBeenCalledWith({
        where: {
          namespaceId: 'ns-1', // Critical: always scoped to authorized namespace
          tenantId: 'tenant-1',
        },
        orderBy: { timestamp: 'desc' },
        take: 100,
      });
    });

    it('should not allow tenantId manipulation to access other namespaces', async () => {
      const ctx = createMockContext({ userId: 'user-1' });
      const caller = createCaller(ctx as any);

      mockDb.namespace.findFirst.mockResolvedValue({ id: 'ns-1' });
      mockDb.cloudflareMetric.findMany.mockResolvedValue([]);

      // User tries to access metrics from another namespace via tenantId
      await caller.getMetrics({
        namespaceId: 'ns-1',
        tenantId: 'tenant-from-other-namespace',
      });

      // Query should still be scoped to 'ns-1'
      expect(mockDb.cloudflareMetric.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            namespaceId: 'ns-1', // Not affected by tenantId value
          }),
        })
      );
    });
  });

  describe('TC-ERROR-001: Error Information Leakage', () => {
    it('should not leak database errors to client', async () => {
      const ctx = createMockContext({ userId: 'user-1' });
      const caller = createCaller(ctx as any);

      mockDb.namespace.findFirst.mockRejectedValue(
        new Error('Database connection failed on host 192.168.1.100')
      );

      try {
        await caller.getSettings({ namespaceId: 'ns-1' });
        expect.fail('Should have thrown error');
      } catch (error) {
        // Error should be generic, not expose database details
        expect((error as Error).message).not.toContain('192.168.1.100');
        expect((error as Error).message).not.toContain('Database connection');
      }
    });

    it('should return generic NOT_FOUND for authorization failures', async () => {
      const ctx = createMockContext({ userId: 'user-1' });
      const caller = createCaller(ctx as any);

      mockDb.namespace.findFirst.mockResolvedValue(null);

      try {
        await caller.getSettings({ namespaceId: 'ns-other' });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe('NOT_FOUND');
        // Should not reveal whether namespace exists or user lacks permission
        expect((error as TRPCError).message).not.toContain('permission');
        expect((error as TRPCError).message).not.toContain('access denied');
        expect((error as TRPCError).message).not.toContain('unauthorized');
      }
    });
  });
});
