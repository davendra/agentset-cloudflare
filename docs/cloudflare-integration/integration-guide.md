# Integration Guide

This guide walks you through integrating the AgentSet UI with Cloudflare AI Search and AI Gateway.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Phase 1: Setup Cloudflare Services](#phase-1-setup-cloudflare-services)
3. [Phase 2: Integrate agentset-tools Package](#phase-2-integrate-agentset-tools-package)
4. [Phase 3: Create Cloudflare Adapter](#phase-3-create-cloudflare-adapter)
5. [Phase 4: Modify Search Router](#phase-4-modify-search-router)
6. [Phase 5: Add Admin UI](#phase-5-add-admin-ui)
7. [Phase 6: Testing](#phase-6-testing)
8. [Phase 7: Deployment](#phase-7-deployment)

---

## Prerequisites

### Required Accounts & Access

- ✅ Cloudflare account with Workers, R2, AI Search, and AI Gateway enabled
- ✅ Node.js >= 22.12.0
- ✅ pnpm >= 9.15.4
- ✅ Git access to both repositories
- ✅ Wrangler CLI installed (`npm install -g wrangler`)

### Required Knowledge

- TypeScript/Next.js development
- tRPC API patterns
- Cloudflare Workers basics
- Vector database concepts

---

## Phase 1: Setup Cloudflare Services

### Step 1.1: Create AI Search Project

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **AI** → **AI Search**
3. Click **Create Project**
4. Configure:
   - **Name**: `agentset-production`
   - **Embedding Model**: `@cf/baai/bge-base-en-v1.5` (or your preferred model)

### Step 1.2: Connect R2 Bucket

1. In AI Search project, go to **Sources**
2. Click **Add Source** → **R2 Bucket**
3. Create new bucket or select existing:
   - **Name**: `agentset-documents`
   - **Location**: Auto (multi-region)
4. Enable **Auto-ingestion**
5. Configure parsing:
   - ✅ PDF OCR
   - ✅ DOCX parsing
   - ✅ Markdown parsing

### Step 1.3: Create AI Gateway

1. Navigate to **AI** → **AI Gateway**
2. Click **Create Gateway**
3. Configure:
   - **Name**: `agentset-gateway`
   - **Providers**: Add OpenAI, Anthropic, Google (as needed)

### Step 1.4: Configure Gateway Routes

Create three model routes for different use cases:

#### Route 1: `final-answer` (Quality)
```json
{
  "name": "final-answer",
  "strategy": "fallback",
  "providers": [
    { "provider": "anthropic", "model": "claude-3-5-sonnet-20241022" },
    { "provider": "openai", "model": "gpt-4o" },
    { "provider": "workers-ai", "model": "@cf/meta/llama-3.1-8b-instruct" }
  ],
  "cache_ttl": 3600,
  "rate_limit": "1000/hour"
}
```

#### Route 2: `fast-lane` (Low-latency)
```json
{
  "name": "fast-lane",
  "strategy": "fallback",
  "providers": [
    { "provider": "openai", "model": "gpt-4o-mini" },
    { "provider": "anthropic", "model": "claude-3-haiku-20240307" },
    { "provider": "workers-ai", "model": "@cf/meta/llama-3.1-8b-instruct" }
  ],
  "cache_ttl": 7200,
  "rate_limit": "5000/hour"
}
```

#### Route 3: `cheap` (Budget)
```json
{
  "name": "cheap",
  "strategy": "fallback",
  "providers": [
    { "provider": "workers-ai", "model": "@cf/meta/llama-3.1-8b-instruct" },
    { "provider": "openai", "model": "gpt-4o-mini" }
  ],
  "cache_ttl": 86400,
  "rate_limit": "10000/hour"
}
```

### Step 1.5: Configure Guardrails

1. In AI Gateway, go to **Guardrails**
2. Create profiles:

**Standard Profile:**
- Content filtering: Moderate
- PII detection: Enabled
- Rate limiting: Normal

**Strict Profile:**
- Content filtering: Strict
- PII detection: Enabled + redaction
- Prompt injection detection: Enabled
- Rate limiting: Conservative

### Step 1.6: Get API Credentials

Collect these values for later configuration:

```bash
# From Cloudflare Dashboard → Account → API Tokens
CLOUDFLARE_ACCOUNT_ID="your-account-id"
CLOUDFLARE_API_TOKEN="your-api-token"

# From AI Search Project → Settings
AI_SEARCH_PROJECT_ID="your-search-project-id"
AI_SEARCH_API_KEY="your-search-api-key"

# From AI Gateway → Settings
CF_GATEWAY_URL="https://gateway.ai.cloudflare.com/v1/<account>/<gateway>/openai"
GATEWAY_TOKEN="your-gateway-token"
```

---

## Phase 2: Integrate agentset-tools Package

### Step 2.1: Copy Package to AgentSet Monorepo

```bash
# From project root
cd /Users/davendrapatel/Documents/GitHub/agentset-cloudflare

# Copy the tools package
cp -r agentset-cloudflare-app/packages/agentset-tools \
      agentset/packages/cloudflare-tools

# Navigate to the copied package
cd agentset/packages/cloudflare-tools
```

### Step 2.2: Update package.json

Edit `agentset/packages/cloudflare-tools/package.json`:

```json
{
  "name": "@agentset/cloudflare-tools",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc",
    "clean": "git clean -xdf .cache .turbo dist node_modules",
    "dev": "tsc --watch",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "zod": "catalog:"
  },
  "devDependencies": {
    "@agentset/eslint-config": "workspace:*",
    "@agentset/prettier-config": "workspace:*",
    "@agentset/tsconfig": "workspace:*",
    "eslint": "catalog:",
    "prettier": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  },
  "prettier": "@agentset/prettier-config"
}
```

### Step 2.3: Update pnpm-workspace.yaml

Edit `agentset/pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "packages/cloudflare-tools"  # Add this line
  - "tooling/*"
```

### Step 2.4: Install Dependencies

```bash
cd agentset
pnpm install
```

---

## Phase 3: Create Cloudflare Adapter

### Step 3.1: Create Adapter Directory

```bash
mkdir -p agentset/packages/engine/src/vector-store/cloudflare
```

### Step 3.2: Create Cloudflare Vector Store Implementation

Create `agentset/packages/engine/src/vector-store/cloudflare/index.ts`:

```typescript
import type { CloudflareSearchTool } from '@agentset/cloudflare-tools';
import type { VectorStore, QueryParams, QueryResult, Chunk } from '../common/vector-store';

export interface CloudflareVectorStoreConfig {
  client: CloudflareSearchTool;
  namespaceId: string;
  organizationId: string;
}

export class CloudflareVectorStore implements VectorStore {
  constructor(private config: CloudflareVectorStoreConfig) {}

  async query(params: QueryParams): Promise<QueryResult> {
    const { query, topK = 10, filter, includeMetadata = true } = params;

    // Call Cloudflare Worker via the client
    const response = await this.config.client.search({
      query,
      workspaceId: this.config.namespaceId,
      filters: {
        tenantId: this.config.organizationId,
        ...filter,
      },
      // Map other parameters as needed
    });

    // Convert Cloudflare response to unified QueryResult format
    return {
      results: response.sources.map((source, index) => ({
        id: source.idx.toString(),
        score: source.score,
        metadata: includeMetadata ? source.metadata : undefined,
        content: source.preview,
      })),
      metadata: {
        model: response.metadata?.model,
        cached: response.metadata?.cached,
        latency: response.metadata?.latency,
      },
    };
  }

  async upsert(chunks: Chunk[]): Promise<void> {
    // For Cloudflare, upserting is handled via R2 upload + auto-ingestion
    throw new Error(
      'Direct upsert not supported for Cloudflare. Upload documents to R2 instead.'
    );
  }

  async delete(ids: string[]): Promise<void> {
    // Deletion would need to be implemented via AI Search API
    throw new Error('Delete operation not yet implemented for Cloudflare vector store');
  }

  async clear(): Promise<void> {
    throw new Error('Clear operation not supported for Cloudflare vector store');
  }
}
```

### Step 3.3: Create Factory Function

Create `agentset/packages/engine/src/vector-store/cloudflare/factory.ts`:

```typescript
import { CloudflareSearchTool } from '@agentset/cloudflare-tools';
import { CloudflareVectorStore } from './index';
import type { Namespace } from '@agentset/db';

export async function createCloudflareVectorStore(
  namespace: Namespace
): Promise<CloudflareVectorStore> {
  // Get Cloudflare endpoint from environment
  const endpoint = process.env.CF_SEARCH_ENDPOINT;
  const apiKey = process.env.CF_API_KEY;

  if (!endpoint) {
    throw new Error('CF_SEARCH_ENDPOINT not configured');
  }

  // Create client
  const client = new CloudflareSearchTool({
    endpoint,
    apiKey,
  });

  // Return vector store instance
  return new CloudflareVectorStore({
    client,
    namespaceId: namespace.id,
    organizationId: namespace.organizationId,
  });
}
```

### Step 3.4: Update Engine Index

Edit `agentset/packages/engine/src/vector-store/index.ts`:

```typescript
import type { Namespace } from '@agentset/db';
import type { VectorStore } from './common/vector-store';
import { createPineconeVectorStore } from './pinecone';
import { createTurbopufferVectorStore } from './turbopuffer';
import { createCloudflareVectorStore } from './cloudflare/factory';  // Add this

export async function getNamespaceVectorStore(
  namespace: Namespace
): Promise<VectorStore> {
  // Check if namespace is configured for Cloudflare
  if (namespace.settings?.ragProvider === 'cloudflare') {
    return await createCloudflareVectorStore(namespace);
  }

  // Fall back to existing logic
  switch (namespace.vectorStore) {
    case 'pinecone':
      return await createPineconeVectorStore(namespace);
    case 'turbopuffer':
      return await createTurbopufferVectorStore(namespace);
    default:
      throw new Error(`Unsupported vector store: ${namespace.vectorStore}`);
  }
}
```

---

## Phase 4: Modify Search Router

### Step 4.1: Create Cloudflare Search Utility

Create `agentset/apps/web/src/lib/cloudflare/search.ts`:

```typescript
import { CloudflareSearchTool } from '@agentset/cloudflare-tools';
import type { Namespace } from '@agentset/db';

interface CloudflareSearchParams {
  query: string;
  namespace: Namespace;
  topK?: number;
  rerank?: boolean;
  rerankModel?: string;
  rerankLimit?: number;
  filter?: Record<string, any>;
}

export async function queryCloudflareSearch(params: CloudflareSearchParams) {
  const client = new CloudflareSearchTool({
    endpoint: process.env.CF_SEARCH_ENDPOINT!,
    apiKey: process.env.CF_API_KEY,
  });

  const response = await client.search({
    query: params.query,
    workspaceId: params.namespace.id,
    filters: {
      tenantId: params.namespace.organizationId,
      ...params.filter,
    },
    modelRoute: params.namespace.settings?.cfModelRoute || 'final-answer',
    safety: params.namespace.settings?.cfSafetyLevel || 'standard',
    mode: params.namespace.settings?.cfCacheMode || 'public',
  });

  // Convert Cloudflare response to expected format
  return response.sources.map((source) => ({
    id: source.idx.toString(),
    score: source.score,
    metadata: source.metadata,
    content: source.preview,
  }));
}
```

### Step 4.2: Update Search Router

Edit `agentset/apps/web/src/server/api/routers/search.ts`:

```typescript
import { incrementSearchUsage } from "@/lib/api/usage";
import { queryCloudflareSearch } from "@/lib/cloudflare/search";  // Add this
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import {
  getNamespaceEmbeddingModel,
  getNamespaceVectorStore,
  queryVectorStore,
} from "@agentset/engine";
import { rerankerSchema } from "@agentset/validation";

import { getNamespaceByUser } from "../auth";

const chunkExplorerInputSchema = z.object({
  namespaceId: z.string(),
  query: z.string().min(1),
  topK: z.number().min(1).max(100),
  rerank: z.boolean(),
  rerankModel: rerankerSchema,
  rerankLimit: z.number().min(1).max(100),
  filter: z.record(z.string(), z.any()).optional(),
});

export const searchRouter = createTRPCRouter({
  search: protectedProcedure
    .input(chunkExplorerInputSchema)
    .query(async ({ ctx, input }) => {
      const namespace = await getNamespaceByUser(ctx, {
        id: input.namespaceId,
      });

      if (!namespace) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // NEW: Check if namespace uses Cloudflare
      const useCloudflare =
        namespace.settings?.ragProvider === 'cloudflare' ||
        process.env.RAG_MODE === 'cloudflare';

      let queryResult;

      if (useCloudflare) {
        // Route to Cloudflare Worker
        console.log(`[Search] Using Cloudflare for namespace ${namespace.id}`);
        queryResult = await queryCloudflareSearch({
          query: input.query,
          namespace,
          topK: input.topK,
          rerank: input.rerank,
          rerankModel: input.rerankModel,
          rerankLimit: input.rerankLimit,
          filter: input.filter,
        });
      } else {
        // Existing local implementation
        console.log(`[Search] Using local RAG for namespace ${namespace.id}`);
        const [embeddingModel, vectorStore] = await Promise.all([
          getNamespaceEmbeddingModel(namespace, "query"),
          getNamespaceVectorStore(namespace),
        ]);

        const result = await queryVectorStore({
          query: input.query,
          topK: input.topK,
          filter: input.filter,
          includeMetadata: true,
          rerank: input.rerank
            ? { model: input.rerankModel, limit: input.rerankLimit }
            : false,
          embeddingModel,
          vectorStore,
        });

        queryResult = result.results;
      }

      // Track search usage
      await incrementSearchUsage(namespace.id, 1);

      return queryResult;
    }),
});
```

---

## Phase 5: Add Admin UI

### Step 5.1: Update Database Schema

Edit `agentset/packages/db/prisma/schema.prisma`:

```prisma
model Namespace {
  id String @id @default(cuid())
  // ... existing fields

  // Cloudflare Integration Settings
  ragProvider     String?  @default("local") // 'local' | 'cloudflare'
  cfModelRoute    String?  // 'final-answer' | 'fast-lane' | 'cheap'
  cfSafetyLevel   String?  // 'off' | 'standard' | 'strict'
  cfCacheMode     String?  // 'public' | 'private'
  cfSettings      Json?    // Additional CF-specific settings

  // ... existing fields
}
```

Run migration:

```bash
cd agentset/packages/db
pnpm db:migrate
```

### Step 5.2: Create Cloudflare Settings Page

Create `agentset/apps/web/src/app/app.agentset.ai/(dashboard)/[slug]/[namespaceSlug]/settings/cloudflare/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@agentset/ui/button';
import { Label } from '@agentset/ui/label';
import { Select } from '@agentset/ui/select';
import { Switch } from '@agentset/ui/switch';
import { Card } from '@agentset/ui/card';
import { api } from '@/trpc/react';

export default function CloudflareSettingsPage({
  params,
}: {
  params: { slug: string; namespaceSlug: string };
}) {
  const { data: namespace } = api.namespace.get.useQuery({
    slug: params.namespaceSlug,
  });

  const updateSettings = api.namespace.updateCloudflareSettings.useMutation();

  const [ragProvider, setRagProvider] = useState(
    namespace?.ragProvider || 'local'
  );
  const [modelRoute, setModelRoute] = useState(
    namespace?.cfModelRoute || 'final-answer'
  );
  const [safetyLevel, setSafetyLevel] = useState(
    namespace?.cfSafetyLevel || 'standard'
  );
  const [cacheMode, setCacheMode] = useState(
    namespace?.cfCacheMode || 'public'
  );

  const handleSave = async () => {
    await updateSettings.mutateAsync({
      namespaceId: namespace!.id,
      ragProvider,
      cfModelRoute: modelRoute,
      cfSafetyLevel: safetyLevel,
      cfCacheMode: cacheMode,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cloudflare Settings</h1>
        <p className="text-muted-foreground">
          Configure Cloudflare AI Search and Gateway integration
        </p>
      </div>

      <Card className="p-6 space-y-6">
        {/* RAG Provider Selection */}
        <div className="space-y-2">
          <Label>RAG Provider</Label>
          <Select value={ragProvider} onValueChange={setRagProvider}>
            <option value="local">Local (Pinecone/Turbopuffer)</option>
            <option value="cloudflare">Cloudflare AI Search</option>
          </Select>
          <p className="text-sm text-muted-foreground">
            Choose where to run vector search and retrieval
          </p>
        </div>

        {ragProvider === 'cloudflare' && (
          <>
            {/* Model Route Selection */}
            <div className="space-y-2">
              <Label>Model Route</Label>
              <Select value={modelRoute} onValueChange={setModelRoute}>
                <option value="final-answer">
                  Final Answer (Highest Quality)
                </option>
                <option value="fast-lane">Fast Lane (Low Latency)</option>
                <option value="cheap">Cheap (Budget Optimized)</option>
              </Select>
              <p className="text-sm text-muted-foreground">
                Select model routing strategy for AI Gateway
              </p>
            </div>

            {/* Safety Level */}
            <div className="space-y-2">
              <Label>Safety Level</Label>
              <Select value={safetyLevel} onValueChange={setSafetyLevel}>
                <option value="off">Off (No Guardrails)</option>
                <option value="standard">Standard (Recommended)</option>
                <option value="strict">Strict (Maximum Protection)</option>
              </Select>
              <p className="text-sm text-muted-foreground">
                Configure AI Gateway guardrails
              </p>
            </div>

            {/* Cache Mode */}
            <div className="space-y-2">
              <Label>Cache Mode</Label>
              <Select value={cacheMode} onValueChange={setCacheMode}>
                <option value="public">Public (Global Cache)</option>
                <option value="private">Private (No Cache)</option>
              </Select>
              <p className="text-sm text-muted-foreground">
                Control caching behavior for AI Gateway
              </p>
            </div>
          </>
        )}

        <Button onClick={handleSave} disabled={updateSettings.isPending}>
          {updateSettings.isPending ? 'Saving...' : 'Save Settings'}
        </Button>
      </Card>
    </div>
  );
}
```

---

## Phase 6: Testing

### Step 6.1: Unit Tests

Create `agentset/packages/cloudflare-tools/src/cloudflareSearchTool.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { CloudflareSearchTool } from './cloudflareSearchTool';

describe('CloudflareSearchTool', () => {
  let client: CloudflareSearchTool;

  beforeEach(() => {
    client = new CloudflareSearchTool({
      endpoint: 'https://test-worker.workers.dev',
      apiKey: 'test-key',
    });
  });

  it('should construct with valid config', () => {
    expect(client.getEndpoint()).toBe('https://test-worker.workers.dev');
  });

  it('should handle search requests', async () => {
    // Add mock implementation
  });

  // Add more tests...
});
```

### Step 6.2: Integration Tests

Create test script to validate end-to-end flow:

```bash
#!/bin/bash
# agentset/scripts/test-cloudflare-integration.sh

echo "Testing Cloudflare Integration..."

# Test Worker health
curl https://agentset-ai-search.workers.dev/health

# Test search endpoint
curl -X POST https://agentset-ai-search.workers.dev/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CF_API_KEY" \
  -d '{
    "query": "test query",
    "workspaceId": "test-workspace",
    "filters": { "tenantId": "test-tenant" }
  }'
```

---

## Phase 7: Deployment

### Step 7.1: Deploy Cloudflare Worker

```bash
cd agentset-cloudflare-app/apps/cf-worker

# Set secrets
npx wrangler secret put GATEWAY_TOKEN
npx wrangler secret put AI_SEARCH_API_KEY

# Deploy to production
npx wrangler deploy --env production
```

### Step 7.2: Configure AgentSet Environment

Edit `agentset/.env`:

```bash
# RAG Configuration
RAG_MODE=hybrid  # Start with hybrid mode
CF_SEARCH_ENDPOINT=https://agentset-ai-search.workers.dev
CF_API_KEY=your-api-key

# Feature Flags
ENABLE_CLOUDFLARE_SEARCH=true
ENABLE_LOCAL_FALLBACK=true
```

### Step 7.3: Deploy AgentSet

```bash
cd agentset

# Build
pnpm build

# Deploy (adjust for your hosting platform)
pnpm deploy
```

---

## Verification Checklist

After integration, verify:

- [ ] Worker health endpoint returns 200
- [ ] Search requests return valid responses
- [ ] Tenant filtering works correctly
- [ ] Caching reduces latency on repeated queries
- [ ] Admin UI allows switching RAG providers
- [ ] Metrics dashboard shows usage stats
- [ ] Fallback to local RAG works when Cloudflare is down
- [ ] Cost tracking is accurate

---

## Next Steps

- [Migration Guide](./migration-guide.md) - Migrate existing data to Cloudflare
- [API Reference](./api-reference.md) - Complete API documentation
- [Admin Guide](./admin-guide.md) - Operating the integrated system

## Troubleshooting

See [Troubleshooting Guide](./troubleshooting.md) for common issues and solutions.
