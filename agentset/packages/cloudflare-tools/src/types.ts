/**
 * Type definitions for AgentSet Cloudflare Search Tool
 */

/**
 * Search options for querying the Worker
 */
export interface SearchOptions {
  /** The search query text */
  query: string;

  /** Optional metadata filters for search refinement */
  filters?: Record<string, unknown>;

  /** Workspace identifier for tenant isolation */
  workspaceId?: string;

  /** Cache mode: 'public' enables caching, 'private' disables it */
  mode?: 'public' | 'private';

  /** Safety level for content moderation */
  safety?: 'off' | 'standard' | 'strict';

  /** Model route selection: quality, speed, or cost optimized */
  modelRoute?: 'final-answer' | 'fast-lane' | 'cheap';

  /** Temperature for LLM generation (0-2) */
  temperature?: number;

  /** Maximum tokens in LLM response */
  max_tokens?: number;
}

/**
 * Individual search result source
 */
export interface SearchSource {
  /** Source index (1-based) */
  idx: number;

  /** Similarity score (0-1) */
  score: number;

  /** Source metadata */
  metadata: Record<string, unknown>;

  /** Text preview of the source */
  preview: string;

  /** Optional source URL */
  url?: string;
}

/**
 * Search response from the Worker
 */
export interface SearchResponse {
  /** Generated answer to the query */
  answer: string;

  /** Array of source documents used */
  sources: SearchSource[];

  /** Response metadata */
  metadata?: {
    /** Model used for generation */
    model?: string;

    /** Total tokens used */
    tokens?: number;

    /** Whether response was cached */
    cached?: boolean;

    /** Response latency in milliseconds */
    latency?: number;
  };
}

/**
 * Configuration for the Cloudflare Search Tool client
 */
export interface CloudflareSearchToolConfig {
  /** Worker endpoint URL (e.g., https://agentset-ai-search.sub.workers.dev) */
  endpoint: string;

  /** Optional API key for authentication */
  apiKey?: string;

  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;

  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;

  /** Initial retry delay in milliseconds (default: 1000) */
  retryDelay?: number;
}

/**
 * Custom error for Cloudflare Search Tool operations
 */
export class CloudflareSearchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'CloudflareSearchError';
  }
}
