import DashboardPageWrapper from "@/components/dashboard-page-wrapper";
import { constructMetadata } from "@/lib/metadata";

import NamespaceSettingsPage from "./page.client";

export const metadata = constructMetadata({ title: "Namespace Settings" });

export default function NamespaceSettings() {
  return (
    <DashboardPageWrapper title="Namespace Settings" requireNamespace>
      <NamespaceSettingsPage />
    </DashboardPageWrapper>
  );
}
