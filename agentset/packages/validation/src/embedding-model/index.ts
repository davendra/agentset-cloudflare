import { z } from "zod/v4";

import { CloudflareEmbeddingConfigSchema } from "./cloudflare";
import { GoogleEmbeddingConfigSchema } from "./google";
import { OpenAIEmbeddingConfigSchema } from "./openai";
import { VoyageEmbeddingConfigSchema } from "./voyage";

export type EmbeddingConfig = z.infer<typeof EmbeddingConfigSchema>;
export * from "./cloudflare";
export * from "./google";
export * from "./openai";
export * from "./voyage";

export const EmbeddingConfigSchema = z
  .discriminatedUnion("provider", [
    CloudflareEmbeddingConfigSchema,
    OpenAIEmbeddingConfigSchema,
    VoyageEmbeddingConfigSchema,
    GoogleEmbeddingConfigSchema,
  ])
  .meta({
    id: "embedding-model-config",
    description:
      "The embedding model config. If not provided, Cloudflare AI Search with automatic embeddings will be used. Note: You can't change the embedding model config after the namespace is created.",
  });
