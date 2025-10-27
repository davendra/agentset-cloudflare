/**
 * Tests for CloudflareVectorStore
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CloudflareVectorStore } from './index';
import { CloudflareFilterTranslator } from './filter';
import { MetadataMode, TextNode } from '@llamaindex/core';

// Mock CloudflareSearchTool
vi.mock('@agentset/cloudflare-tools', () => ({
  CloudflareSearchTool: vi.fn().mockImplementation(() => ({
    search: vi.fn(),
    health: vi.fn(),
  })),
}));

describe('CloudflareVectorStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with required config', () => {
      const store = new CloudflareVectorStore({
        endpoint: 'https://test.workers.dev',
        namespaceId: 'test-namespace',
      });

      expect(store).toBeDefined();
    });

    it('should create instance with optional config', () => {
      const store = new CloudflareVectorStore({
        endpoint: 'https://test.workers.dev',
        apiKey: 'test-key',
        namespaceId: 'test-namespace',
        tenantId: 'test-tenant',
        workspaceId: 'test-workspace',
      });

      expect(store).toBeDefined();
    });
  });

  describe('query', () => {
    it('should query with text query mode', async () => {
      const mockResponse = {
        answer: 'Test answer',
        sources: [
          {
            metadata: { id: 'doc1', title: 'Test Doc' },
            score: 0.95,
            preview: 'Test content',
          },
        ],
        metadata: { model: 'test', tokens: 100, cached: false, latency: 50 },
        cached: false,
        latency: 50,
      };

      const { CloudflareSearchTool } = await import('@agentset/cloudflare-tools');
      const mockSearch = vi.fn().mockResolvedValue(mockResponse);
      (CloudflareSearchTool as any).mockImplementation(() => ({
        search: mockSearch,
      }));

      const store = new CloudflareVectorStore({
        endpoint: 'https://test.workers.dev',
        namespaceId: 'test-namespace',
      });

      const result = await store.query({
        mode: {
          query: {
            query: 'test query',
          },
        },
        topK: 10,
      });

      expect(mockSearch).toHaveBeenCalledWith({
        query: 'test query',
        filters: { namespaceId: 'test-namespace' },
        workspaceId: undefined,
        mode: 'private',
        safety: 'standard',
        modelRoute: 'fast-lane',
        max_tokens: 100,
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('doc1');
      expect(result[0]?.score).toBe(0.95);
    });

    it('should apply filters correctly', async () => {
      const mockResponse = {
        answer: '',
        sources: [],
        metadata: { model: 'test', tokens: 0, cached: false, latency: 0 },
        cached: false,
        latency: 0,
      };

      const { CloudflareSearchTool } = await import('@agentset/cloudflare-tools');
      const mockSearch = vi.fn().mockResolvedValue(mockResponse);
      (CloudflareSearchTool as any).mockImplementation(() => ({
        search: mockSearch,
      }));

      const store = new CloudflareVectorStore({
        endpoint: 'https://test.workers.dev',
        namespaceId: 'test-namespace',
        tenantId: 'test-tenant',
      });

      await store.query({
        mode: {
          query: {
            query: 'test',
          },
        },
        topK: 5,
        filter: {
          documentType: 'pdf',
          status: 'published',
        },
      });

      expect(mockSearch).toHaveBeenCalledWith({
        query: 'test',
        filters: {
          documentType: 'pdf',
          status: 'published',
          namespaceId: 'test-namespace',
          tenantId: 'test-tenant',
        },
        workspaceId: undefined,
        mode: 'private',
        safety: 'standard',
        modelRoute: 'fast-lane',
        max_tokens: 100,
      });
    });

    it('should respect topK limit', async () => {
      const mockSources = Array.from({ length: 20 }, (_, i) => ({
        metadata: { id: `doc${i}` },
        score: 1 - i * 0.01,
        preview: `Content ${i}`,
      }));

      const mockResponse = {
        answer: '',
        sources: mockSources,
        metadata: { model: 'test', tokens: 0, cached: false, latency: 0 },
        cached: false,
        latency: 0,
      };

      const { CloudflareSearchTool } = await import('@agentset/cloudflare-tools');
      const mockSearch = vi.fn().mockResolvedValue(mockResponse);
      (CloudflareSearchTool as any).mockImplementation(() => ({
        search: mockSearch,
      }));

      const store = new CloudflareVectorStore({
        endpoint: 'https://test.workers.dev',
        namespaceId: 'test-namespace',
      });

      const result = await store.query({
        mode: {
          query: {
            query: 'test',
          },
        },
        topK: 5,
      });

      expect(result).toHaveLength(5);
      expect(result[0]?.id).toBe('doc0');
      expect(result[4]?.id).toBe('doc4');
    });

    it('should include metadata when requested', async () => {
      const mockResponse = {
        answer: '',
        sources: [
          {
            metadata: { id: 'doc1', title: 'Test', author: 'John' },
            score: 0.95,
            preview: 'Test content',
          },
        ],
        metadata: { model: 'test', tokens: 0, cached: false, latency: 0 },
        cached: false,
        latency: 0,
      };

      const { CloudflareSearchTool } = await import('@agentset/cloudflare-tools');
      const mockSearch = vi.fn().mockResolvedValue(mockResponse);
      (CloudflareSearchTool as any).mockImplementation(() => ({
        search: mockSearch,
      }));

      const store = new CloudflareVectorStore({
        endpoint: 'https://test.workers.dev',
        namespaceId: 'test-namespace',
      });

      const result = await store.query({
        mode: {
          query: {
            query: 'test',
          },
        },
        topK: 10,
        includeMetadata: true,
      });

      expect(result[0]?.metadata).toEqual({
        id: 'doc1',
        title: 'Test',
        author: 'John',
      });
    });

    it('should handle vector mode with warning', async () => {
      const mockResponse = {
        answer: '',
        sources: [],
        metadata: { model: 'test', tokens: 0, cached: false, latency: 0 },
        cached: false,
        latency: 0,
      };

      const { CloudflareSearchTool } = await import('@agentset/cloudflare-tools');
      const mockSearch = vi.fn().mockResolvedValue(mockResponse);
      (CloudflareSearchTool as any).mockImplementation(() => ({
        search: mockSearch,
      }));

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const store = new CloudflareVectorStore({
        endpoint: 'https://test.workers.dev',
        namespaceId: 'test-namespace',
      });

      await store.query({
        mode: {
          vector: {
            embedding: [0.1, 0.2, 0.3],
          },
        },
        topK: 10,
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Vector mode not yet fully supported')
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('getDimensions', () => {
    it('should return 768 for bge-base-en-v1.5', async () => {
      const store = new CloudflareVectorStore({
        endpoint: 'https://test.workers.dev',
        namespaceId: 'test-namespace',
      });

      const dimensions = await store.getDimensions();
      expect(dimensions).toBe(768);
    });
  });

  describe('supportsKeyword', () => {
    it('should return false', () => {
      const store = new CloudflareVectorStore({
        endpoint: 'https://test.workers.dev',
        namespaceId: 'test-namespace',
      });

      expect(store.supportsKeyword()).toBe(false);
    });
  });
});

describe('CloudflareFilterTranslator', () => {
  let translator: CloudflareFilterTranslator;

  beforeEach(() => {
    translator = new CloudflareFilterTranslator();
  });

  describe('translate', () => {
    it('should translate simple key-value filters', () => {
      const filter = {
        status: 'published',
        type: 'article',
      };

      const result = translator.translate(filter);

      expect(result).toEqual({
        status: 'published',
        type: 'article',
      });
    });

    it('should translate $eq operator', () => {
      const filter = {
        status: { $eq: 'published' },
      };

      const result = translator.translate(filter);

      expect(result).toEqual({
        status: 'published',
      });
    });

    it('should handle string array values', () => {
      const filter = {
        tags: ['tech', 'ai', 'ml'],
      };

      const result = translator.translate(filter);

      expect(result).toEqual({
        tags: ['tech', 'ai', 'ml'],
      });
    });

    it('should skip unsupported operators with warning', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const filter = {
        $and: [{ status: 'published' }, { type: 'article' }],
      };

      const result = translator.translate(filter);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Operator $and not fully supported')
      );
      expect(result).toBeNull();

      consoleWarnSpy.mockRestore();
    });

    it('should return null for empty filter', () => {
      const result = translator.translate({});

      expect(result).toBeNull();
    });

    it('should handle mixed types', () => {
      const filter = {
        active: true,
        count: 42,
        name: 'test',
      };

      const result = translator.translate(filter);

      expect(result).toEqual({
        active: true,
        count: 42,
        name: 'test',
      });
    });
  });
});
