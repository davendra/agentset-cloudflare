import DashboardPageWrapper from "@/components/dashboard-page-wrapper";
import { constructMetadata } from "@/lib/metadata";

import CloudflareSettingsPage from "./page.client";

export const metadata = constructMetadata({
  title: "Cloudflare Settings",
});

export default function CloudflareSettings() {
  return (
    <DashboardPageWrapper title="Cloudflare Settings" requireNamespace>
      <CloudflareSettingsPage />
    </DashboardPageWrapper>
  );
}
