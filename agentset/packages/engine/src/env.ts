import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod/v4";

export const env = createEnv({
  server: {
    // Cloudflare vector store - primary provider
    DEFAULT_CLOUDFLARE_ENDPOINT: z.url().optional(),
    DEFAULT_CLOUDFLARE_API_KEY: z.string().optional(),

    // Cloudflare AI Gateway for LLM (uses Workers AI models)
    CLOUDFLARE_ACCOUNT_ID: z.string(),
    CLOUDFLARE_API_TOKEN: z.string(),

    PARTITION_API_KEY: z.string(),
    PARTITION_API_URL: z.url(),
  },
  runtimeEnv: {
    DEFAULT_CLOUDFLARE_ENDPOINT: process.env.DEFAULT_CLOUDFLARE_ENDPOINT,
    DEFAULT_CLOUDFLARE_API_KEY: process.env.DEFAULT_CLOUDFLARE_API_KEY,

    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,

    PARTITION_API_KEY: process.env.PARTITION_API_KEY,
    PARTITION_API_URL: process.env.PARTITION_API_URL,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
