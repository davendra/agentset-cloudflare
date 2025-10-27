import { db } from "@agentset/db";

export const createNamespace = async ({
  name,
  organizationId,
  slug,
}: {
  name: string;
  slug: string;
  organizationId: string;
}) => {
  const namespace = await db.namespace.create({
    data: { name, slug, organizationId },
  });

  return namespace;
};
