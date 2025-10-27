import { z } from "zod/v4";

import { CloudflareVectorStoreConfigSchema } from "./cloudflare";
import { PineconeVectorStoreConfigSchema } from "./pinecone";
import { TurbopufferVectorStoreConfigSchema } from "./turbopuffer";

export { CloudflareVectorStoreConfigSchema } from "./cloudflare";
export { PineconeVectorStoreConfigSchema } from "./pinecone";
export { TurbopufferVectorStoreConfigSchema } from "./turbopuffer";
export type VectorStoreConfig = z.infer<typeof VectorStoreSchema>;
export type CreateVectorStoreConfig = z.infer<typeof createVectorStoreSchema>;

const vectorStores = [
  z.object({ provider: z.literal("MANAGED_PINECONE") }),
  z.object({ provider: z.literal("MANAGED_TURBOPUFFER") }),
  z.object({ provider: z.literal("MANAGED_CLOUDFLARE") }),
  CloudflareVectorStoreConfigSchema,
  PineconeVectorStoreConfigSchema,
  TurbopufferVectorStoreConfigSchema,
] as const;

// This reflects the vector store config that is used to create a namespace
// note that MANAGED_PINECONE_OLD is not included here because it is an internal state
export const createVectorStoreSchema = z
  .discriminatedUnion("provider", vectorStores)
  .meta({
    id: "create-vector-store-config",
    description:
      "The vector store config. If not provided, our MANAGED_PINECONE vector store will be used. Note: You can't change the vector store config after the namespace is created.",
  });

// This reflects the vector store config that is stored in the database
export const VectorStoreSchema = z
  .discriminatedUnion("provider", [
    z.object({ provider: z.literal("MANAGED_PINECONE_OLD") }),
    ...vectorStores,
  ])
  .meta({
    id: "vector-store-config",
    description: "The vector store config.",
  });
