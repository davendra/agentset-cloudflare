# AgentSet × Cloudflare Implementation PRD

## Overview
Implement the AgentSet × Cloudflare integration from documentation to working code. Create the monorepo structure with Cloudflare Worker, tool packages, and infrastructure setup.

## Current State
- ✅ All documentation complete (README, PRD, ROADMAP, ADMIN_GUIDE, CONTRIBUTING, SECURITY)
- ✅ Development tools installed: pnpm (10.19.0), wrangler (4.45.0), node (22.12.0)
- ❌ No implementation code exists - only documentation
- ❌ Monorepo structure (apps/, packages/, infra/, ops/) not created

## Goals
Implement Phase 1 (Foundation) with actual working code:
1. Set up monorepo structure with pnpm workspaces
2. Create Cloudflare Worker with AI Search + AI Gateway integration
3. Build agentset-tools package for UI integration
4. Set up shared config package (TypeScript, ESLint, Prettier)
5. Create infrastructure templates (Terraform for R2)
6. Add operational files (runbooks, diagrams, seeds)
7. Implement GitHub Actions CI/CD workflows
8. Add comprehensive test suites

## Detailed Implementation Tasks

### 1. Monorepo Foundation
**Location:** `agentset-cloudflare-app/`

- Create root `package.json` with pnpm workspace configuration
- Set up `pnpm-workspace.yaml` to define workspace packages
- Create `tsconfig.json` base configuration
- Add `.gitignore` for node_modules, dist, .env files
- Create `.nvmrc` with Node.js version (v22)

### 2. Shared Config Package
**Location:** `agentset-cloudflare-app/packages/config/`

- Create `package.json` for @agentset-cf/config
- Add TypeScript base config (`tsconfig.base.json`)
- Add TypeScript strict config (`tsconfig.strict.json`)
- Configure ESLint with TypeScript support
- Configure Prettier with project standards
- Export shareable configs for consumption by other packages

### 3. Cloudflare Worker Implementation
**Location:** `agentset-cloudflare-app/apps/cf-worker/`

**Core Files:**
- `wrangler.toml` - Worker configuration with bindings
- `package.json` - Dependencies: @cloudflare/workers-types, hono or itty-router
- `src/index.ts` - Main worker entry point
- `src/types.ts` - TypeScript interfaces for requests/responses
- `src/handlers/search.ts` - POST /search endpoint handler
- `src/services/aiSearch.ts` - AI Search integration service
- `src/services/aiGateway.ts` - AI Gateway integration service
- `src/utils/retry.ts` - Retry logic with exponential backoff
- `src/utils/headers.ts` - Cloudflare-specific header builders
- `src/middleware/cors.ts` - CORS middleware
- `src/middleware/auth.ts` - Authentication middleware (optional)

**Worker Functionality:**
- Accept POST /search requests with query, filters, workspace, mode, safety, modelRoute
- Call AI Search API with tenant filters for semantic retrieval
- Build context from retrieved chunks
- Call AI Gateway with appropriate headers (cf-ai-cache-ttl, cf-ai-safety-level, cf-ai-route-model)
- Handle retries with jitter on failures
- Fallback to Workers AI if upstream providers fail
- Return answer + sources with citations
- Add health check endpoint GET /health

**Environment Variables:**
- GATEWAY_TOKEN (secret via wrangler)
- GATEWAY_URL (from wrangler.toml)
- AI_SEARCH_PROJECT_ID (from wrangler.toml)
- ALLOWED_ORIGINS (CORS configuration)

### 4. AgentSet Tools Package
**Location:** `agentset-cloudflare-app/packages/agentset-tools/`

- Create `package.json` for @agentset-cf/tools
- `src/cloudflareSearchTool.ts` - Main export
- `src/types.ts` - TypeScript interfaces matching Worker API
- `src/client.ts` - HTTP client with retry logic
- Export typed search function for UI integration
- Add JSDoc documentation for all exports

**API:**
```typescript
export async function cloudflareSearch(options: SearchOptions): Promise<SearchResponse>

interface SearchOptions {
  query: string
  filters?: Record<string, any>
  workspaceId?: string
  mode?: 'public' | 'private'
  safety?: 'off' | 'standard' | 'strict'
  modelRoute?: 'final-answer' | 'fast-lane' | 'cheap'
  temperature?: number
  max_tokens?: number
}

interface SearchResponse {
  answer: string
  sources: Array<{
    idx: number
    score: number
    metadata: Record<string, any>
    preview: string
  }>
}
```

### 5. Infrastructure Setup
**Location:** `agentset-cloudflare-app/infra/`

- Create `terraform/` directory
- Add `main.tf` - R2 bucket configuration
- Add `variables.tf` - Input variables
- Add `outputs.tf` - Output values
- Add `provider.tf` - Cloudflare provider setup
- Create `README.md` - Infrastructure setup instructions

**R2 Configuration:**
- Create R2 bucket for document storage
- Set up lifecycle rules for data retention
- Configure CORS if needed for direct uploads

### 6. Operational Files
**Location:** `agentset-cloudflare-app/ops/`

**Directories:**
- `diagrams/` - Mermaid architecture diagrams
- `runbooks/` - Operational procedures
- `seeds/` - Sample data and configurations
- `postman/` - API collection for testing

**Files to Create:**
- `diagrams/architecture.mmd` - System architecture
- `diagrams/data-flow.mmd` - Data flow diagram
- `runbooks/onboarding.md` - Developer onboarding
- `runbooks/incident-response.md` - Incident handling
- `runbooks/release.md` - Release procedures
- `seeds/kv-workspace-defaults.json` - Default workspace configs
- `postman/agentset-cf-api.json` - Postman collection

### 7. GitHub Actions CI/CD
**Location:** `agentset-cloudflare-app/.github/workflows/`

**Workflows to Create:**
- `worker-deploy.yml` - Deploy Worker on merge to main
- `ui-ci.yml` - Build and test UI (when added)
- `lint.yml` - Lint all packages
- `test.yml` - Run test suites
- `release-please.yml` - Automated releases
- `codeql.yml` - Security scanning

**Worker Deploy Workflow:**
```yaml
name: Deploy Worker
on:
  push:
    branches: [main]
    paths:
      - 'apps/cf-worker/**'
      - 'packages/**'
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
      - run: pnpm install
      - run: pnpm --filter cf-worker build
      - run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

### 8. Testing Infrastructure
**Each Package:**
- Set up Vitest or Jest for unit testing
- Add integration tests for Worker endpoints
- Create test fixtures and mocks
- Add test scripts to package.json
- Configure coverage reporting

**Worker Tests:**
- `tests/handlers/search.test.ts` - Search endpoint tests
- `tests/services/aiSearch.test.ts` - AI Search service tests
- `tests/services/aiGateway.test.ts` - AI Gateway service tests
- `tests/utils/retry.test.ts` - Retry logic tests
- `tests/integration/e2e.test.ts` - End-to-end tests

### 9. Documentation Updates
- Add code examples to README
- Create API documentation
- Add troubleshooting guide
- Document local development setup
- Create example .env.example files

## Success Criteria
- ✅ `pnpm install` successfully installs all dependencies
- ✅ Worker builds without errors: `pnpm --filter cf-worker build`
- ✅ All tests pass: `pnpm test`
- ✅ Linting passes: `pnpm lint`
- ✅ Worker deploys to Cloudflare: `wrangler deploy`
- ✅ POST /search endpoint responds with valid data
- ✅ CI/CD workflows execute successfully
- ✅ TypeScript compilation succeeds across all packages

## Technical Requirements

### Dependencies
**Worker:**
- @cloudflare/workers-types
- hono or itty-router (lightweight routing)
- zod (runtime validation)

**Tools Package:**
- No runtime dependencies (keep it lightweight)
- Dev dependencies: typescript, vitest

**Config Package:**
- typescript
- eslint + @typescript-eslint/*
- prettier
- @types/node

### TypeScript Configuration
- Strict mode enabled
- Target: ES2022
- Module: ESNext
- moduleResolution: bundler

### Code Quality Standards
- All functions under 50 lines
- 100% TypeScript (no .js files)
- JSDoc comments on public APIs
- Error handling on all external calls
- Retry logic with exponential backoff

## Non-Functional Requirements
- Worker cold start < 50ms
- P95 latency < 150ms for cached queries
- Support for 1000+ req/sec
- Zero-downtime deployments
- Comprehensive error logging

## Security Considerations
- Never log sensitive data (tokens, user info)
- Validate all inputs with zod
- Implement rate limiting per workspace
- Use Cloudflare Guardrails for LLM safety
- Rotate secrets regularly
- CORS configured for specific origins only

## Phased Implementation Order

### Phase 1A: Foundation (Week 1)
1. Monorepo setup with pnpm workspaces
2. Config package with shared tooling
3. Basic Worker with hello world
4. GitHub Actions for linting

### Phase 1B: Core Worker (Week 2)
1. Worker routing and middleware
2. AI Search integration
3. AI Gateway integration
4. Request/response types
5. Unit tests

### Phase 1C: Tools & Integration (Week 3)
1. AgentSet tools package
2. Integration tests
3. Terraform for R2
4. Worker deployment CI/CD

### Phase 1D: Operations (Week 4)
1. Operational runbooks
2. Architecture diagrams
3. Monitoring setup
4. Documentation polish

---

## Phase 2: AgentSet Frontend Integration

**Critical Path**: Integrate AgentSet UI with Cloudflare Worker backend

**Repository**: Work happens in `agentset/` repository (cloned separately)

**Prerequisites**:
- Phase 1 complete (Cloudflare Worker deployed and accessible)
- AgentSet repository cloned locally
- Worker health endpoint returns 200

### 10. Package Integration to AgentSet Monorepo
**Location:** `agentset/packages/`

**Tasks:**

1. **Copy cloudflare-tools package**
   - Copy from `agentset-cloudflare-app/packages/agentset-tools/` to `agentset/packages/cloudflare-tools/`
   - Rename package to `@agentset/cloudflare-tools`
   - Add to `pnpm-workspace.yaml`
   - Update `package.json` with AgentSet catalog dependencies

2. **Create Cloudflare vector store adapter**
   - Create `agentset/packages/engine/src/vector-store/cloudflare/` directory
   - Implement `index.ts` - CloudflareVectorStore class implementing VectorStore interface
   - Implement `factory.ts` - createCloudflareVectorStore factory function
   - Implement `filter.ts` - Filter conversion utilities
   - Adapter calls cloudflare-tools client and converts response to unified QueryResult format

3. **Update engine index for Cloudflare support**
   - Modify `agentset/packages/engine/src/vector-store/index.ts`
   - Add import for createCloudflareVectorStore
   - Add check for `namespace.ragProvider === 'cloudflare'` in getNamespaceVectorStore()
   - Route to Cloudflare adapter when configured

**Validation:**
```bash
cd agentset
pnpm list @agentset/cloudflare-tools  # Should show the package
pnpm build  # Should compile without errors
```

### 11. Database Schema Updates
**Location:** `agentset/packages/db/prisma/schema.prisma`

**Tasks:**

1. **Add Cloudflare fields to Namespace model**
   - `ragProvider` String? @default("local") - 'local' | 'cloudflare'
   - `cfModelRoute` String? @default("final-answer") - 'final-answer' | 'fast-lane' | 'cheap'
   - `cfSafetyLevel` String? @default("standard") - 'off' | 'standard' | 'strict'
   - `cfCacheMode` String? @default("public") - 'public' | 'private'
   - `cfBudgetLimit` Float? @default(100.0) - USD per month
   - `cfSettings` Json? - Additional CF-specific settings (flexible)

2. **Create CloudflareMetric model**
   - Track query count, latency, cache hits/misses, cost, tokens
   - Fields: id, namespaceId, timestamp, queryCount, totalLatency, avgLatency
   - Fields: cacheHits, cacheMisses, cacheHitRate, totalCost, tokenCount
   - Fields: modelRoute, modelName
   - Indexes on namespaceId and timestamp

3. **Create and apply migration**
   ```bash
   cd agentset/packages/db
   pnpm db:migrate dev --name add_cloudflare_integration
   pnpm db:deploy
   pnpm db:generate
   ```

**Validation:**
```bash
pnpm db:studio  # Verify new fields in Namespace and new CloudflareMetric table
```

### 12. Backend tRPC API Implementation
**Location:** `agentset/apps/web/src/server/api/routers/`

**Tasks:**

1. **Create cloudflare router**
   - Create `cloudflare.ts` with tRPC procedures:
   - `getSettings` - Query Cloudflare settings for namespace
   - `updateSettings` - Mutate to update ragProvider, cfModelRoute, cfSafetyLevel, cfCacheMode, cfBudgetLimit
   - `getMetrics` - Query metrics with time range (1h, 24h, 7d, 30d) and aggregation
   - `testConnection` - Mutate to test Worker health endpoint
   - All procedures protected with authentication
   - All procedures validate namespace ownership

2. **Add cloudflare router to root**
   - Modify `root.ts` to import and export cloudflareRouter
   - Add to appRouter: `cloudflare: cloudflareRouter`

3. **Modify search router for dual-mode routing**
   - Modify `search.ts` to check RAG mode (global RAG_MODE env or per-namespace ragProvider)
   - If Cloudflare: Import cloudflare-tools client, call worker, convert response
   - Track metrics in CloudflareMetric table (queryCount, latency, cache, cost, tokens)
   - If error and ENABLE_LOCAL_FALLBACK=true: Fall back to local RAG
   - If local: Use existing Pinecone/Turbopuffer logic (unchanged)
   - All queries tracked with incrementSearchUsage()

**Helper Functions:**
```typescript
// In search.ts
const globalRagMode = process.env.RAG_MODE as 'local' | 'cloudflare' | 'hybrid' | undefined;
const useCloudflare =
  globalRagMode === 'cloudflare' ||
  (globalRagMode === 'hybrid' && namespace.ragProvider === 'cloudflare') ||
  namespace.ragProvider === 'cloudflare';
```

### 13. Frontend UI Components
**Location:** `agentset/apps/web/src/app/app.agentset.ai/(dashboard)/[slug]/[namespaceSlug]/`

**Tasks:**

1. **Update namespace settings page**
   - Modify `settings/page.tsx`
   - Add RAG Provider section with RadioGroup for local vs cloudflare
   - Show alert with link to Cloudflare settings when cloudflare selected
   - Use api.cloudflare.updateSettings mutation to save
   - Display current ragProvider from api.cloudflare.getSettings query

2. **Create Cloudflare settings page**
   - Create `cloudflare/page.tsx`
   - Implement tabs: General, Models, Safety, Caching, Budget
   - **General Tab**: Connection status, Worker endpoint, health check button
   - **Models Tab**: Model route selector (final-answer, fast-lane, cheap) with descriptions
   - **Safety Tab**: Safety level radio group (off, standard, strict)
   - **Caching Tab**: Cache mode toggle (public/private), cache TTL info
   - **Budget Tab**: Budget limit input, usage progress bar, auto-degradation toggle
   - All fields backed by api.cloudflare.updateSettings mutation
   - Show real-time settings from api.cloudflare.getSettings query

3. **Create metrics dashboard**
   - Create `metrics/page.tsx`
   - **KPI Cards**: Total queries, avg latency, cache hit rate, total cost
   - **Performance Chart**: Latency distribution over time
   - **Cost Breakdown**: Pie chart (LLM 70%, Search 20%, Worker 10%)
   - **Model Usage**: Bar chart showing distribution across model routes
   - **Error Logs**: Table of recent errors (planned for future)
   - Time range selector: 1h, 24h, 7d, 30d
   - Data from api.cloudflare.getMetrics query

4. **Update playground to show metadata**
   - Create `playground/components/QueryMetadata.tsx`
   - Display when search results include metadata from Cloudflare
   - Show: Provider (icon + name), Model name, Performance (cached badge + latency), Cost ($ + tokens)
   - Use Card with grid layout for metadata fields
   - Integrate into existing playground results display

### 14. Environment Configuration
**Location:** `agentset/.env` and `agentset/.env.example`

**Tasks:**

1. **Add Cloudflare environment variables**
   ```bash
   # RAG Mode: 'local' | 'cloudflare' | 'hybrid'
   RAG_MODE=hybrid

   # Cloudflare Worker Endpoint
   CF_SEARCH_ENDPOINT=https://agentset-ai-search.workers.dev

   # Cloudflare API Key (optional)
   CF_API_KEY=

   # Cloudflare Gateway Configuration
   CF_GATEWAY_URL=https://gateway.ai.cloudflare.com/v1/your-account/your-gateway/openai
   GATEWAY_TOKEN=

   # Feature Flags
   ENABLE_CLOUDFLARE_SEARCH=true
   ENABLE_LOCAL_FALLBACK=true
   ENABLE_CF_METRICS_DASHBOARD=true
   ```

2. **Update .env.example**
   - Copy all Cloudflare variables to example file
   - Add comments explaining each variable
   - Include example values

### 15. Testing Infrastructure
**Location:** `agentset/`

**Unit Tests:**
- `packages/cloudflare-tools/src/__tests__/cloudflareSearchTool.test.ts` - Test client methods
- `packages/cloudflare-tools/src/__tests__/types.test.ts` - Test type safety
- `packages/engine/src/vector-store/cloudflare/__tests__/index.test.ts` - Test adapter
- `packages/engine/src/vector-store/cloudflare/__tests__/factory.test.ts` - Test factory
- `packages/engine/src/vector-store/cloudflare/__tests__/filter.test.ts` - Test filters
- `apps/web/src/server/api/routers/__tests__/cloudflare.test.ts` - Test router
- `apps/web/src/server/api/routers/__tests__/search.cloudflare.test.ts` - Test routing

**Integration Tests:**
- `apps/web/src/__tests__/integration/cloudflare-search.test.ts` - End-to-end search flow
- `apps/web/src/__tests__/integration/cloudflare-settings.test.ts` - Settings persistence
- `apps/web/src/__tests__/integration/cloudflare-fallback.test.ts` - Fallback scenarios

**Manual Testing Checklist:**
- [ ] Health check endpoint accessible
- [ ] Can toggle RAG provider in settings
- [ ] Search queries route correctly based on settings
- [ ] Query metadata displays in playground
- [ ] Metrics dashboard shows data
- [ ] Cloudflare settings page works
- [ ] Cache hit/miss tracked correctly
- [ ] Cost tracking accurate
- [ ] Budget limits enforced
- [ ] Fallback to local works

### 16. Deployment & Rollout Strategy

**Staging Deployment:**
1. Deploy to staging environment
2. Enable for 1-2 test namespaces
3. Monitor for 48 hours
4. Validate metrics accuracy
5. Test fallback scenarios

**Production Rollout (Gradual):**
- **Week 1**: Enable for 5% of namespaces, monitor performance and costs
- **Week 2**: Increase to 25% if metrics are good, address any issues
- **Week 3**: Increase to 50%, continue monitoring
- **Week 4**: Full rollout to 100%, optional sunset of local RAG

**Rollback Plan:**
- Ability to revert RAG_MODE to 'local' globally
- Ability to toggle individual namespaces back to local
- Automated alerts on error rate spikes or cost overruns

### 17. Documentation for Frontend Integration

**Developer Documentation:**
- Update `agentset/README.md` with Cloudflare integration section
- Create `agentset/docs/cloudflare-integration.md` with setup instructions
- Document environment variables in detail
- Add troubleshooting guide for common issues

**User Documentation:**
- Create help docs for settings UI
- Explain model route choices (quality vs cost vs speed)
- Document safety levels and their impact
- Provide cost estimation guide

**API Documentation:**
- Document new tRPC procedures in cloudflare router
- Add examples for common operations
- Document metadata fields returned by Cloudflare queries

## Success Criteria (Complete)

**Phase 1 (Worker Backend):**
- ✅ `pnpm install` successfully installs all dependencies
- ✅ Worker builds without errors: `pnpm --filter cf-worker build`
- ✅ All tests pass: `pnpm test`
- ✅ Linting passes: `pnpm lint`
- ✅ Worker deploys to Cloudflare: `wrangler deploy`
- ✅ POST /search endpoint responds with valid data
- ✅ CI/CD workflows execute successfully
- ✅ TypeScript compilation succeeds across all packages

**Phase 2 (Frontend Integration):**
- ✅ All tests passing in AgentSet repository
- ✅ No TypeScript errors
- ✅ Cloudflare queries return < 2s average
- ✅ Cache hit rate > 30%
- ✅ Fallback to local works when Cloudflare fails
- ✅ Settings UI intuitive and responsive
- ✅ Query metadata displays correctly in playground
- ✅ Metrics dashboard shows accurate data
- ✅ No breaking changes to existing workflows
- ✅ 60% cost reduction vs local RAG achieved
- ✅ P95 latency < 150ms cached, < 2s uncached

## Time Estimates

**Phase 1 (Worker Backend) - 4 weeks:**
- Phase 1A: Foundation (1 week)
- Phase 1B: Core Worker (1 week)
- Phase 1C: Tools & Integration (1 week)
- Phase 1D: Operations (1 week)

**Phase 2 (Frontend Integration) - 5-6 weeks:**
- Package Integration (Week 1): 5-7 hours
- Database Schema (Week 1): 1-2 hours
- Backend API (Week 2): 7-9 hours
- Frontend UI (Weeks 2-3): 18-24 hours
- Environment Config (Week 3): 30 minutes
- Testing (Week 4): 18-22 hours
- Deployment & Rollout (Weeks 4-9): 4-5 weeks staged rollout

**Total: 9-10 weeks from start to full production rollout**

## Future Enhancements (Phase 3+)
- Website crawling support via AI Search
- Multi-model fallback chains through AI Gateway
- Custom Guardrail presets per namespace
- A/B testing framework for model routes
- Slack/webhook alerting for budget/errors
- Dynamic caching strategies based on usage patterns
- Grafana integration for advanced metrics
