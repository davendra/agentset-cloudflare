import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";

import { apiKeysRouter } from "./routers/api-keys";
import { billingRouter } from "./routers/billing";
import { cloudflareRouter } from "./routers/cloudflare";
import { documentsRouter } from "./routers/documents";
import { domainsRouter } from "./routers/domains";
import { hostingRouter } from "./routers/hosting";
import { ingestJobRouter } from "./routers/ingest-jobs";
import { namespaceRouter } from "./routers/namespaces";
import { organizationsRouter } from "./routers/organizations";
import { searchRouter } from "./routers/search";
import { uploadsRouter } from "./routers/uploads";

export const appRouter = createTRPCRouter({
  namespace: namespaceRouter,
  apiKey: apiKeysRouter,
  ingestJob: ingestJobRouter,
  document: documentsRouter,
  upload: uploadsRouter,
  billing: billingRouter,
  organization: organizationsRouter,
  hosting: hostingRouter,
  domain: domainsRouter,
  search: searchRouter,
  cloudflare: cloudflareRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
