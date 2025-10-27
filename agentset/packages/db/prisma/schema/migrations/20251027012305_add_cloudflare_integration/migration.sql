-- AlterTable
ALTER TABLE "public"."namespace" ADD COLUMN     "ragProvider" TEXT,
ADD COLUMN     "cfModelRoute" TEXT,
ADD COLUMN     "cfSafetyLevel" TEXT,
ADD COLUMN     "cfCacheMode" TEXT,
ADD COLUMN     "cfBudgetLimit" DOUBLE PRECISION,
ADD COLUMN     "cfSettings" JSONB;

-- CreateTable
CREATE TABLE "public"."cloudflare_metric" (
    "id" TEXT NOT NULL,
    "namespaceId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "queryCount" INTEGER NOT NULL DEFAULT 0,
    "avgLatencyMs" DOUBLE PRECISION,
    "p95LatencyMs" DOUBLE PRECISION,
    "p99LatencyMs" DOUBLE PRECISION,
    "cacheHits" INTEGER NOT NULL DEFAULT 0,
    "cacheMisses" INTEGER NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION,
    "totalTokens" INTEGER,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "modelUsage" JSONB,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "rateLimitHits" INTEGER NOT NULL DEFAULT 0,
    "workspaceId" TEXT,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cloudflare_metric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cloudflare_metric_namespaceId_timestamp_idx" ON "public"."cloudflare_metric"("namespaceId", "timestamp");

-- CreateIndex
CREATE INDEX "cloudflare_metric_timestamp_idx" ON "public"."cloudflare_metric"("timestamp");

-- CreateIndex
CREATE INDEX "cloudflare_metric_workspaceId_idx" ON "public"."cloudflare_metric"("workspaceId");

-- CreateIndex
CREATE INDEX "cloudflare_metric_tenantId_idx" ON "public"."cloudflare_metric"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "cloudflare_metric_namespaceId_timestamp_workspaceId_tenantId_key" ON "public"."cloudflare_metric"("namespaceId", "timestamp", "workspaceId", "tenantId");

-- AddForeignKey
ALTER TABLE "public"."cloudflare_metric" ADD CONSTRAINT "cloudflare_metric_namespaceId_fkey" FOREIGN KEY ("namespaceId") REFERENCES "public"."namespace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
