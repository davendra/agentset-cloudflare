import DashboardPageWrapper from "@/components/dashboard-page-wrapper";
import { constructMetadata } from "@/lib/metadata";

import CloudflareMetricsPage from "./page.client";

export const metadata = constructMetadata({
  title: "Cloudflare Metrics",
});

export default function CloudflareMetrics() {
  return (
    <DashboardPageWrapper title="Cloudflare Metrics" requireNamespace>
      <CloudflareMetricsPage />
    </DashboardPageWrapper>
  );
}
