import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod/v4";

export const env = createEnv({
  server: {
    // Cloudflare vector store - primary provider
    DEFAULT_CLOUDFLARE_ENDPOINT: z.url().optional(),
    DEFAULT_CLOUDFLARE_API_KEY: z.string().optional(),

    AZURE_SEARCH_URL: z.url(),
    AZURE_SEARCH_INDEX: z.string(),
    AZURE_SEARCH_KEY: z.string(),

    DEFAULT_AZURE_RESOURCE_NAME: z.string(),
    DEFAULT_AZURE_API_KEY: z.string(),
    DEFAULT_AZURE_EMBEDDING_DEPLOYMENT: z.string(),

    DEFAULT_COHERE_API_KEY: z.string(),
    DEFAULT_ZEROENTROPY_API_KEY: z.string(),

    PARTITION_API_KEY: z.string(),
    PARTITION_API_URL: z.url(),
  },
  runtimeEnv: {
    DEFAULT_CLOUDFLARE_ENDPOINT: process.env.DEFAULT_CLOUDFLARE_ENDPOINT,
    DEFAULT_CLOUDFLARE_API_KEY: process.env.DEFAULT_CLOUDFLARE_API_KEY,

    AZURE_SEARCH_URL: process.env.AZURE_SEARCH_URL,
    AZURE_SEARCH_INDEX: process.env.AZURE_SEARCH_INDEX,
    AZURE_SEARCH_KEY: process.env.AZURE_SEARCH_KEY,

    DEFAULT_AZURE_RESOURCE_NAME: process.env.DEFAULT_AZURE_RESOURCE_NAME,
    DEFAULT_AZURE_API_KEY: process.env.DEFAULT_AZURE_API_KEY,
    DEFAULT_AZURE_EMBEDDING_DEPLOYMENT:
      process.env.DEFAULT_AZURE_EMBEDDING_DEPLOYMENT,

    DEFAULT_COHERE_API_KEY: process.env.DEFAULT_COHERE_API_KEY,
    DEFAULT_ZEROENTROPY_API_KEY: process.env.DEFAULT_ZEROENTROPY_API_KEY,

    PARTITION_API_KEY: process.env.PARTITION_API_KEY,
    PARTITION_API_URL: process.env.PARTITION_API_URL,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
