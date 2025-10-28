# Migrate from Trigger.dev to Cloudflare Workers + Queues

## Overview
Replace Trigger.dev background job processing with native Cloudflare infrastructure. This eliminates external dependencies and keeps everything on Cloudflare's edge network.

## Current Status
- Using Trigger.dev with placeholder key: `TRIGGER_SECRET_KEY="tr_placeholder"`
- 7 background job types + 1 cron job actively used
- Critical for: document ingestion, deletions, usage metering

## Architecture Changes

### Current (Trigger.dev):
```
Next.js App → tasks.trigger() → Trigger.dev API → Job Workers
                                                  → Cron Jobs
```

### Target (Cloudflare):
```
Next.js App → Queue Producer API → Cloudflare Queue → Consumer Worker → Job Handler
Next.js App → Direct Worker Call → Worker (for immediate jobs)
Cron Trigger → Scheduled Worker → Job Handler (for scheduled jobs)
```

## Job Inventory

### Background Jobs (7):
1. **trigger-ingestion-job** - Process uploaded documents
2. **delete-document-job** - Clean up deleted documents
3. **delete-ingest-job** - Remove ingestion jobs
4. **delete-namespace-job** - Delete namespace resources
5. **delete-organization-job** - Remove organization data
6. **meter-org-documents-job** - Track document usage (batch capable)
7. **re-ingest-job** - Re-process existing documents

### Scheduled Jobs (1):
1. **reset-usage** - Daily cron at noon UTC for billing cycle resets

## Phase 1: Infrastructure Setup (No Code Changes Yet)

**Goal**: Set up Cloudflare resources without breaking existing functionality

### Tasks:
1. **Create Cloudflare Queues** (one per job type):
   ```bash
   wrangler queues create agentset-ingest-queue
   wrangler queues create agentset-delete-document-queue
   wrangler queues create agentset-delete-ingest-job-queue
   wrangler queues create agentset-delete-namespace-queue
   wrangler queues create agentset-delete-org-queue
   wrangler queues create agentset-meter-docs-queue
   wrangler queues create agentset-re-ingest-queue
   ```

2. **Create Consumer Workers** for each queue
   - Each worker receives messages from its queue
   - Workers will contain the job execution logic
   - Can consolidate related jobs (e.g., all deletes in one worker)

3. **Create Cron Trigger Worker**
   - Scheduled to run daily at noon UTC
   - Handles usage reset logic from `packages/jobs/src/cron/usage.ts`

4. **Create Queue Producer Worker**
   - Provides HTTP API for Next.js app to enqueue jobs
   - Acts as queue gateway
   - Replaces `tasks.trigger()` calls

### Cloudflare Queue Features:
- Automatic retries with exponential backoff
- Dead letter queue for failed messages
- Batching support (for meter-org-documents)
- Per-queue concurrency controls
- Built-in monitoring and metrics

## Phase 2: Create Worker Implementations

**Goal**: Port job logic from packages/jobs to Cloudflare Workers

### Directory Structure:
```
apps/
  workers/
    queue-producer/        # HTTP API to enqueue jobs
      src/
        index.ts          # Queue producer endpoints
        schemas.ts        # Job schemas (port from packages/jobs/src/schema.ts)
      wrangler.toml

    ingest-consumer/       # Processes ingestion jobs
      src/
        index.ts          # Consumer + handler
        ingest.ts         # Port from packages/jobs/src/tasks/ingest.ts
        process-document.ts  # Port from packages/jobs/src/tasks/process-document.ts
      wrangler.toml

    delete-consumer/       # Handles all deletion jobs (consolidate 4 jobs)
      src/
        index.ts          # Consumer dispatcher
        delete-document.ts
        delete-ingest-job.ts
        delete-namespace.ts
        delete-org.ts
      wrangler.toml

    usage-cron/           # Scheduled usage reset
      src/
        index.ts          # Cron trigger + handler
        usage.ts          # Port from packages/jobs/src/cron/usage.ts
      wrangler.toml

    shared/               # Shared utilities across workers
      src/
        db.ts             # Prisma Edge client setup
        types.ts          # Common types
        config.ts         # Shared config
```

### Tasks:

#### 2.1 Queue Producer Worker
Create HTTP API that replaces `tasks.trigger()` calls:

```typescript
// apps/workers/queue-producer/src/index.ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // POST /trigger/ingest
    if (url.pathname === '/trigger/ingest') {
      const body = await request.json();
      await env.INGEST_QUEUE.send(body);
      return Response.json({ id: crypto.randomUUID() });
    }

    // ... other endpoints
  }
}
```

#### 2.2 Port Job Handlers
For each job in `packages/jobs/src/tasks/*.ts`:
1. Copy business logic to worker
2. Replace Node.js APIs with Worker-compatible alternatives
3. Use Prisma Edge client for database
4. Handle environment differences (no fs, no child_process, etc.)

**Key Adaptations**:
- Use `@prisma/adapter-pg` for Prisma Edge
- Replace Node.js streams with Web Streams API
- Use `fetch` instead of http/https modules
- No access to file system (use R2 instead)

#### 2.3 Cron Worker
```typescript
// apps/workers/usage-cron/wrangler.toml
[triggers]
crons = ["0 12 * * *"]  # Daily at noon UTC

// apps/workers/usage-cron/src/index.ts
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Port logic from packages/jobs/src/cron/usage.ts
  }
}
```

### Important: Prisma in Workers

Use Prisma with connection pooling for Workers:

```typescript
// apps/workers/shared/src/db.ts
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

export const createPrismaClient = (databaseUrl: string) => {
  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
};
```

## Phase 3: Add Queue Producer Client to Next.js

**Goal**: Create abstraction layer that can call either Trigger.dev OR Queue Producer

### Tasks:

#### 3.1 Create Queue Client Abstraction
```typescript
// packages/jobs/src/queue-client.ts
import { env } from './env';

type JobBody = {
  jobId: string;
  // ... other fields
};

export const triggerIngestionJob = async (
  body: JobBody,
  plan: string
): Promise<{ id: string }> => {
  if (env.USE_CLOUDFLARE_QUEUES) {
    // Call queue producer worker
    const response = await fetch(`${env.QUEUE_PRODUCER_URL}/trigger/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, plan }),
    });
    return response.json();
  } else {
    // Use existing Trigger.dev
    const { tasks } = await import('@trigger.dev/sdk');
    const handle = await tasks.trigger('trigger-ingestion-job', body, {
      tags: [`job_${body.jobId}`],
    });
    return { id: handle.id };
  }
};

// ... repeat for all 7 job types
```

#### 3.2 Add Environment Variables
```typescript
// packages/jobs/src/env.ts (or packages/engine/src/env.ts)
export const env = createEnv({
  server: {
    // Feature flag
    USE_CLOUDFLARE_QUEUES: z.boolean().default(false),

    // Queue producer URL (only needed if USE_CLOUDFLARE_QUEUES=true)
    QUEUE_PRODUCER_URL: z.url().optional(),

    // Keep Trigger for backward compatibility
    TRIGGER_SECRET_KEY: z.string().optional(),
  },
  runtimeEnv: {
    USE_CLOUDFLARE_QUEUES: process.env.USE_CLOUDFLARE_QUEUES === 'true',
    QUEUE_PRODUCER_URL: process.env.QUEUE_PRODUCER_URL,
    TRIGGER_SECRET_KEY: process.env.TRIGGER_SECRET_KEY,
  },
});
```

#### 3.3 Update All Trigger Calls
Replace all imports and calls:

```typescript
// Before:
import { triggerIngestionJob } from '@agentset/jobs';
const handle = await triggerIngestionJob({ jobId }, plan);

// After (same interface, different implementation):
import { triggerIngestionJob } from '@agentset/jobs/queue-client';
const handle = await triggerIngestionJob({ jobId }, plan);
```

**Files to update** (7 files found):
- `apps/web/src/services/ingest-jobs/create.ts`
- `apps/web/src/services/organizations/delete.ts`
- `apps/web/src/services/namespaces/delete.ts`
- `apps/web/src/services/ingest-jobs/delete.ts`
- `apps/web/src/services/documents/delete.ts`
- `apps/web/src/server/api/routers/ingest-jobs.ts`
- `apps/web/src/app/api/(public-api)/v1/namespace/[namespaceId]/ingest-jobs/[jobId]/re-ingest/route.ts`

## Phase 4: Testing & Validation

**Goal**: Verify both systems work in parallel

### Test Plan:

#### 4.1 Test with Trigger.dev (Baseline)
```bash
# Deploy with feature flag OFF
USE_CLOUDFLARE_QUEUES=false
TRIGGER_SECRET_KEY=<get-real-key-from-trigger.dev>
```

**Tests**:
- ✅ Upload document → Verify ingestion completes
- ✅ Delete document → Verify cleanup runs
- ✅ Delete namespace → Verify cascade delete
- ✅ Monitor Trigger.dev dashboard for jobs

#### 4.2 Test with Cloudflare Queues
```bash
# Deploy with feature flag ON
USE_CLOUDFLARE_QUEUES=true
QUEUE_PRODUCER_URL=https://queue-producer.your-account.workers.dev
```

**Tests**:
- ✅ Upload document → Check queue metrics
- ✅ Verify consumer worker processes job
- ✅ Check database for completed ingestion
- ✅ Test document deletion flow
- ✅ Verify cron runs at noon UTC
- ✅ Monitor Cloudflare dashboard (Queue depth, worker errors)

#### 4.3 Load Testing
```bash
# Test batch operations
curl -X POST /api/ingest-jobs \
  -d '{"payload": {"type": "BATCH", "items": [...]}}'

# Verify:
# - Queue handles 100+ messages
# - Workers scale automatically
# - No message loss
# - Dead letter queue catches failures
```

#### 4.4 Monitoring Setup
Add to Cloudflare Workers:
- **Queue metrics**: Depth, throughput, latency
- **Worker metrics**: Invocations, errors, duration
- **Alerts**: Queue depth > 1000, error rate > 5%

## Phase 5: Cutover & Cleanup

**Goal**: Fully migrate to Cloudflare, remove Trigger.dev

### Tasks:

#### 5.1 Production Cutover
```bash
# 1. Update production environment variables
vercel env add USE_CLOUDFLARE_QUEUES production
printf "true" | vercel env add USE_CLOUDFLARE_QUEUES production

printf "https://queue-producer.workers.dev" | vercel env add QUEUE_PRODUCER_URL production

# 2. Redeploy
vercel redeploy --target production

# 3. Monitor for 24-48 hours
# - Check queue depth stays healthy
# - Verify jobs complete successfully
# - Watch error rates
```

#### 5.2 Remove Trigger.dev Dependencies
Once stable for 48+ hours:

```bash
# Remove from package.json
pnpm remove @trigger.dev/sdk @trigger.dev/build trigger.dev

# Delete files
rm -rf packages/jobs/trigger.config.ts
rm -rf packages/jobs/src/tasks/  # After porting to workers
rm -rf packages/jobs/src/cron/   # After porting to workers

# Remove from env
vercel env rm TRIGGER_SECRET_KEY production
```

#### 5.3 Update Configuration Files
```diff
// turbo.json
"globalEnv": [
-  "TRIGGER_SECRET_KEY",
+  "USE_CLOUDFLARE_QUEUES",
+  "QUEUE_PRODUCER_URL",
]

// .env.example
-TRIGGER_SECRET_KEY=tr_placeholder
+USE_CLOUDFLARE_QUEUES=true
+QUEUE_PRODUCER_URL=https://queue-producer.workers.dev
```

#### 5.4 Update Documentation
- README: Update background jobs section
- Architecture docs: Reflect Cloudflare Queues
- Deployment guide: Add worker deployment steps

## Cost Comparison

### Trigger.dev Pricing:
| Tier | Price | Task Runs/mo |
|------|-------|--------------|
| Free | $0 | 100 |
| Starter | $20/mo | 500 |
| Pro | $99/mo | 2,000 |

### Cloudflare Pricing:
| Service | Free Tier | Paid Rate |
|---------|-----------|-----------|
| Queues | 1M operations/mo | $0.40/M operations |
| Workers | 100K requests/day | $0.30/M requests |
| Cron Triggers | Unlimited | Free |

**Estimated Monthly Cost** (assuming 10K jobs/month):
- Trigger.dev: $20-99/mo
- Cloudflare: ~$0.50/mo (essentially free)

**Savings**: ~$20-99/month + better performance at edge

## Risks & Mitigations

### Risk 1: Workers have 30-second CPU time limit
**Impact**: Long-running jobs might timeout

**Mitigations**:
- Break jobs into smaller chunks
- Use Durable Objects for long-running state
- Most jobs (document ingestion) complete in <10s

### Risk 2: Different runtime environment
**Impact**: Node.js-specific code won't work

**Mitigations**:
- Use Prisma Edge client (already supported)
- Replace Node.js APIs with Web APIs
- Test thoroughly in Workers environment
- Most code is database logic (portable)

### Risk 3: Queue batching behavior differs
**Impact**: `tasks.batchTrigger()` has different semantics

**Mitigations**:
- Test batch operations explicitly
- Cloudflare Queues support batching natively
- Adjust batch sizes if needed

### Risk 4: No direct access to filesystem
**Impact**: Can't write temporary files

**Mitigations**:
- Use R2 for file storage (already configured)
- Stream processing instead of file-based
- In-memory processing for small files

### Risk 5: Cold starts on Workers
**Impact**: First request after idle may be slow

**Mitigations**:
- Workers warm up very quickly (<5ms typically)
- Use Smart Placement to reduce latency
- Much faster than Trigger.dev anyway

## Rollback Plan

If issues arise after cutover:

```bash
# 1. Revert to Trigger.dev
printf "false" | vercel env add USE_CLOUDFLARE_QUEUES production

# 2. Redeploy
vercel redeploy --target production

# 3. Fix issues, test in staging, retry
```

The abstraction layer ensures zero-downtime rollback capability.

## Timeline Estimate

| Phase | Duration | Tasks |
|-------|----------|-------|
| Phase 1: Infrastructure | 1-2 days | Create queues, workers |
| Phase 2: Port Jobs | 3-5 days | 7 jobs + 1 cron |
| Phase 3: Abstraction | 1-2 days | Queue client |
| Phase 4: Testing | 2-3 days | Parallel testing |
| Phase 5: Cutover | 1 day | Production migration |
| **Total** | **8-13 days** | **Full migration** |

### Quick Win Option:
**Start with just ingestion job** (most critical):
- Phase 1-2 for ingest only: 2-3 days
- Test in production with feature flag
- Keep other jobs on Trigger.dev temporarily
- Migrate remaining jobs incrementally

## Implementation Checklist

### Phase 1: Setup
- [ ] Create 7 Cloudflare Queues
- [ ] Create queue-producer worker
- [ ] Create ingest-consumer worker
- [ ] Create delete-consumer worker
- [ ] Create usage-cron worker
- [ ] Configure queue bindings in wrangler.toml
- [ ] Deploy all workers to Cloudflare

### Phase 2: Port Logic
- [ ] Port ingest.ts to ingest-consumer
- [ ] Port process-document.ts to ingest-consumer
- [ ] Port delete-document.ts to delete-consumer
- [ ] Port delete-ingest-job.ts to delete-consumer
- [ ] Port delete-namespace.ts to delete-consumer
- [ ] Port delete-org.ts to delete-consumer
- [ ] Port re-ingest.ts to re-ingest-consumer
- [ ] Port usage.ts to usage-cron
- [ ] Set up Prisma Edge client in shared/db.ts

### Phase 3: Integration
- [ ] Create packages/jobs/src/queue-client.ts
- [ ] Add USE_CLOUDFLARE_QUEUES env var
- [ ] Add QUEUE_PRODUCER_URL env var
- [ ] Update 7 trigger call sites to use queue-client
- [ ] Test locally with feature flag OFF
- [ ] Test locally with feature flag ON

### Phase 4: Testing
- [ ] Deploy to staging with Trigger.dev
- [ ] Run baseline tests
- [ ] Deploy to staging with Cloudflare Queues
- [ ] Run comparison tests
- [ ] Load test with 100+ concurrent jobs
- [ ] Verify cron runs on schedule
- [ ] Monitor metrics for 24 hours

### Phase 5: Production
- [ ] Deploy to production with feature flag OFF
- [ ] Flip feature flag to ON
- [ ] Monitor for 48 hours
- [ ] Remove Trigger.dev dependencies
- [ ] Update documentation
- [ ] Delete Trigger.dev account

## Next Steps

When ready to implement:

1. **Review this plan** with team
2. **Set up Cloudflare account** with Workers/Queues enabled
3. **Create staging environment** for testing
4. **Start with Phase 1** (infrastructure only)
5. **Test incrementally** (don't migrate everything at once)

---

**Document Created**: 2025-10-28
**Status**: Planning Phase
**Owner**: TBD
**Priority**: Medium (not blocking, but removes external dependency)
