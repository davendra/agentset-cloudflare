import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { parse } from "@/lib/middleware/utils";
// import { getCache } from "@vercel/functions";
// import { getSessionCookie } from "better-auth/cookies";

// ⚠️ TEMPORARY: Prisma imports removed for Edge runtime compatibility
// TODO: Move database lookups to API routes or use Edge-compatible solution
// import type { Prisma } from "@agentset/db";
// import { db } from "@agentset/db";

import { HOSTING_PREFIX } from "../constants";
// import { getMiddlewareSession } from "./get-session";

// ⚠️ TEMPORARY: Stub for Edge runtime - hosting features disabled
// TODO: Implement Edge-compatible hosting lookup (Redis, KV, or API route)
// const getHosting = async (where: Prisma.HostingWhereInput) => {
//   return db.hosting.findFirst({
//     where,
//     select: {
//       id: true,
//       slug: true,
//       protected: true,
//       allowedEmailDomains: true,
//       allowedEmails: true,
//       namespaceId: true,
//     },
//   });
// };

// type Hosting = Awaited<ReturnType<typeof getHosting>>;

// const getCachedHosting = async (
//   filter: { key: string; where: Prisma.HostingWhereInput },
//   event: NextFetchEvent,
// ) => {
//   let hosting: Hosting = null;
//   const cache = getCache();
//   const cachedHosting = await cache.get(filter.key);

//   if (cachedHosting) return cachedHosting as unknown as Hosting;

//   hosting = await getHosting(filter.where);

//   // cache the hosting in background
//   if (hosting) {
//     event.waitUntil(
//       cache.set(filter.key, hosting, {
//         ttl: 3600, // 1 hour
//         tags: [`hosting:${hosting.id}`],
//       }),
//     );
//   }

//   return hosting;
// };

export default async function HostingMiddleware(
  req: NextRequest,
  event: NextFetchEvent,
  mode: "domain" | "path" = "domain",
) {
  // ⚠️ TEMPORARY: Edge-safe passthrough while we migrate hosting to Edge runtime
  // Custom domain hosting features are temporarily disabled
  //
  // FIXME: To re-enable hosting:
  // 1. Store hosting config in Redis/KV (Edge-compatible) instead of Prisma
  // 2. Or create an API route for hosting lookups that runs in Node runtime
  // 3. Call that API route from this middleware

  console.warn('[HOSTING MIDDLEWARE] Edge-safe mode: hosting features disabled');

  // For now, just pass through - this prevents 500 errors
  // The main app will still work, custom domains won't
  return NextResponse.next();
}
