-- AlterTable
ALTER TABLE "public"."organization" ALTER COLUMN "plan" SET DEFAULT 'pro';

-- RenameIndex
ALTER INDEX "public"."cloudflare_metric_namespaceId_timestamp_workspaceId_tenantId_ke" RENAME TO "cloudflare_metric_namespaceId_timestamp_workspaceId_tenantI_key";
