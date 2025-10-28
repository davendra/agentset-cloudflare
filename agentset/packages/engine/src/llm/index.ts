import { createOpenAI } from "@ai-sdk/openai";
import { LanguageModel } from "ai";

import { DEFAULT_LLM, LLM } from "@agentset/validation";

import { env } from "../env";

let cloudflareWorkersAI: ReturnType<typeof createOpenAI> | null = null;

function getCloudflareWorkersAI() {
  if (!cloudflareWorkersAI) {
    if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) {
      throw new Error(
        "Cloudflare Workers AI is not configured. Please set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN environment variables."
      );
    }

    // Cloudflare Workers AI through AI Gateway
    // Uses Workers AI models (@cf/meta/llama, etc.) routed through AI Gateway
    cloudflareWorkersAI = createOpenAI({
      apiKey: "dummy", // Not needed for Workers AI, but required by SDK
      baseURL: `https://gateway.ai.cloudflare.com/v1/${env.CLOUDFLARE_ACCOUNT_ID}/agentset-gateway/workers-ai`,
      headers: {
        "Authorization": `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      },
    });
  }
  return cloudflareWorkersAI;
}

const modelToId: Record<LLM, string> = {
  "openai:gpt-4.1": "@cf/meta/llama-3.1-8b-instruct",
  "openai:gpt-5": "@cf/meta/llama-3.1-70b-instruct",
  "openai:gpt-5-mini": "@cf/meta/llama-3.1-8b-instruct",
  "openai:gpt-5-nano": "@cf/qwen/qwen1.5-0.5b-chat",
};

export const getNamespaceLanguageModel = (model?: LLM): LanguageModel => {
  return getCloudflareWorkersAI()(modelToId[model ?? DEFAULT_LLM]);
};
