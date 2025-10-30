# Cloudflare Integration Testing Guide

## ✅ Pre-Testing Verification

### Environment Configuration ✅
- [x] `DEFAULT_CLOUDFLARE_ENDPOINT` set in `.env`
- [x] `CF_SEARCH_ENDPOINT` set in `.env`
- [x] Both point to: `https://agentset-ai-search.davendra.workers.dev`
- [x] Dev server running on port 3000

### Code Implementation ✅
- [x] Hosting search route implements Cloudflare integration
- [x] Automatic fallback to local RAG on errors
- [x] Metrics collection implemented
- [x] Database schema includes `CloudflareMetric` table
- [x] Namespace schema includes Cloudflare fields:
  - `ragProvider`
  - `cfModelRoute`
  - `cfSafetyLevel`
  - `cfCacheMode`
  - `cfSettings`

## 🧪 Manual Testing Checklist

### Step 1: Test Namespace Routing Fix
**Goal:** Verify existing users are redirected correctly

1. Open browser at `http://localhost:3000`
2. Log out if currently logged in
3. Log back in with an existing user account
4. **Expected Result:** Redirected to `/{orgSlug}/{namespaceSlug}` automatically
5. **Success Check:** No "create organization" page for existing users

**Status:** ⏳ Requires manual browser testing

---

### Step 2: Enable Cloudflare for Test Namespace

**Option A: Via UI (Recommended)**

1. Navigate to: `http://localhost:3000/{orgSlug}/{namespaceSlug}/settings`
2. Find the "RAG Provider" section
3. Select "Cloudflare AI Search" from the dropdown
4. Click "Configure Cloudflare Settings" to customize (optional)
5. Save changes

**Option B: Via Database**

Run this SQL query in your database:

```sql
UPDATE namespace
SET
  ragProvider = 'cloudflare',
  cfModelRoute = 'fast-lane',
  cfSafetyLevel = 'standard',
  cfCacheMode = 'public'
WHERE id = 'your-test-namespace-id';
```

**Status:** ⏳ Requires manual configuration

---

### Step 3: Test Cloudflare Search Functionality

1. Navigate to: `http://localhost:3000/[hostingId]/search`
2. Enter a search query (e.g., "test query")
3. Open browser console (F12 → Console tab)

**Expected Console Logs:**
```
[HOSTING-SEARCH] Using Cloudflare RAG
```

**Expected Results:**
- Search results are returned
- Results include `_cloudflare: true` in metadata
- Response includes `_answer` field with generated answer
- Latency information in `_latency` field
- Cache status in `_cached` field

**Success Indicators:**
- ✅ Console shows "Using Cloudflare RAG"
- ✅ Search completes without errors
- ✅ Results contain Cloudflare metadata

**Status:** ⏳ Requires manual browser testing

---

### Step 4: Verify Metrics Collection

After running several searches, check the database:

```sql
SELECT
  namespaceId,
  timestamp,
  queryCount,
  avgLatencyMs,
  cacheHits,
  cacheMisses,
  totalTokens,
  errorCount
FROM cloudflare_metric
ORDER BY timestamp DESC
LIMIT 10;
```

**Expected Data:**
- Query counts recorded
- Latency measurements (avgLatencyMs, p95LatencyMs, p99LatencyMs)
- Cache hit/miss tracking
- Token usage (if available from Worker)
- Error counts (should be 0 for successful queries)

**Status:** ⏳ Requires searches to be performed first

---

### Step 5: Test Automatic Fallback

**Goal:** Verify that local RAG works when Cloudflare fails

1. Temporarily set an invalid endpoint in `.env`:
   ```
   DEFAULT_CLOUDFLARE_ENDPOINT=https://invalid-url.workers.dev
   ```

2. Restart the dev server:
   ```bash
   cd agentset
   # Kill existing server (Ctrl+C)
   pnpm run dev
   ```

3. Try a search on the hosted page

**Expected Console Logs:**
```
[HOSTING-SEARCH] Cloudflare search failed, falling back to local RAG: ...
[HOSTING-SEARCH] Using Local RAG
```

**Expected Result:**
- Search still works (using local RAG)
- No user-facing error
- Metrics recorded with errorCount = 1

4. **Restore correct endpoint after testing:**
   ```
   DEFAULT_CLOUDFLARE_ENDPOINT=https://agentset-ai-search.davendra.workers.dev
   ```

**Status:** ⏳ Requires manual testing with server restart

---

## 📊 Features Matrix

| Feature | Status | How to Use |
|---------|--------|-----------|
| Namespace Routing | ✅ Implemented | Automatic on login |
| Cloudflare RAG | ✅ Implemented | Enable in namespace settings |
| Local RAG | ✅ Implemented | Default (ragProvider = null) |
| Provider Toggle | ✅ Implemented | Settings → RAG Provider dropdown |
| Metrics Tracking | ✅ Implemented | Automatic (check database) |
| Auto Fallback | ✅ Implemented | Automatic on Cloudflare errors |
| Configuration UI | ⏳ Needs Verification | Settings → Cloudflare Settings |

## 🔍 Troubleshooting

### Issue: Console shows "Using Local RAG" instead of "Using Cloudflare RAG"

**Check:**
1. Is `DEFAULT_CLOUDFLARE_ENDPOINT` set in `.env`?
   ```bash
   grep DEFAULT_CLOUDFLARE_ENDPOINT agentset/.env
   ```

2. Is namespace.ragProvider set to 'cloudflare' in database?
   ```sql
   SELECT id, name, ragProvider FROM namespace WHERE ragProvider = 'cloudflare';
   ```

3. Is the Worker accessible?
   ```bash
   curl https://agentset-ai-search.davendra.workers.dev/health
   ```

---

### Issue: Search returns no results

**Check:**

1. Is the Worker returning data?
   ```bash
   curl -X POST https://agentset-ai-search.davendra.workers.dev/search \
     -H 'Content-Type: application/json' \
     -d '{"query": "test", "filters": {"namespaceId": "test"}}'
   ```

2. Check Worker logs in Cloudflare dashboard

3. Verify namespace has documents indexed

---

### Issue: Namespace redirect not working

**Check:**

1. Does the user have organizations?
   ```sql
   SELECT * FROM organization LIMIT 1;
   ```

2. Open browser console and look for errors during redirect

3. Check authentication status

---

## 🚀 Quick Start Testing Script

```bash
# 1. Verify environment
cd agentset
grep -E "CLOUDFLARE|CF_SEARCH" .env

# 2. Verify dev server is running
lsof -i :3000

# 3. Test Worker endpoint
curl https://agentset-ai-search.davendra.workers.dev/health

# 4. Check database for existing namespaces
# (requires database connection)
# Check for namespaces with Cloudflare enabled

# 5. Open application
open http://localhost:3000
```

## 📝 Testing Notes

### What's Already Verified ✅

1. **Code Implementation:**
   - [hosting-search/route.ts](agentset/apps/web/src/app/api/(internal-api)/hosting-search/route.ts:86-194) - Cloudflare integration logic
   - Automatic fallback mechanism
   - Metrics collection on success and error
   - Proper metadata handling

2. **Database Schema:**
   - `CloudflareMetric` model with all required fields
   - `Namespace` model with Cloudflare configuration fields
   - Cascade deletes configured

3. **Environment Variables:**
   - All required Cloudflare endpoints configured
   - R2 storage credentials present
   - Database connections configured

### What Needs Manual Testing ⏳

1. **User Experience:**
   - Login/logout flow
   - Namespace routing after authentication
   - Settings UI for enabling Cloudflare
   - Search results display

2. **Functionality:**
   - End-to-end search with Cloudflare
   - Fallback behavior on errors
   - Metrics appearing in database
   - Cache hit/miss tracking

3. **Edge Cases:**
   - Invalid Worker endpoint handling
   - Network timeout behavior
   - Malformed query handling

## 📚 Related Documentation

- [CLAUDE.md](CLAUDE.md) - Project overview and architecture
- [agentset/apps/web/src/app/api/(internal-api)/hosting-search/route.ts](agentset/apps/web/src/app/api/(internal-api)/hosting-search/route.ts) - Implementation code
- Database schema: `agentset/packages/db/prisma/schema/`

---

**Last Updated:** October 30, 2024
**Status:** Code verified, manual testing required
**Next Steps:** Perform manual browser testing following Steps 1-5
