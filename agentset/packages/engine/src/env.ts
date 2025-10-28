import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod/v4";

export const env = createEnv({
  server: {
    // Cloudflare vector store - primary provider
    DEFAULT_CLOUDFLARE_ENDPOINT: z.url().optional(),
    DEFAULT_CLOUDFLARE_API_KEY: z.string().optional(),

    // Cloudflare AI Gateway for LLM
    CLOUDFLARE_GATEWAY_URL: z.url(),
    CLOUDFLARE_ACCOUNT_ID: z.string(),
    CLOUDFLARE_GATEWAY_API_TOKEN: z.string(),
    OPENAI_API_KEY: z.string(),

    // Azure (deprecated - will be removed)
    AZURE_SEARCH_URL: z.url().optional(),
    AZURE_SEARCH_INDEX: z.string().optional(),
    AZURE_SEARCH_KEY: z.string().optional(),

    DEFAULT_AZURE_RESOURCE_NAME: z.string().optional(),
    DEFAULT_AZURE_API_KEY: z.string().optional(),
    DEFAULT_AZURE_EMBEDDING_DEPLOYMENT: z.string().optional(),

    PARTITION_API_KEY: z.string(),
    PARTITION_API_URL: z.url(),
  },
  runtimeEnv: {
    DEFAULT_CLOUDFLARE_ENDPOINT: process.env.DEFAULT_CLOUDFLARE_ENDPOINT,
    DEFAULT_CLOUDFLARE_API_KEY: process.env.DEFAULT_CLOUDFLARE_API_KEY,

    CLOUDFLARE_GATEWAY_URL: process.env.CLOUDFLARE_GATEWAY_URL,
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_GATEWAY_API_TOKEN: process.env.CLOUDFLARE_GATEWAY_API_TOKEN,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,

    AZURE_SEARCH_URL: process.env.AZURE_SEARCH_URL,
    AZURE_SEARCH_INDEX: process.env.AZURE_SEARCH_INDEX,
    AZURE_SEARCH_KEY: process.env.AZURE_SEARCH_KEY,

    DEFAULT_AZURE_RESOURCE_NAME: process.env.DEFAULT_AZURE_RESOURCE_NAME,
    DEFAULT_AZURE_API_KEY: process.env.DEFAULT_AZURE_API_KEY,
    DEFAULT_AZURE_EMBEDDING_DEPLOYMENT:
      process.env.DEFAULT_AZURE_EMBEDDING_DEPLOYMENT,

    PARTITION_API_KEY: process.env.PARTITION_API_KEY,
    PARTITION_API_URL: process.env.PARTITION_API_URL,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
