import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { parse } from "@/lib/middleware/utils";
import { getSessionCookie } from "better-auth/cookies";

// TEMPORARY: Commented out to avoid Prisma edge runtime issues
// TODO: Re-enable with Prisma Accelerate or Driver Adapters for production
// import { db } from "@agentset/db";

import { HOSTING_PREFIX } from "../constants";
import { getMiddlewareSession } from "./get-session";
import HostingMiddleware from "./hosting";

export default async function AppMiddleware(
  req: NextRequest,
  event: NextFetchEvent,
) {
  const { path, fullPath } = parse(req);

  console.log('[APP MIDDLEWARE DEBUG]', {
    path,
    fullPath,
    startsWithHostingPrefix: path.startsWith(HOSTING_PREFIX),
    HOSTING_PREFIX,
  });

  if (path.startsWith(HOSTING_PREFIX)) {
    console.log('[APP MIDDLEWARE] Routing to HostingMiddleware');
    return HostingMiddleware(req, event, "path");
  }

  const sessionCookie = getSessionCookie(req);
  console.log('[APP MIDDLEWARE DEBUG]', {
    hasSessionCookie: !!sessionCookie,
    path,
    shouldRedirectToLogin: !sessionCookie && !(path.startsWith("/login") || path.startsWith("/invitation")),
  });

  // if the user is not logged in, and is trying to access a dashboard page, redirect to login
  if (
    !sessionCookie &&
    !(path.startsWith("/login") || path.startsWith("/invitation"))
  ) {
    console.log('[APP MIDDLEWARE] Redirecting to /login');
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (sessionCookie) {
    // if the user is logged in, and is trying to access the login page, redirect to dashboard
    if (path.startsWith("/login")) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // redirect to the default org
    // TEMPORARY: Disabled for development to avoid Prisma edge runtime issues
    // TODO: Re-enable with Prisma Accelerate or Driver Adapters for production
    if (path === "/") {
      // Skip organization redirect in dev mode - just rewrite to app
      // Users can manually navigate to /<org-slug> after login
      return NextResponse.rewrite(new URL(`/app.agentset.ai${fullPath}`, req.url));

      /* Original code - re-enable for production:
      const session = await getMiddlewareSession(req);
      if (!session) {
        return NextResponse.redirect(new URL("/login", req.url));
      }

      const org = await db.organization.findFirst({
        where: session.session.activeOrganizationId
          ? {
              id: session.session.activeOrganizationId,
            }
          : {
              members: {
                some: {
                  userId: session.user.id,
                },
              },
            },
        select: {
          slug: true,
        },
      });

      if (org) return NextResponse.redirect(new URL(`/${org.slug}`, req.url));
      return NextResponse.redirect(new URL("/create-organization", req.url));
      */
    }
  }

  // Only rewrite to /app if the path is for login or invitation (which need the app.agentset.ai namespace)
  // For logged-in users with session cookies
  return NextResponse.rewrite(new URL(`/app.agentset.ai${fullPath}`, req.url));
}
