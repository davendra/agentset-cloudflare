import { AzureOpenAIProviderSettings } from "@ai-sdk/azure";
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
      provider: "MANAGED_OPENAI",
      model: "text-embedding-3-large",
    };
  }

  let model: EmbeddingModel;
  switch (config.provider) {
    case "MANAGED_OPENAI":
    case "AZURE_OPENAI": {
      const { createAzure } = await import("@ai-sdk/azure");

      const settings: AzureOpenAIProviderSettings =
        config.provider === "MANAGED_OPENAI"
          ? {
              resourceName: env.DEFAULT_AZURE_RESOURCE_NAME,
              apiKey: env.DEFAULT_AZURE_API_KEY,
              apiVersion: "preview",
            }
          : {
              resourceName: config.resourceName,
              apiKey: config.apiKey,
              apiVersion: config.apiVersion,
            };

      const azure = createAzure(settings);
      model = azure.textEmbeddingModel(
        config.provider === "MANAGED_OPENAI"
          ? env.DEFAULT_AZURE_EMBEDDING_DEPLOYMENT
          : config.deployment,
      );

      break;
    }

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
      // Create a passthrough model that will be handled by the Cloudflare Worker
      // The Worker uses AI Search's automatic embedding generation
      const { createOpenAI } = await import("@ai-sdk/openai");

      // Use OpenAI for compatibility, but this should ideally be handled by Cloudflare AI Search
      // TODO: Replace with Cloudflare-native embedding when available
      const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
      model = openai.textEmbeddingModel("text-embedding-3-small");
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
