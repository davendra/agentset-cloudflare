import type { Namespace } from "@agentset/db";

import { env } from "../env";
import { VectorStore } from "./common/vector-store";

export const getNamespaceVectorStore = async (
  namespace: Pick<Namespace, "vectorStoreConfig" | "id">,
  tenant?: string | null,
): Promise<VectorStore> => {
  let config = namespace.vectorStoreConfig;
  const commonConfig = {
    namespaceId: namespace.id,
    tenantId: tenant ?? undefined,
  };

  // Default to Cloudflare if no config provided
  if (!config) {
    config = {
      provider: "MANAGED_CLOUDFLARE",
    };
  }

  switch (config.provider) {
    case "PINECONE": {
      const { Pinecone } = await import("./pinecone/index");

      return new Pinecone({
        apiKey: config.apiKey,
        indexHost: config.indexHost,
        ...commonConfig,
      }) as VectorStore;
    }

    case "TURBOPUFFER": {
      const { Turbopuffer } = await import("./turbopuffer/index");

      return new Turbopuffer({
        apiKey: config.apiKey,
        region: config.region,
        ...commonConfig,
      });
    }

    case "MANAGED_CLOUDFLARE":
    case "CLOUDFLARE": {
      const { CloudflareVectorStore } = await import("./cloudflare/index");

      let endpoint: string;
      let apiKey: string | undefined;

      if (config.provider === "MANAGED_CLOUDFLARE") {
        if (!env.DEFAULT_CLOUDFLARE_ENDPOINT) {
          throw new Error(
            "MANAGED_CLOUDFLARE provider requires DEFAULT_CLOUDFLARE_ENDPOINT environment variable to be set"
          );
        }
        endpoint = env.DEFAULT_CLOUDFLARE_ENDPOINT;
        apiKey = env.DEFAULT_CLOUDFLARE_API_KEY;
      } else {
        endpoint = config.endpoint;
        apiKey = config.apiKey;
      }

      return new CloudflareVectorStore({
        endpoint,
        apiKey,
        workspaceId: config.provider === "CLOUDFLARE" ? config.workspaceId : undefined,
        ...commonConfig,
      }) as VectorStore;
    }

    default: {
      // This exhaustive check ensures TypeScript will error if a new provider
      // is added without handling it in the switch statement
      const _exhaustiveCheck: never = config;
      throw new Error(`Unknown vector store provider: ${_exhaustiveCheck}`);
    }
  }
};
