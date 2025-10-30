import { embed } from "ai";

import type { Namespace } from "@agentset/db";
import {
  getNamespaceEmbeddingModel,
  getNamespaceVectorStore,
} from "@agentset/engine";

const modelToDimensions: Record<
  PrismaJson.NamespaceEmbeddingConfig["model"],
  number
> = {
  // openai
  "text-embedding-3-large": 3072,
  "text-embedding-3-small": 1536,

  // google
  "text-embedding-004": 768,

  // voyage
  "voyage-3-large": 1024,
  "voyage-3": 1024,
  "voyage-3-lite": 512,
  "voyage-code-3": 1024,
  "voyage-finance-2": 1024,
  "voyage-law-2": 1024,

  // cloudflare (not used due to early return, but required for type completeness)
  "auto": 768, // Cloudflare AI Search uses @cf/baai/bge-base-en-v1.5 which is 768 dimensions
};

export const validateVectorStoreConfig = async (
  vectorStoreConfig: NonNullable<Namespace["vectorStoreConfig"]>,
  embeddingConfig: NonNullable<Namespace["embeddingConfig"]>,
) => {
  // Skip validation for MANAGED_CLOUDFLARE - it handles dimensions automatically
  // Cloudflare AI Search handles embeddings and dimensions internally
  if (vectorStoreConfig.provider === "MANAGED_CLOUDFLARE") {
    return {
      success: true as const,
    };
  }

  // TODO: make this dynamic
  const embeddingDimensions: number = modelToDimensions[embeddingConfig.model];

  // Validate vector store and check dimensions
  let vectorStoreDimensions: number;
  try {
    const v = await getNamespaceVectorStore({ id: "", vectorStoreConfig });
    const dimensions = await v.getDimensions();
    vectorStoreDimensions =
      dimensions === "ANY" ? embeddingDimensions : dimensions;
  } catch {
    return {
      success: false as const,
      error:
        "Failed to validate vector store config, make sure the API key is valid",
    };
  }

  if (vectorStoreDimensions !== embeddingDimensions) {
    return {
      success: false as const,
      error: `Embedding dimensions mismatch: ${vectorStoreDimensions} !== ${embeddingDimensions}`,
    };
  }

  return {
    success: true as const,
  };
};

export const validateEmbeddingModel = async (
  embeddingConfig: NonNullable<Namespace["embeddingConfig"]>,
) => {
  // Skip validation for managed providers - they don't require immediate API validation
  // MANAGED_CLOUDFLARE: Embeddings are handled by Cloudflare AI Search Worker
  // MANAGED_TURBOPUFFER: Embeddings are handled by Turbopuffer service
  if (embeddingConfig.provider.startsWith("MANAGED_")) {
    return {
      success: true as const,
    };
  }

  const model = await getNamespaceEmbeddingModel({ embeddingConfig }, "query");

  try {
    await embed({
      model,
      value: "Hello, world!",
    });

    return {
      success: true as const,
    };
  } catch {
    return {
      success: false as const,
      error:
        "Failed to validate embedding model, make sure the API key is valid",
    };
  }
};
