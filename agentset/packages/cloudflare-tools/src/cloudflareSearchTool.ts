/**
 * Cloudflare Search Tool Client
 * Provides a typed client for AgentSet UI to interact with the Cloudflare Worker
 */
import type {
  SearchOptions,
  SearchResponse,
  CloudflareSearchToolConfig,
} from './types';
import { CloudflareSearchError } from './types';

/**
 * Retry an async function with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  initialDelay: number
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on 4xx errors (client errors)
      if (error instanceof CloudflareSearchError && error.statusCode) {
        if (error.statusCode >= 400 && error.statusCode < 500) {
          throw error;
        }
      }

      // Don't retry if we've exhausted attempts
      if (attempt === maxRetries) {
        throw lastError;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = initialDelay * Math.pow(2, attempt);
      const jitter = delay * 0.25 * Math.random();
      await new Promise((resolve) => setTimeout(resolve, delay + jitter));
    }
  }

  throw lastError!;
}

/**
 * Cloudflare Search Tool Client
 *
 * @example
 * ```typescript
 * const client = new CloudflareSearchTool({
 *   endpoint: 'https://agentset-ai-search.sub.workers.dev',
 *   apiKey: 'your-api-key',
 * });
 *
 * const response = await client.search({
 *   query: 'What is the AgentSet platform?',
 *   workspaceId: 'ws-123',
 *   modelRoute: 'final-answer',
 * });
 *
 * console.log(response.answer);
 * console.log(response.sources);
 * ```
 */
export class CloudflareSearchTool {
  private config: CloudflareSearchToolConfig & {
    timeout: number;
    maxRetries: number;
    retryDelay: number;
  };

  constructor(config: CloudflareSearchToolConfig) {
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      ...config,
    };
  }

  /**
   * Perform a search query against the Cloudflare Worker
   *
   * @param options - Search options including query, filters, and model parameters
   * @returns Promise resolving to search response with answer and sources
   * @throws {CloudflareSearchError} If the request fails or returns an error
   *
   * @example
   * ```typescript
   * const response = await client.search({
   *   query: 'How do I configure the API?',
   *   workspaceId: 'workspace-123',
   *   modelRoute: 'fast-lane',
   *   safety: 'standard',
   * });
   * ```
   */
  async search(options: SearchOptions): Promise<SearchResponse> {
    return retryWithBackoff(
      () => this.executeSearch(options),
      this.config.maxRetries,
      this.config.retryDelay
    );
  }

  /**
   * Execute a single search request (internal method)
   */
  private async executeSearch(options: SearchOptions): Promise<SearchResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }

      const response = await fetch(`${this.config.endpoint}/search`, {
        method: 'POST',
        headers,
        body: JSON.stringify(options),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new CloudflareSearchError(
          errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorData
        );
      }

      const data = (await response.json()) as SearchResponse;
      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof CloudflareSearchError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new CloudflareSearchError(
            `Request timeout after ${this.config.timeout}ms`,
            408
          );
        }

        throw new CloudflareSearchError(
          `Network error: ${error.message}`,
          undefined,
          error
        );
      }

      throw new CloudflareSearchError('Unknown error occurred');
    }
  }

  /**
   * Check if the Worker is healthy
   *
   * @returns Promise resolving to true if healthy, false otherwise
   *
   * @example
   * ```typescript
   * const isHealthy = await client.health();
   * if (isHealthy) {
   *   console.log('Worker is healthy');
   * }
   * ```
   */
  async health(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.config.endpoint}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Update the client configuration
   *
   * @param config - Partial configuration to update
   *
   * @example
   * ```typescript
   * client.updateConfig({ timeout: 60000 });
   * ```
   */
  updateConfig(config: Partial<CloudflareSearchToolConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get the current endpoint URL
   */
  getEndpoint(): string {
    return this.config.endpoint;
  }
}

/**
 * Factory function to create a CloudflareSearchTool instance
 *
 * @param config - Client configuration
 * @returns CloudflareSearchTool instance
 *
 * @example
 * ```typescript
 * const client = createCloudflareSearchTool({
 *   endpoint: process.env.CF_SEARCH_ENDPOINT!,
 *   apiKey: process.env.CF_API_KEY,
 * });
 * ```
 */
export function createCloudflareSearchTool(
  config: CloudflareSearchToolConfig
): CloudflareSearchTool {
  return new CloudflareSearchTool(config);
}
