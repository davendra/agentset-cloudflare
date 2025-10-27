/**
 * Integration Tests for Search Router
 *
 * These tests validate the complete end-to-end search workflow from request to response,
 * including Cloudflare AI Search integration, local vector store fallback, metrics tracking,
 * and error handling.
 *
 * NOTE: These tests use mocks for CloudflareSearchTool and are ready for actual Worker deployment.
 * When Worker is deployed, these mocks can be replaced with real integration tests.
 *
 * @see Task 15.2: Integration tests for end-to-end search workflow
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import type { ProcedureContext } from '../../trpc';
import { searchRouter } from '../search';
import { createCallerFactory } from '../../trpc';

/**
 * Mock database for testing
 */
const mockDb = {
  namespace: {
    findFirst: vi.fn(),
  },
  cloudflareMetric: {
    create: vi.fn(),
  },
};

/**
 * Mock CloudflareSearchTool
 */
vi.mock('@agentset/cloudflare-tools', () => ({
  CloudflareSearchTool: vi.fn().mockImplementation(() => ({
    search: vi.fn(),
  })),
}));

/**
 * Mock engine functions
 */
vi.mock('@agentset/engine', () => ({
  getNamespaceEmbeddingModel: vi.fn(),
  getNamespaceVectorStore: vi.fn(),
  queryVectorStore: vi.fn(),
}));

/**
 * Mock usage tracking
 */
vi.mock('@/lib/api/usage', () => ({
  incrementSearchUsage: vi.fn(),
}));

/**
 * Create test context
 */
function createTestContext(options: {
  userId?: string;
  namespaceId?: string;
}): Partial<ProcedureContext> {
  return {
    db: mockDb as any,
    session: {
      user: { id: options.userId || 'test-user-1' },
    } as any,
    headers: new Headers(),
  };
}

/**
 * Create tRPC caller for testing
 */
const createCaller = createCallerFactory(searchRouter);

describe('Integration: Search Router - End-to-End Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Cloudflare Search Integration', () => {
    it('should complete full search workflow with Cloudflare', async () => {
      // Setup: Namespace configured for Cloudflare
      const namespace = {
        id: 'ns-cloudflare',
        name: 'Test Namespace',
        ragProvider: 'cloudflare',
        cfModelRoute: 'fast-lane',
        cfSafetyLevel: 'standard',
        cfCacheMode: 'private',
        cfSettings: {
          endpoint: 'https://test-worker.example.workers.dev',
          apiKey: 'test-api-key',
        },
      };

      mockDb.namespace.findFirst.mockResolvedValue(namespace);

      // Mock Cloudflare search response
      const mockSearchResponse = {
        answer: 'Test answer about user authentication',
        sources: [
          {
            metadata: { id: 'doc1', title: 'Auth Documentation' },
            score: 0.95,
            preview: 'User authentication is handled via JWT tokens...',
          },
          {
            metadata: { id: 'doc2', title: 'Security Guide' },
            score: 0.87,
            preview: 'Implement secure password hashing...',
          },
        ],
        metadata: { model: 'claude-3-5-sonnet', tokens: 250, cached: false, latency: 120 },
        cached: false,
        latency: 120,
      };

      const { CloudflareSearchTool } = await import('@agentset/cloudflare-tools');
      const mockSearch = vi.fn().mockResolvedValue(mockSearchResponse);
      (CloudflareSearchTool as any).mockImplementation(() => ({
        search: mockSearch,
      }));

      // Mock metrics creation
      mockDb.cloudflareMetric.create.mockResolvedValue({ id: 1 });

      // Execute search
      const ctx = createTestContext({ userId: 'user-1', namespaceId: 'ns-cloudflare' });
      const caller = createCaller(ctx as any);

      const result = await caller.search({
        namespaceId: 'ns-cloudflare',
        query: 'How does user authentication work?',
        topK: 10,
        rerank: false,
        rerankModel: 'cohere-rerank-english-v3.0',
        rerankLimit: 10,
      });

      // Verify Cloudflare API was called with correct parameters
      expect(mockSearch).toHaveBeenCalledWith({
        query: 'How does user authentication work?',
        filters: {
          namespaceId: 'ns-cloudflare',
        },
        workspaceId: undefined,
        mode: 'private',
        safety: 'standard',
        modelRoute: 'fast-lane',
        max_tokens: 500,
      });

      // Verify metrics were tracked
      expect(mockDb.cloudflareMetric.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          namespaceId: 'ns-cloudflare',
          queryCount: 1,
          cacheHits: 0,
          cacheMisses: 1,
        }),
      });

      // Verify response format
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'doc1',
        score: 0.95,
        text: 'User authentication is handled via JWT tokens...',
        metadata: { id: 'doc1', title: 'Auth Documentation' },
      });
      expect(result[1]).toEqual({
        id: 'doc2',
        score: 0.87,
        text: 'Implement secure password hashing...',
        metadata: { id: 'doc2', title: 'Security Guide' },
      });
    });

    it('should respect topK limit in Cloudflare search', async () => {
      const namespace = {
        id: 'ns-test',
        ragProvider: 'cloudflare',
        cfSettings: { endpoint: 'https://worker.example.com' },
      };

      mockDb.namespace.findFirst.mockResolvedValue(namespace);

      const mockSources = Array.from({ length: 20 }, (_, i) => ({
        metadata: { id: `doc${i}` },
        score: 1 - i * 0.01,
        preview: `Content ${i}`,
      }));

      const { CloudflareSearchTool } = await import('@agentset/cloudflare-tools');
      const mockSearch = vi.fn().mockResolvedValue({
        answer: '',
        sources: mockSources,
        metadata: { model: 'test', tokens: 0, cached: false, latency: 0 },
        cached: false,
        latency: 0,
      });
      (CloudflareSearchTool as any).mockImplementation(() => ({ search: mockSearch }));

      mockDb.cloudflareMetric.create.mockResolvedValue({ id: 1 });

      const ctx = createTestContext({});
      const caller = createCaller(ctx as any);

      const result = await caller.search({
        namespaceId: 'ns-test',
        query: 'test',
        topK: 5,
        rerank: false,
        rerankModel: 'cohere-rerank-english-v3.0',
        rerankLimit: 5,
      });

      // Should limit to topK
      expect(result).toHaveLength(5);
      expect(result[0]?.id).toBe('doc0');
      expect(result[4]?.id).toBe('doc4');
    });

    it('should track cache hits in metrics', async () => {
      const namespace = {
        id: 'ns-cached',
        ragProvider: 'cloudflare',
        cfCacheMode: 'public',
        cfSettings: { endpoint: 'https://worker.example.com' },
      };

      mockDb.namespace.findFirst.mockResolvedValue(namespace);

      const { CloudflareSearchTool } = await import('@agentset/cloudflare-tools');
      const mockSearch = vi.fn().mockResolvedValue({
        answer: 'Cached answer',
        sources: [],
        metadata: { model: 'test', tokens: 0, cached: true, latency: 15 },
        cached: true,
        latency: 15,
      });
      (CloudflareSearchTool as any).mockImplementation(() => ({ search: mockSearch }));

      mockDb.cloudflareMetric.create.mockResolvedValue({ id: 1 });

      const ctx = createTestContext({});
      const caller = createCaller(ctx as any);

      await caller.search({
        namespaceId: 'ns-cached',
        query: 'test',
        topK: 10,
        rerank: false,
        rerankModel: 'cohere-rerank-english-v3.0',
        rerankLimit: 10,
      });

      // Verify cache hit was tracked
      expect(mockDb.cloudflareMetric.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          namespaceId: 'ns-cached',
          cacheHits: 1,
          cacheMisses: 0,
        }),
      });
    });
  });

  describe('Local Vector Store Fallback', () => {
    it('should fall back to local RAG when Cloudflare fails', async () => {
      const namespace = {
        id: 'ns-fallback',
        ragProvider: 'cloudflare',
        cfSettings: { endpoint: 'https://worker.example.com' },
      };

      mockDb.namespace.findFirst.mockResolvedValue(namespace);

      // Mock Cloudflare failure
      const { CloudflareSearchTool } = await import('@agentset/cloudflare-tools');
      const mockSearch = vi.fn().mockRejectedValue(new Error('Worker timeout'));
      (CloudflareSearchTool as any).mockImplementation(() => ({ search: mockSearch }));

      // Mock local vector store fallback
      const { getNamespaceEmbeddingModel, getNamespaceVectorStore, queryVectorStore } = await import('@agentset/engine');
      (getNamespaceEmbeddingModel as any).mockResolvedValue({ embedText: vi.fn() });
      (getNamespaceVectorStore as any).mockResolvedValue({});
      (queryVectorStore as any).mockResolvedValue({
        results: [
          { id: 'local-doc1', score: 0.9, text: 'Local result', metadata: {} },
        ],
      });

      // Mock error metric tracking
      mockDb.cloudflareMetric.create.mockResolvedValue({ id: 1 });

      const ctx = createTestContext({});
      const caller = createCaller(ctx as any);

      const result = await caller.search({
        namespaceId: 'ns-fallback',
        query: 'test fallback',
        topK: 10,
        rerank: false,
        rerankModel: 'cohere-rerank-english-v3.0',
        rerankLimit: 10,
      });

      // Verify error was tracked
      expect(mockDb.cloudflareMetric.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          namespaceId: 'ns-fallback',
          queryCount: 0,
          errorCount: 1,
        }),
      });

      // Verify fallback was used
      expect(getNamespaceEmbeddingModel).toHaveBeenCalled();
      expect(getNamespaceVectorStore).toHaveBeenCalled();
      expect(queryVectorStore).toHaveBeenCalled();

      // Verify results from fallback
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('local-doc1');
    });

    it('should use local RAG when ragProvider is not cloudflare', async () => {
      const namespace = {
        id: 'ns-local',
        ragProvider: 'local',
      };

      mockDb.namespace.findFirst.mockResolvedValue(namespace);

      // Mock local vector store
      const { getNamespaceEmbeddingModel, getNamespaceVectorStore, queryVectorStore } = await import('@agentset/engine');
      (getNamespaceEmbeddingModel as any).mockResolvedValue({ embedText: vi.fn() });
      (getNamespaceVectorStore as any).mockResolvedValue({});
      (queryVectorStore as any).mockResolvedValue({
        results: [
          { id: 'doc1', score: 0.95, text: 'Local result 1', metadata: { title: 'Doc 1' } },
          { id: 'doc2', score: 0.85, text: 'Local result 2', metadata: { title: 'Doc 2' } },
        ],
      });

      const ctx = createTestContext({});
      const caller = createCaller(ctx as any);

      const result = await caller.search({
        namespaceId: 'ns-local',
        query: 'test local',
        topK: 10,
        rerank: false,
        rerankModel: 'cohere-rerank-english-v3.0',
        rerankLimit: 10,
      });

      // Verify local RAG was used
      expect(queryVectorStore).toHaveBeenCalledWith({
        query: 'test local',
        topK: 10,
        filter: undefined,
        includeMetadata: true,
        rerank: false,
        embeddingModel: expect.any(Object),
        vectorStore: expect.any(Object),
      });

      // Verify results
      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe('doc1');
    });
  });

  describe('Error Handling', () => {
    it('should throw NOT_FOUND when namespace does not exist', async () => {
      mockDb.namespace.findFirst.mockResolvedValue(null);

      const ctx = createTestContext({});
      const caller = createCaller(ctx as any);

      await expect(
        caller.search({
          namespaceId: 'non-existent',
          query: 'test',
          topK: 10,
          rerank: false,
          rerankModel: 'cohere-rerank-english-v3.0',
          rerankLimit: 10,
        })
      ).rejects.toThrow('NOT_FOUND');
    });

    it('should throw UNAUTHORIZED when user is not authenticated', async () => {
      const ctx = {
        db: mockDb as any,
        session: null,
        headers: new Headers(),
      };
      const caller = createCaller(ctx as any);

      await expect(
        caller.search({
          namespaceId: 'ns-test',
          query: 'test',
          topK: 10,
          rerank: false,
          rerankModel: 'cohere-rerank-english-v3.0',
          rerankLimit: 10,
        })
      ).rejects.toThrow('UNAUTHORIZED');
    });
  });

  describe('Request/Response Contract Validation', () => {
    it('should validate required fields in request', async () => {
      const namespace = { id: 'ns-test', ragProvider: 'local' };
      mockDb.namespace.findFirst.mockResolvedValue(namespace);

      const { getNamespaceEmbeddingModel, getNamespaceVectorStore, queryVectorStore } = await import('@agentset/engine');
      (getNamespaceEmbeddingModel as any).mockResolvedValue({});
      (getNamespaceVectorStore as any).mockResolvedValue({});
      (queryVectorStore as any).mockResolvedValue({ results: [] });

      const ctx = createTestContext({});
      const caller = createCaller(ctx as any);

      // Missing namespaceId
      await expect(
        caller.search({
          // @ts-expect-error - Testing validation
          namespaceId: undefined,
          query: 'test',
          topK: 10,
          rerank: false,
          rerankModel: 'cohere-rerank-english-v3.0',
          rerankLimit: 10,
        })
      ).rejects.toThrow();

      // Missing query
      await expect(
        caller.search({
          namespaceId: 'ns-test',
          // @ts-expect-error - Testing validation
          query: undefined,
          topK: 10,
          rerank: false,
          rerankModel: 'cohere-rerank-english-v3.0',
          rerankLimit: 10,
        })
      ).rejects.toThrow();
    });

    it('should enforce topK limits', async () => {
      const namespace = { id: 'ns-test', ragProvider: 'local' };
      mockDb.namespace.findFirst.mockResolvedValue(namespace);

      const ctx = createTestContext({});
      const caller = createCaller(ctx as any);

      // topK too small
      await expect(
        caller.search({
          namespaceId: 'ns-test',
          query: 'test',
          topK: 0,
          rerank: false,
          rerankModel: 'cohere-rerank-english-v3.0',
          rerankLimit: 10,
        })
      ).rejects.toThrow();

      // topK too large
      await expect(
        caller.search({
          namespaceId: 'ns-test',
          query: 'test',
          topK: 101,
          rerank: false,
          rerankModel: 'cohere-rerank-english-v3.0',
          rerankLimit: 10,
        })
      ).rejects.toThrow();
    });

    it('should return results in expected format', async () => {
      const namespace = {
        id: 'ns-format',
        ragProvider: 'cloudflare',
        cfSettings: { endpoint: 'https://worker.example.com' },
      };

      mockDb.namespace.findFirst.mockResolvedValue(namespace);

      const { CloudflareSearchTool } = await import('@agentset/cloudflare-tools');
      const mockSearch = vi.fn().mockResolvedValue({
        answer: 'Test',
        sources: [
          {
            metadata: { id: 'doc1', title: 'Title' },
            score: 0.95,
            preview: 'Preview text',
          },
        ],
        metadata: { model: 'test', tokens: 0, cached: false, latency: 0 },
        cached: false,
        latency: 0,
      });
      (CloudflareSearchTool as any).mockImplementation(() => ({ search: mockSearch }));

      mockDb.cloudflareMetric.create.mockResolvedValue({ id: 1 });

      const ctx = createTestContext({});
      const caller = createCaller(ctx as any);

      const result = await caller.search({
        namespaceId: 'ns-format',
        query: 'test',
        topK: 10,
        rerank: false,
        rerankModel: 'cohere-rerank-english-v3.0',
        rerankLimit: 10,
      });

      // Verify result structure
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('score');
      expect(result[0]).toHaveProperty('text');
      expect(result[0]).toHaveProperty('metadata');

      // Verify field types
      expect(typeof result[0]?.id).toBe('string');
      expect(typeof result[0]?.score).toBe('number');
      expect(typeof result[0]?.text).toBe('string');
      expect(typeof result[0]?.metadata).toBe('object');
    });
  });
});
