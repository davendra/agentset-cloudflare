import { VectorStore } from "../common/vector-store";
import type {
  VectorStoreQueryOptions,
  VectorStoreQueryResponse,
  VectorStoreUpsertOptions,
} from "../common/vector-store";
import { CloudflareSearchTool } from "@agentset/cloudflare-tools";
import type { SearchSource } from "@agentset/cloudflare-tools";
import { TextNode, MetadataMode } from "@llamaindex/core/schema";
import { CloudflareFilterTranslator, type CloudflareVectorFilter } from "./filter";

export interface CloudflareVectorStoreConfig {
  endpoint: string;
  apiKey?: string;
  namespaceId: string;
  tenantId?: string;
  workspaceId?: string;
}

/**
 * Cloudflare AI Search Vector Store Adapter
 * Integrates AgentSet with Cloudflare AI Search for semantic retrieval
 */
export class CloudflareVectorStore implements VectorStore<CloudflareVectorFilter> {
  private readonly client: CloudflareSearchTool;
  private readonly filterTranslator = new CloudflareFilterTranslator();
  private readonly namespaceId: string;
  private readonly tenantId?: string;
  private readonly workspaceId?: string;

  constructor(config: CloudflareVectorStoreConfig) {
    this.client = new CloudflareSearchTool({
      endpoint: config.endpoint,
      apiKey: config.apiKey,
    });
    this.namespaceId = config.namespaceId;
    this.tenantId = config.tenantId;
    this.workspaceId = config.workspaceId;
  }

  /**
   * Query Cloudflare AI Search for relevant documents
   * Note: Currently uses the full search endpoint and extracts sources.
   * Future optimization: Add retrieval-only endpoint to Worker.
   */
  async query(
    options: VectorStoreQueryOptions<CloudflareVectorFilter>,
  ): Promise<VectorStoreQueryResponse> {
    // Translate filter to Cloudflare format
    const translatedFilter = this.filterTranslator.translate(options.filter);

    // Add namespace and tenant filters
    const filters: Record<string, unknown> = {
      ...translatedFilter,
      namespaceId: this.namespaceId,
    };
    if (this.tenantId) {
      filters.tenantId = this.tenantId;
    }

    // Determine query mode based on input
    let queryText: string;

    if ("query" in options.mode && options.mode.query) {
      // Text query mode - let Cloudflare handle embedding
      queryText = options.mode.query.query;
    } else if ("vector" in options.mode && options.mode.vector) {
      // Vector mode - need to convert to text query for current API
      // NOTE: This is a limitation of the current cloudflare-tools API
      // Future: Add direct vector search endpoint
      queryText = "semantic search"; // Placeholder
      console.warn("Cloudflare VectorStore: Vector mode not yet fully supported, using text query fallback");
    } else {
      throw new Error("Invalid query mode for Cloudflare VectorStore");
    }

    // Call Cloudflare Worker search endpoint
    const response = await this.client.search({
      query: queryText,
      filters,
      workspaceId: this.workspaceId,
      mode: "private", // Default to private mode for better security
      safety: "standard",
      modelRoute: "fast-lane", // Use fast route for retrieval
      max_tokens: 100, // Minimize tokens since we only need sources
    });

    // Convert sources to VectorStoreQueryResponse format
    const results = response.sources.slice(0, options.topK ?? 10).map((source) => {
      // Create TextNode from source data
      const node = new TextNode({
        id_: source.metadata.id as string,
        text: source.preview,
        metadata: source.metadata,
      });

      return {
        id: source.metadata.id as string,
        score: source.score,
        text: node.getContent(MetadataMode.NONE),
        metadata: options.includeMetadata ? node.metadata : undefined,
        relationships: options.includeRelationships ? node.relationships : undefined,
      };
    });

    return results;
  }

  /**
   * Upsert is not supported - Cloudflare AI Search ingestion happens via R2/Website sources
   */
  async upsert(_options: VectorStoreUpsertOptions): Promise<void> {
    throw new Error(
      "CloudflareVectorStore does not support upsert. Documents are ingested via Cloudflare AI Search R2/Website sources.",
    );
  }

  /**
   * Delete by IDs is not supported - Cloudflare AI Search manages document lifecycle
   */
  async deleteByIds(_idOrIds: string | string[]): Promise<{ deleted?: number }> {
    throw new Error(
      "CloudflareVectorStore does not support deleteByIds. Document management happens via Cloudflare AI Search sources.",
    );
  }

  /**
   * Delete by filter is not supported
   */
  async deleteByFilter(_filter: CloudflareVectorFilter): Promise<{ deleted?: number }> {
    throw new Error(
      "CloudflareVectorStore does not support deleteByFilter. Document management happens via Cloudflare AI Search sources.",
    );
  }

  /**
   * Delete namespace is not supported
   */
  async deleteNamespace(): Promise<{ deleted?: number }> {
    throw new Error(
      "CloudflareVectorStore does not support deleteNamespace. Namespace management happens via Cloudflare AI Search configuration.",
    );
  }

  /**
   * Get embedding dimensions
   * Cloudflare AI Search uses bge-base-en-v1.5 with 768 dimensions by default
   */
  async getDimensions(): Promise<number> {
    return 768; // bge-base-en-v1.5 dimension size
  }

  /**
   * Warm cache is not supported - Cloudflare handles caching at edge
   */
  async warmCache(): Promise<"UNSUPPORTED"> {
    return "UNSUPPORTED" as const;
  }

  /**
   * Cloudflare AI Search uses semantic search only
   */
  supportsKeyword(): boolean {
    return false;
  }
}
