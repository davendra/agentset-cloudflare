import { z } from "zod/v4";

export const CloudflareVectorStoreConfigSchema = z
  .object({
    provider: z.literal("CLOUDFLARE"),
    endpoint: z.url().meta({
      description: "The Cloudflare Worker endpoint URL for AI Search.",
      example: "https://agentset-ai-search.your-subdomain.workers.dev",
    }),
    apiKey: z.string().optional().describe("Optional API key for authenticating with the Cloudflare Worker."),
    workspaceId: z.string().optional().describe("Optional workspace ID for multi-tenant isolation."),
  })
  .meta({
    id: "cloudflare-config",
    title: "Cloudflare AI Search Config",
  });
