import { incrementSearchUsage } from "@/lib/api/usage";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import {
  getNamespaceEmbeddingModel,
  getNamespaceVectorStore,
  queryVectorStore,
} from "@agentset/engine";
// TODO: Re-enable once @agentset/cloudflare-tools package is created
// import { CloudflareSearchTool } from "@agentset/cloudflare-tools";
import { rerankerSchema } from "@agentset/validation";
// import { env } from "@agentset/engine/env";

import { getNamespaceByUser } from "../auth";

const chunkExplorerInputSchema = z.object({
  namespaceId: z.string(),
  query: z.string().min(1),
  topK: z.number().min(1).max(100),
  rerank: z.boolean(),
  rerankModel: rerankerSchema,
  rerankLimit: z.number().min(1).max(100),
  filter: z.record(z.string(), z.any()).optional(),
});

export const searchRouter = createTRPCRouter({
  search: protectedProcedure
    .input(chunkExplorerInputSchema)
    .query(async ({ ctx, input }) => {
      const namespace = await getNamespaceByUser(ctx, {
        id: input.namespaceId,
      });

      if (!namespace) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // TODO: Re-enable Cloudflare integration once @agentset/cloudflare-tools is created
      // const startTime = Date.now();
      // let useCloudflare = false;
      // let cloudflareError: Error | null = null;
      //
      // // Check if Cloudflare mode is enabled for this namespace
      // if (namespace.ragProvider === "cloudflare") {
      //   useCloudflare = true;
      //
      //   try {
      //     const cfSettings = namespace.cfSettings as Record<string, unknown> | null;
      //     const endpoint = (cfSettings?.endpoint as string) ?? env.DEFAULT_CLOUDFLARE_ENDPOINT;
      //     const apiKey = (cfSettings?.apiKey as string) ?? env.DEFAULT_CLOUDFLARE_API_KEY;
      //
      //     const client = new CloudflareSearchTool({
      //       endpoint,
      //       apiKey,
      //     });
      //
      //     const response = await client.search({
      //       query: input.query,
      //       filters: {
      //         namespaceId: namespace.id,
      //         ...input.filter,
      //       },
      //       mode: namespace.cfCacheMode === "public" ? "public" : "private",
      //       safety: (namespace.cfSafetyLevel as "off" | "standard" | "strict") ?? "standard",
      //       modelRoute: (namespace.cfModelRoute as "final-answer" | "fast-lane" | "cheap") ?? "fast-lane",
      //       max_tokens: 500,
      //     });
      //
      //     const latency = Date.now() - startTime;
      //
      //     // Track Cloudflare metrics
      //     await ctx.db.cloudflareMetric.create({
      //       data: {
      //         namespaceId: namespace.id,
      //         timestamp: new Date(),
      //         queryCount: 1,
      //         avgLatencyMs: latency,
      //         cacheHits: response.cached ? 1 : 0,
      //         cacheMisses: response.cached ? 0 : 1,
      //       },
      //     });
      //
      //     // Track search usage
      //     incrementSearchUsage(namespace.id, 1);
      //
      //     // Convert Cloudflare sources to expected format
      //     return response.sources.slice(0, input.topK).map((source) => ({
      //       id: source.metadata.id as string,
      //       score: source.score,
      //       text: source.preview,
      //       metadata: source.metadata,
      //     }));
      //   } catch (error) {
      //     console.error("Cloudflare search failed, falling back to local RAG:", error);
      //     cloudflareError = error as Error;
      //     useCloudflare = false;
      //
      //     // Track error in metrics
      //     await ctx.db.cloudflareMetric.create({
      //       data: {
      //         namespaceId: namespace.id,
      //         timestamp: new Date(),
      //         queryCount: 0,
      //         errorCount: 1,
      //       },
      //     });
      //   }
      // }

      // Local vector store (always use until Cloudflare is re-enabled)
      {
        const [embeddingModel, vectorStore] = await Promise.all([
          getNamespaceEmbeddingModel(namespace, "query"),
          getNamespaceVectorStore(namespace),
        ]);

        const queryResult = await queryVectorStore({
          query: input.query,
          topK: input.topK,
          filter: input.filter,
          includeMetadata: true,
          rerank: input.rerank
            ? { model: input.rerankModel, limit: input.rerankLimit }
            : false,
          embeddingModel,
          vectorStore,
        });

        // Track search usage
        incrementSearchUsage(namespace.id, 1);

        return queryResult.results;
      }
    }),
});
