import { EmbeddingModel } from "ai";

import type { Namespace } from "@agentset/db";

import { env } from "../env";
import { WrapEmbeddingModel } from "./wrap-model";

export const getNamespaceEmbeddingModel = async (
  namespace: Pick<Namespace, "embeddingConfig">,
  type: "document" | "query" = "query",
): Promise<EmbeddingModel> => {
  let config = structuredClone(namespace.embeddingConfig);

  // NOTE: this technically should never happen because we should always have a embedding config
  if (!config) {
    config = {
      provider: "MANAGED_CLOUDFLARE",
      model: "auto",
    };
  }

  let model: EmbeddingModel;
  switch (config.provider) {
    case "OPENAI": {
      const { createOpenAI } = await import("@ai-sdk/openai");

      const { apiKey, model: modelName } = config;
      const openai = createOpenAI({ apiKey });
      model = openai.textEmbeddingModel(modelName);
      break;
    }

    case "VOYAGE": {
      const { createVoyage } = await import("voyage-ai-provider");

      const { apiKey, model: modelName } = config;
      const voyage = createVoyage({ apiKey });
      model = voyage.textEmbeddingModel(modelName);
      break;
    }

    case "GOOGLE": {
      const { createGoogleGenerativeAI } = await import("@ai-sdk/google");

      const { apiKey, model: modelName } = config;
      const google = createGoogleGenerativeAI({ apiKey });
      model = google.textEmbeddingModel(modelName);
      break;
    }

    case "MANAGED_CLOUDFLARE": {
      // Cloudflare AI Search handles embeddings automatically
      // When documents are uploaded to AI Search, it automatically generates embeddings
      // For query embeddings, we use Workers AI models

      if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) {
        throw new Error(
          "Cloudflare Workers AI is not configured. Please set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN environment variables."
        );
      }

      const { createOpenAI } = await import("@ai-sdk/openai");

      // Use Cloudflare Workers AI embedding model through AI Gateway
      const cloudflare = createOpenAI({
        apiKey: "dummy", // Not needed for Workers AI
        baseURL: `https://gateway.ai.cloudflare.com/v1/${env.CLOUDFLARE_ACCOUNT_ID}/agentset-gateway/workers-ai`,
        headers: {
          "Authorization": `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        },
      });
      model = cloudflare.textEmbeddingModel("@cf/baai/bge-base-en-v1.5");
      break;
    }

    default: {
      // This exhaustive check ensures TypeScript will error if a new provider
      // is added without handling it in the switch statement
      const _exhaustiveCheck: never = config;
      throw new Error(`Unknown vector store provider: ${_exhaustiveCheck}`);
    }
  }

  return new WrapEmbeddingModel(model, type);
};
