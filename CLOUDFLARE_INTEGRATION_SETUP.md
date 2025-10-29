# Cloudflare Integration Setup Guide

This guide explains how to enable and configure the Cloudflare RAG integration in AgentSet.

## Quick Start

### 1. Environment Variables

Add these to your `.env` file (in the repository root):

```bash
# Cloudflare Worker Endpoint (Required for Cloudflare mode)
DEFAULT_CLOUDFLARE_ENDPOINT=https://agentset-ai-search.davendra.workers.dev

# Cloudflare API Key (Optional - for authenticated requests)
DEFAULT_CLOUDFLARE_API_KEY=your-api-key-here

# Cloudflare AI Gateway (Optional - for advanced features)
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token
```

### 2. Database Configuration

For each namespace that should use Cloudflare RAG, set the `ragProvider` field:

```sql
UPDATE namespace
SET
  ragProvider = 'cloudflare',
  cfModelRoute = 'fast-lane',      -- Options: 'final-answer', 'fast-lane', 'cheap'
  cfSafetyLevel = 'standard',      -- Options: 'off', 'standard', 'strict'
  cfCacheMode = 'public'           -- Options: 'public', 'private'
WHERE id = 'your-namespace-id';
```

Or via the Cloudflare Settings UI (coming soon):
- Navigate to: `/[orgSlug]/[namespaceSlug]/settings/cloudflare`
- Toggle "Enable Cloudflare RAG"
- Configure model route, safety level, and caching

### 3. Custom Worker Endpoint (Optional)

To use a different Worker endpoint per namespace, store it in `cfSettings`:

```sql
UPDATE namespace
SET cfSettings = '{
  "endpoint": "https://your-custom-worker.workers.dev",
  "apiKey": "your-custom-api-key"
}'::jsonb
WHERE id = 'your-namespace-id';
```

---

## How It Works

### Architecture Flow

```
User searches → /api/hosting-search → Check ragProvider
                                          ↓
                        ┌─────────────────┴─────────────────┐
                        ↓                                   ↓
              ragProvider === "cloudflare"     ragProvider === null/local
                        ↓                                   ↓
          CloudflareSearchTool                     agenticSearch
                        ↓                                   ↓
          Worker → AI Search + Gateway            Local Vector Store
                        ↓                                   ↓
          Returns { answer, sources }         Returns { queries, chunks }
                        ↓                                   ↓
                    Normalized Response Format
                        ↓
                    Display Results
```

### Automatic Fallback

If Cloudflare search fails (network error, Worker down, misconfiguration), the system automatically falls back to local RAG:

```typescript
try {
  // Try Cloudflare
  return cloudflareSearch();
} catch (error) {
  console.error("Cloudflare failed, using local RAG");
  // Fallback to local
  return localSearch();
}
```

---

## Configuration Options

### Model Routes

| Route | Provider | Use Case | Cost | Latency |
|-------|----------|----------|------|---------|
| `final-answer` | Claude 3.5 Sonnet | High-quality answers | $$$ | Medium |
| `fast-lane` | GPT-4o mini | Balanced speed/quality | $$ | Low |
| `cheap` | Workers AI Llama | Budget-conscious | $ | Very Low |

### Safety Levels

- **off**: No content filtering
- **standard**: Basic safety guardrails (recommended)
- **strict**: Enhanced content moderation

### Cache Modes

- **public**: Enables global caching (60% cost reduction, faster responses)
- **private**: No caching (for sensitive data)

---

## Testing

### 1. Test Worker Health

```bash
curl https://agentset-ai-search.davendra.workers.dev/health
```

Expected response: `200 OK`

### 2. Test Search Endpoint

```bash
curl -X POST https://agentset-ai-search.davendra.workers.dev/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "test query",
    "filters": {"namespaceId": "your-namespace-id"}
  }'
```

### 3. Test via AgentSet UI

1. Enable Cloudflare for a namespace (see step 2 above)
2. Navigate to the search page: `/[hostingId]/search`
3. Enter a search query
4. Check browser console for `[HOSTING-SEARCH] Using Cloudflare RAG` log
5. Verify results are returned

---

## Monitoring

### Console Logs

The system logs which RAG provider is being used:

```
[HOSTING-SEARCH] Using Cloudflare RAG
[HOSTING-SEARCH] Using Local RAG
[HOSTING-SEARCH] Cloudflare search failed, falling back to local RAG: Error message
```

### Metrics (Coming Soon)

- Query latency (p95, p99)
- Cache hit rate
- Cost per query
- Provider uptime
- Token usage

Access metrics at: `/[orgSlug]/[namespaceSlug]/settings/cloudflare/metrics`

---

## Troubleshooting

### Issue: "Cloudflare endpoint not configured"

**Solution:** Set `DEFAULT_CLOUDFLARE_ENDPOINT` in `.env`

### Issue: Searches always use local RAG

**Check:**
1. Is `ragProvider` set to `'cloudflare'` in the database?
2. Is `DEFAULT_CLOUDFLARE_ENDPOINT` defined in `.env`?
3. Is the Worker accessible? (Test with curl)
4. Check console logs for error messages

### Issue: Worker returns 404

**Solution:** Verify the Worker URL is correct and the Worker is deployed

### Issue: Slow responses

**Try:**
1. Switch to `fast-lane` or `cheap` model route
2. Enable `public` cache mode
3. Check Worker logs for bottlenecks

---

## Rollout Strategy

### Phase 1: Beta Testing (Current)

- Enable for 1-2 test namespaces
- Monitor logs and performance
- Gather user feedback

### Phase 2: Gradual Rollout

- Enable for 10-20% of namespaces
- Compare metrics vs local RAG
- Optimize configuration based on data

### Phase 3: Full Production

- Enable for all namespaces (optional)
- Maintain local RAG as fallback
- Continuous monitoring

---

## Security Notes

- **API Keys**: Store in environment variables, never commit to git
- **Tenant Isolation**: Enforced via `namespaceId` filters in Worker
- **Data Privacy**: Use `private` cache mode for sensitive workspaces
- **Authentication**: Optional API key validation at Worker level

---

## Cost Optimization

### Strategies

1. **Enable Caching**: 60% cost reduction for repeated queries
2. **Use `cheap` Route**: For non-critical searches
3. **Set Budget Limits**: Configure `cfBudgetLimit` per namespace
4. **Monitor Usage**: Track queries and tokens via metrics dashboard

### Example Costs (Estimated)

| Queries/Day | Model Route | With Cache | Monthly Cost |
|-------------|-------------|------------|--------------|
| 1,000 | fast-lane | Yes | $5-10 |
| 10,000 | fast-lane | Yes | $50-100 |
| 10,000 | cheap | Yes | $10-20 |
| 100,000 | fast-lane | Yes | $400-800 |

---

## Next Steps

1. ✅ Enable Cloudflare for test namespace
2. ⏳ Add UI toggle in settings (in progress)
3. ⏳ Implement metrics dashboard
4. ⏳ Add A/B testing capabilities
5. ⏳ Create admin controls for budget management

---

## Support

- **Issues**: Create a GitHub issue with logs and steps to reproduce
- **Questions**: Check the integration docs in `/docs/cloudflare-integration/`
- **Worker Code**: See `agentset-cloudflare-app/apps/cf-worker/`

---

Last Updated: 2025-10-29
