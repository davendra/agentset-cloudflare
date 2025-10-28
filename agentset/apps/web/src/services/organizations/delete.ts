import { db, OrganizationStatus } from "@agentset/db";
import { triggerDeleteOrganization } from "@agentset/jobs";

export async function deleteOrganization({
  organizationId,
}: {
  organizationId: string;
}) {
  await db.organization.update({
    where: {
      id: organizationId,
    },
    data: {
      status: OrganizationStatus.DELETING,
    },
  });

  await triggerDeleteOrganization({
    organizationId,
  });
}
