import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { CloudflareSearchTool } from "@agentset/cloudflare-tools";

import { getNamespaceByUser } from "../auth";

/**
 * Cloudflare Integration tRPC Router
 * Handles Cloudflare-specific configuration, metrics, and testing
 */
export const cloudflareRouter = createTRPCRouter({
  /**
   * Get Cloudflare settings for a namespace
   */
  getSettings: protectedProcedure
    .input(z.object({ namespaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const namespace = await getNamespaceByUser(ctx, {
        id: input.namespaceId,
      });

      if (!namespace) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return {
        ragProvider: namespace.ragProvider,
        cfModelRoute: namespace.cfModelRoute,
        cfSafetyLevel: namespace.cfSafetyLevel,
        cfCacheMode: namespace.cfCacheMode,
        cfBudgetLimit: namespace.cfBudgetLimit,
        cfSettings: namespace.cfSettings as Record<string, unknown> | null,
      };
    }),

  /**
   * Update Cloudflare settings for a namespace
   */
  updateSettings: protectedProcedure
    .input(
      z.object({
        namespaceId: z.string(),
        ragProvider: z.string().nullable().optional(),
        cfModelRoute: z
          .enum(["final-answer", "fast-lane", "cheap"])
          .nullable()
          .optional(),
        cfSafetyLevel: z
          .enum(["off", "standard", "strict"])
          .nullable()
          .optional(),
        cfCacheMode: z.enum(["public", "private"]).nullable().optional(),
        cfBudgetLimit: z.number().positive().nullable().optional(),
        cfSettings: z.record(z.string(), z.unknown()).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const namespace = await getNamespaceByUser(ctx, {
        id: input.namespaceId,
      });

      if (!namespace) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Build update data object with only provided fields
      const updateData: Record<string, unknown> = {};
      if (input.ragProvider !== undefined)
        updateData.ragProvider = input.ragProvider;
      if (input.cfModelRoute !== undefined)
        updateData.cfModelRoute = input.cfModelRoute;
      if (input.cfSafetyLevel !== undefined)
        updateData.cfSafetyLevel = input.cfSafetyLevel;
      if (input.cfCacheMode !== undefined)
        updateData.cfCacheMode = input.cfCacheMode;
      if (input.cfBudgetLimit !== undefined)
        updateData.cfBudgetLimit = input.cfBudgetLimit;
      if (input.cfSettings !== undefined)
        updateData.cfSettings = input.cfSettings;

      const updatedNamespace = await ctx.db.namespace.update({
        where: { id: input.namespaceId },
        data: updateData,
      });

      return {
        success: true,
        ragProvider: updatedNamespace.ragProvider,
        cfModelRoute: updatedNamespace.cfModelRoute,
        cfSafetyLevel: updatedNamespace.cfSafetyLevel,
        cfCacheMode: updatedNamespace.cfCacheMode,
        cfBudgetLimit: updatedNamespace.cfBudgetLimit,
        cfSettings: updatedNamespace.cfSettings as Record<string, unknown> | null,
      };
    }),

  /**
   * Get Cloudflare metrics for a namespace
   */
  getMetrics: protectedProcedure
    .input(
      z.object({
        namespaceId: z.string(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        workspaceId: z.string().optional(),
        tenantId: z.string().optional(),
        limit: z.number().min(1).max(1000).default(100),
      }),
    )
    .query(async ({ ctx, input }) => {
      const namespace = await getNamespaceByUser(ctx, {
        id: input.namespaceId,
      });

      if (!namespace) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const metrics = await ctx.db.cloudflareMetric.findMany({
        where: {
          namespaceId: input.namespaceId,
          ...(input.startDate && { timestamp: { gte: input.startDate } }),
          ...(input.endDate && { timestamp: { lte: input.endDate } }),
          ...(input.workspaceId && { workspaceId: input.workspaceId }),
          ...(input.tenantId && { tenantId: input.tenantId }),
        },
        orderBy: { timestamp: "desc" },
        take: input.limit,
      });

      return metrics;
    }),

  /**
   * Test Cloudflare Worker connection
   */
  testConnection: protectedProcedure
    .input(
      z.object({
        namespaceId: z.string(),
        endpoint: z.url(),
        apiKey: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const namespace = await getNamespaceByUser(ctx, {
        id: input.namespaceId,
      });

      if (!namespace) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      try {
        const client = new CloudflareSearchTool({
          endpoint: input.endpoint,
          apiKey: input.apiKey,
        });

        // Test with a simple query
        const response = await client.search({
          query: "test connection",
          filters: { namespaceId: input.namespaceId },
          mode: "private",
          safety: "standard",
          modelRoute: "fast-lane",
          max_tokens: 10,
        });

        return {
          success: true,
          message: "Successfully connected to Cloudflare Worker",
          latency: response.latency,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to connect to Cloudflare Worker: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  /**
   * Get metrics summary/aggregates
   */
  getMetricsSummary: protectedProcedure
    .input(
      z.object({
        namespaceId: z.string(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const namespace = await getNamespaceByUser(ctx, {
        id: input.namespaceId,
      });

      if (!namespace) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const metrics = await ctx.db.cloudflareMetric.findMany({
        where: {
          namespaceId: input.namespaceId,
          ...(input.startDate && { timestamp: { gte: input.startDate } }),
          ...(input.endDate && { timestamp: { lte: input.endDate } }),
        },
      });

      // Calculate aggregates
      const totalQueries = metrics.reduce((sum, m) => sum + m.queryCount, 0);
      const totalCost = metrics.reduce(
        (sum, m) => sum + (m.totalCost ?? 0),
        0,
      );
      const totalTokens = metrics.reduce(
        (sum, m) => sum + (m.totalTokens ?? 0),
        0,
      );
      const totalCacheHits = metrics.reduce((sum, m) => sum + m.cacheHits, 0);
      const totalCacheMisses = metrics.reduce(
        (sum, m) => sum + m.cacheMisses,
        0,
      );
      const totalErrors = metrics.reduce((sum, m) => sum + m.errorCount, 0);

      const avgLatency =
        metrics.reduce((sum, m) => sum + (m.avgLatencyMs ?? 0), 0) /
        (metrics.length || 1);

      const cacheHitRate =
        totalCacheHits + totalCacheMisses > 0
          ? totalCacheHits / (totalCacheHits + totalCacheMisses)
          : 0;

      return {
        totalQueries,
        totalCost,
        totalTokens,
        totalCacheHits,
        totalCacheMisses,
        totalErrors,
        avgLatency,
        cacheHitRate,
        periodStart: input.startDate ?? null,
        periodEnd: input.endDate ?? null,
      };
    }),
});
