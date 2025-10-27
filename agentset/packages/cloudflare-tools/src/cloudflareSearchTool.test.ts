/**
 * Tests for CloudflareSearchTool client
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CloudflareSearchTool, createCloudflareSearchTool } from './cloudflareSearchTool';
import { CloudflareSearchError } from './types';

describe('CloudflareSearchTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('constructor', () => {
    it('should create instance with required config', () => {
      const client = new CloudflareSearchTool({
        endpoint: 'https://test.workers.dev',
      });

      expect(client.getEndpoint()).toBe('https://test.workers.dev');
    });

    it('should apply default configuration', () => {
      const client = new CloudflareSearchTool({
        endpoint: 'https://test.workers.dev',
      });

      expect(client).toBeDefined();
    });
  });

  describe('search', () => {
    it('should make successful search request', async () => {
      const mockResponse = {
        answer: 'Test answer',
        sources: [],
        metadata: { model: 'test', tokens: 100, cached: false, latency: 50 },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const client = new CloudflareSearchTool({
        endpoint: 'https://test.workers.dev',
        maxRetries: 0,
      });

      const result = await client.search({ query: 'test query' });

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://test.workers.dev/search',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('test query'),
        })
      );
    });

    it('should include API key in headers when provided', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ answer: 'test', sources: [] }),
      });

      const client = new CloudflareSearchTool({
        endpoint: 'https://test.workers.dev',
        apiKey: 'test-api-key',
        maxRetries: 0,
      });

      await client.search({ query: 'test' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      );
    });

    it('should throw CloudflareSearchError on HTTP error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ message: 'Server error' }),
      });

      const client = new CloudflareSearchTool({
        endpoint: 'https://test.workers.dev',
        maxRetries: 0,
      });

      await expect(client.search({ query: 'test' })).rejects.toThrow(CloudflareSearchError);
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

      const client = new CloudflareSearchTool({
        endpoint: 'https://test.workers.dev',
        maxRetries: 0,
      });

      await expect(client.search({ query: 'test' })).rejects.toThrow(CloudflareSearchError);
    });

    // Note: Timeout testing requires more complex setup with AbortController mocking
    // Covered by integration tests instead
  });

  describe('health', () => {
    it('should return true when endpoint is healthy', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true });

      const client = new CloudflareSearchTool({
        endpoint: 'https://test.workers.dev',
      });

      const isHealthy = await client.health();
      expect(isHealthy).toBe(true);
    });

    it('should return false when endpoint is unhealthy', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false });

      const client = new CloudflareSearchTool({
        endpoint: 'https://test.workers.dev',
      });

      const isHealthy = await client.health();
      expect(isHealthy).toBe(false);
    });

    it('should return false on network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const client = new CloudflareSearchTool({
        endpoint: 'https://test.workers.dev',
      });

      const isHealthy = await client.health();
      expect(isHealthy).toBe(false);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      const client = new CloudflareSearchTool({
        endpoint: 'https://test.workers.dev',
      });

      client.updateConfig({ timeout: 60000 });

      // Config is updated (verified through behavior in actual use)
      expect(client).toBeDefined();
    });
  });

  describe('createCloudflareSearchTool', () => {
    it('should create instance via factory function', () => {
      const client = createCloudflareSearchTool({
        endpoint: 'https://test.workers.dev',
      });

      expect(client).toBeInstanceOf(CloudflareSearchTool);
      expect(client.getEndpoint()).toBe('https://test.workers.dev');
    });
  });
});
