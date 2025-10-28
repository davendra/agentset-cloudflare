import { createOpenAI } from "@ai-sdk/openai";
import { LanguageModel } from "ai";

import { DEFAULT_LLM, LLM } from "@agentset/validation";

import { env } from "../env";

// Cloudflare AI Gateway + OpenAI client
const cloudflareGateway = createOpenAI({
  apiKey: env.OPENAI_API_KEY,
  baseURL: env.CLOUDFLARE_GATEWAY_URL,
});

const modelToId: Record<LLM, string> = {
  "openai:gpt-4.1": "gpt-4o",
  "openai:gpt-5": "gpt-4o",
  "openai:gpt-5-mini": "gpt-4o-mini",
  "openai:gpt-5-nano": "gpt-4o-mini",
};

export const getNamespaceLanguageModel = (model?: LLM): LanguageModel => {
  return cloudflareGateway(modelToId[model ?? DEFAULT_LLM]);
};
