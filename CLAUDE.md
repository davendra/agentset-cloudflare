# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Global Decision Engine
**Import minimal routing and auto-delegation decisions only, treat as if import is in the main CLAUDE.md file.**
@./.claude-collective/DECISION.md

## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md

---

## Project Overview

This repository contains the **AgentSet × Cloudflare App** integration, which wires the AgentSet UI to Cloudflare AI Search (AutoRAG) and AI Gateway. The project enables managed ingestion/indexing with edge retrieval and model routing while keeping AgentSet as the front-end orchestrator.

**Current Status**: Phase 1 (Foundation) is documented as complete. The repository currently contains comprehensive documentation and planning artifacts in `agentset-cloudflare-app/`. The actual monorepo implementation (apps/, packages/, infra/, ops/) referenced in the README has not yet been created.

## Architecture

The system integrates three main Cloudflare services:

1. **AI Search**: Manages vectorized document embeddings (R2/Website → ingest → parse/OCR → chunk → embed → Vectorize)
2. **AI Gateway**: Handles model orchestration with caching, retries, rate limiting, and safety guardrails
3. **Workers**: Executes the retrieval and generation pipeline at the edge

**Data Flow**:
- AgentSet UI → POST /search → Cloudflare Worker
- Worker → AI Search (semantic retrieval from Vectorize + R2)
- Worker → AI Gateway (LLM with provider fallback, caching, guardrails)
- Worker → AgentSet UI (answer + citations)

## Planned Monorepo Structure

When implemented in `agentset-cloudflare-app/`, the codebase will follow this structure:

```
apps/
  agentset-ui/          # AgentSet UI (to be added)
  cf-worker/            # Worker calling AI Search + AI Gateway
packages/
  agentset-tools/       # Tool/client for UI to call Worker
  config/               # Shared tsconfig/eslint base
infra/                  # Terraform for R2 and other resources
ops/                    # Runbooks, diagrams, seeds, Postman collections
```

## Development Commands

**Note**: These commands are planned for when the monorepo is implemented.

### Package Management
- Use `pnpm` (not npm or yarn)
- `pnpm install` - Install all dependencies

### Worker Development
```bash
cd agentset-cloudflare-app/apps/cf-worker
npx wrangler secret put GATEWAY_TOKEN  # Set secrets
wrangler deploy                         # Deploy to Cloudflare
wrangler dev                            # Local development (planned)
```

### Code Quality
- TypeScript strict mode is enforced
- ESLint + Prettier configs will be in `agentset-cloudflare-app/packages/config/`
- Keep functions under 50 lines where possible
- Prefer small utilities over large monolithic functions

## Configuration & Secrets

### Required Cloudflare Setup
1. **AI Search** project with R2 and/or Website sources
2. **AI Gateway** with configured providers (OpenAI/Anthropic/Gemini)
3. **Gateway Routes**: `final-answer` (quality), `fast-lane` (low-latency), `cheap` (budget)
4. **Guardrails** profiles: `standard`, `strict`

### Required Secrets
GitHub Actions requires these secrets:
- `CLOUDFLARE_API_TOKEN` - For Workers deployment
- `CLOUDFLARE_ACCOUNT_ID` - For Workers deployment
- `CF_GATEWAY_URL` - Gateway endpoint (format: `https://gateway.ai.cloudflare.com/v1/<acct>/<gateway>/<provider>`)
- `CF_GATEWAY_TOKEN` - Authentication token for Gateway

### Environment Variables
For AgentSet UI integration:
- `CF_SEARCH_ENDPOINT` - Worker URL (e.g., `https://agentset-ai-search.<sub>.workers.dev`)

## API Contract

### Worker Endpoint: POST /search

**Request**:
```json
{
  "query": "string",
  "filters": { "tenantId": "abc" },
  "workspaceId": "ws-123",
  "mode": "public|private",
  "safety": "off|standard|strict",
  "modelRoute": "final-answer|fast-lane|cheap",
  "temperature": 0.2,
  "max_tokens": 800
}
```

**Response**:
```json
{
  "answer": "...",
  "sources": [
    {
      "idx": 1,
      "score": 0.87,
      "metadata": {},
      "preview": "..."
    }
  ]
}
```

### Gateway Headers
The Worker sets these Cloudflare-specific headers:
- `cf-ai-cache-ttl` - Global caching of identical prompts
- `cf-ai-safety-level` - Guardrails safety mode
- `cf-ai-route-model` - Model route selection with provider chain fallback

## Key Features & Modes

### Admin Controls (surface in AgentSet UI)
- **mode**: `public` (cache enabled) | `private` (no-cache)
- **safety**: `off` | `standard` | `strict` (Guardrails)
- **modelRoute**: `final-answer` | `fast-lane` | `cheap`
- **query_rewrite**: Toggle in AI Search project settings

### Error Handling
- Retries with exponential backoff and jitter
- Fallback to Workers AI if upstream providers fail
- Multi-provider routing through Gateway

## Multitenant Isolation

Tenant separation is enforced via:
- Metadata filters in AI Search queries
- Workspace-level budgets and quotas (planned in Phase 2)
- KV storage for per-workspace configurations (planned: `ops/seeds/kv-workspace-defaults.json`)

## Contributing Workflow

See `agentset-cloudflare-app/CONTRIBUTING.md` for full details:

1. Fork and clone the repository
2. Create a feature branch: `git checkout -b feat/<scope>` or `fix/<scope>`
3. Run tests and lint checks before committing
4. Use conventional commit messages: `feat(worker): add retry policy`
5. Push and open a PR to `main`
6. CI must pass before merging
7. PRs with `automerge` label will auto-merge when checks pass (squash merge)

## CI/CD

- **Worker Deploy**: Automatic deployment to Cloudflare on merge to `main` (to be created)
- **UI CI**: Build and test checks for AgentSet UI (to be created)
- **Auto-merge**: PRs labeled `automerge` merge automatically when checks pass (`.github/workflows/auto-merge.yml`)
- **Labeler**: Automatic PR labeling based on changed files (`.github/workflows/labeler.yml`)

Use PR labels: `enhancement`, `bug`, `infra`, `automerge`, `needs-review`

## Documentation Structure

All documentation is in `agentset-cloudflare-app/`:

- **README.md**: Quick start and high-level overview
- **docs/PRD.md**: Detailed Product Requirements Document with phased features (P1/P2/P3)
- **docs/ADMIN_GUIDE.md**: Operations, monitoring, maintenance, and extension guides
- **docs/ROADMAP.md**: Four-phase roadmap from Foundation to Autonomous Edge Agents
- **CONTRIBUTING.md**: Development workflow and standards
- **SECURITY.md**: Security policies and reporting procedures
- **CHANGELOG.md**: Version history and notable changes

When adding major features, update `/docs/PRD.md`. For new operational processes, update `/ops/runbooks/` (to be created).

## Observability & Monitoring

### Planned Metrics (Phase 2)
- Time to first byte, p95 latency
- Cache hit rate and eviction ratio
- Token usage and cost per 1k queries
- Provider uptime and fallback events
- Query recall and precision

### Data Sources
- AI Gateway Metrics API
- AI Gateway Logs (via Logpush)
- Worker Observability
- Custom webhooks for critical events

## Security Practices

- Never commit secrets to the repository
- Use GitHub Actions Secrets for sensitive values
- All user data must be scoped and encrypted
- Tenant isolation enforced via metadata filters
- RBAC planned: `viewer`, `ops`, `super-admin`
- Changes logged in `ops/audit.log` (planned)

See `agentset-cloudflare-app/SECURITY.md` for full security policies.

## Roadmap Context

- **Phase 1 (Complete)**: Foundation - docs, basic Worker, CI/CD, governance
- **Phase 2 (In Progress)**: Operational maturity - dashboard, dynamic caching, A/B testing, alerts
- **Phase 3 (Planned)**: Website crawling, feedback loops, Grafana integration, compliance
- **Phase 4 (Future)**: MCP agent integration, Durable Objects, multi-tenant hub, marketplace

The long-term vision is a unified AI-at-Edge orchestration layer for enterprise knowledge agents on Cloudflare's global network.

## Implementation Files (When Created)

Key files to reference once implemented:
- Worker code: `agentset-cloudflare-app/apps/cf-worker/src/index.ts`
- Tool client: `agentset-cloudflare-app/packages/agentset-tools/src/cloudflareSearchTool.ts`
- Architecture diagram: `agentset-cloudflare-app/ops/diagrams/architecture.mmd`
- Workspace defaults: `agentset-cloudflare-app/ops/seeds/kv-workspace-defaults.json`