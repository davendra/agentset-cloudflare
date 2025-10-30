import { agenticSearch } from "@/lib/agentic/search";
import { AgentsetApiError } from "@/lib/api/errors";
import { withPublicApiHandler } from "@/lib/api/handler/public";
import { hostingAuth } from "@/lib/api/hosting-auth";
import { makeApiSuccessResponse } from "@/lib/api/response";
import { incrementSearchUsage } from "@/lib/api/usage";
import { parseRequestBody } from "@/lib/api/utils";

import { db } from "@agentset/db";
import {
  getNamespaceEmbeddingModel,
  getNamespaceLanguageModel,
  getNamespaceVectorStore,
  KeywordStore,
} from "@agentset/engine";
import { env } from "@agentset/engine/env";
import { CloudflareSearchTool } from "@agentset/cloudflare-tools";

import { hostingSearchSchema } from "./schema";

// export const runtime = "edge";
export const preferredRegion = "iad1"; // make this closer to the DB
export const maxDuration = 60;

export const POST = withPublicApiHandler(
  async ({ req, searchParams, headers }) => {
    const body = await hostingSearchSchema.parseAsync(
      await parseRequestBody(req),
    );

    const namespaceId = searchParams.namespaceId;
    if (!namespaceId) {
      throw new AgentsetApiError({
        code: "bad_request",
        message: "Namespace ID is required",
      });
    }

    const hosting = await db.hosting.findFirst({
      where: {
        namespaceId,
      },
      select: {
        id: true,
        protected: true,
        allowedEmails: true,
        allowedEmailDomains: true,
        searchEnabled: true,
        rerankConfig: true,
        llmConfig: true,
        namespace: {
          select: {
            id: true,
            vectorStoreConfig: true,
            embeddingConfig: true,
            keywordEnabled: true,
            // Cloudflare integration fields
            ragProvider: true,
            cfModelRoute: true,
            cfSafetyLevel: true,
            cfCacheMode: true,
            cfSettings: true,
          },
        },
      },
    });

    if (!hosting) {
      throw new AgentsetApiError({
        code: "not_found",
        message: "Hosting not found",
      });
    }

    await hostingAuth(req, hosting);

    if (!hosting.searchEnabled) {
      throw new AgentsetApiError({
        code: "forbidden",
        message: "Search is disabled for this hosting",
      });
    }

    // === CLOUDFLARE INTEGRATION ===
    // Check if Cloudflare mode is enabled for this namespace
    if (hosting.namespace.ragProvider === "cloudflare") {
      console.log("[HOSTING-SEARCH] Using Cloudflare RAG");

      try {
        const cfSettings = hosting.namespace.cfSettings as Record<string, unknown> | null;
        const endpoint = (cfSettings?.endpoint as string) || env.DEFAULT_CLOUDFLARE_ENDPOINT;
        const apiKey = (cfSettings?.apiKey as string) || env.DEFAULT_CLOUDFLARE_API_KEY;

        if (!endpoint) {
          throw new Error("Cloudflare endpoint not configured");
        }

        const client = new CloudflareSearchTool({
          endpoint,
          apiKey,
        });

        const startTime = Date.now();
        const response = await client.search({
          query: body.query,
          filters: {
            namespaceId: hosting.namespace.id,
          },
          mode: hosting.namespace.cfCacheMode === "public" ? "public" : "private",
          safety: (hosting.namespace.cfSafetyLevel as "off" | "standard" | "strict") || "standard",
          modelRoute: (hosting.namespace.cfModelRoute as "final-answer" | "fast-lane" | "cheap") || "fast-lane",
          max_tokens: 500,
        });

        const latency = Date.now() - startTime;

        // Track usage
        incrementSearchUsage(hosting.namespace.id, 1);

        // === SAVE CLOUDFLARE METRICS ===
        // Track detailed metrics for dashboard and monitoring
        try {
          await db.cloudflareMetric.create({
            data: {
              namespaceId: hosting.namespace.id,
              timestamp: new Date(),
              queryCount: 1,
              avgLatencyMs: latency,
              p95LatencyMs: latency, // Single query, so p95 = actual
              p99LatencyMs: latency, // Single query, so p99 = actual
              cacheHits: response.metadata?.cached ? 1 : 0,
              cacheMisses: response.metadata?.cached ? 0 : 1,
              totalTokens: response.metadata?.tokens || null,
              totalCost: null, // TODO: Calculate cost based on model and tokens
              errorCount: 0,
              rateLimitHits: 0,
              // Store model usage breakdown
              modelUsage: response.metadata?.model ? {
                [response.metadata.model]: 1
              } : null,
            },
          });
        } catch (metricsError) {
          // Don't fail the request if metrics logging fails
          console.error("[HOSTING-SEARCH] Failed to log Cloudflare metrics:", metricsError);
        }

        // Convert Cloudflare response to expected format
        // Cloudflare returns: { answer, sources[] }
        // UI expects: { totalQueries, queries[], chunks[] }
        return makeApiSuccessResponse({
          data: {
            totalQueries: 1,
            queries: [{
              type: "semantic" as const,
              query: body.query,
            }],
            chunks: response.sources.map((source) => ({
              id: (source.metadata.id as string) || `source-${source.idx}`,
              score: source.score,
              text: source.preview,
              metadata: {
                ...source.metadata,
                _cloudflare: true,
                _answer: response.answer,
                _latency: latency,
                _cached: response.metadata?.cached,
              },
            })),
          },
          headers,
        });
      } catch (error) {
        console.error("[HOSTING-SEARCH] Cloudflare search failed, falling back to local RAG:", error);

        // === TRACK ERROR METRICS ===
        try {
          await db.cloudflareMetric.create({
            data: {
              namespaceId: hosting.namespace.id,
              timestamp: new Date(),
              queryCount: 0,
              errorCount: 1,
              cacheHits: 0,
              cacheMisses: 0,
            },
          });
        } catch (metricsError) {
          console.error("[HOSTING-SEARCH] Failed to log error metrics:", metricsError);
        }

        // Fall through to local RAG below
      }
    }

    // === LOCAL RAG (Default or Fallback) ===
    console.log("[HOSTING-SEARCH] Using Local RAG");

    const [languageModel, vectorStore, embeddingModel] = await Promise.all([
      getNamespaceLanguageModel(hosting.llmConfig?.model),
      getNamespaceVectorStore(hosting.namespace),
      getNamespaceEmbeddingModel(hosting.namespace, "query"),
    ]);

    const keywordStore = hosting.namespace.keywordEnabled
      ? new KeywordStore(hosting.namespace.id)
      : undefined;

    const result = await agenticSearch({
      // TODO: get from hosting
      model: languageModel,
      queryOptions: {
        embeddingModel,
        vectorStore,
        topK: 50,
        rerank: {
          model: hosting.rerankConfig?.model,
          limit: 15,
        },
        includeMetadata: true,
      },
      messages: [
        {
          role: "user",
          content: body.query,
        },
      ],
    });

    incrementSearchUsage(hosting.namespace.id, result.totalQueries);

    return makeApiSuccessResponse({
      data: {
        totalQueries: result.totalQueries,
        queries: result.queries,
        chunks: Object.values(result.chunks),
      },
      headers,
    });
  },
);
