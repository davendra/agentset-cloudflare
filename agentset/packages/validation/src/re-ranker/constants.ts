export const RERANKER_MODELS = {
  cohere: [
    { model: "rerank-v3.5", name: "Cohere Rerank v3.5" },
    { model: "rerank-english-v3.0", name: "Cohere Rerank English v3.0" },
    {
      model: "rerank-multilingual-v3.0",
      name: "Cohere Rerank Multilingual v3.0",
    },
  ],
} as const;

type _RerankerMap = {
  [T in keyof typeof RERANKER_MODELS]: `${T}:${(typeof RERANKER_MODELS)[T][number]["model"]}`;
};

export type RerankingModel = _RerankerMap[keyof _RerankerMap];

// No default reranker - requires user-provided credentials
export const DEFAULT_RERANKER: RerankingModel = "cohere:rerank-v3.5";
