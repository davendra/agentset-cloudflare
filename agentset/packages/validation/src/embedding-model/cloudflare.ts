import { z } from "zod/v4";

export const CloudflareEmbeddingConfigSchema = z
  .object({
    provider: z.literal("MANAGED_CLOUDFLARE"),
    model: z.literal("auto").describe(
      "Cloudflare AI Search handles embeddings automatically. " +
        "When documents are uploaded, embeddings are generated automatically. " +
        "For query embeddings, Workers AI model @cf/baai/bge-base-en-v1.5 is used."
    ),
  })
  .meta({
    id: "cloudflare-embedding-config",
    title: "Cloudflare Embedding Config",
  });
