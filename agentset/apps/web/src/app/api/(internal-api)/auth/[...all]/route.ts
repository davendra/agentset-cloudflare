import { NextRequest } from "next/server";
import { makeAuth } from "@/lib/auth";
import { HOSTING_PREFIX } from "@/lib/constants";
import { toNextJsHandler } from "better-auth/next-js";

// Force Node.js runtime for Prisma Client compatibility
export const runtime = 'nodejs';

export const { POST, GET } = toNextJsHandler(async (_req) => {
  try {
    const req = _req as NextRequest;

    const host = req.headers.get("host");
    // check if host is localhost
    const isLocalhost =
      host?.startsWith("localhost:") || host?.includes(".localhost:");
    const baseUrl = isLocalhost ? `http://${host}` : `https://${host}`;

    const searchParams = req.nextUrl.searchParams;
    const callbackURL = searchParams.get("callbackURL");
    const isHosting = callbackURL?.startsWith(HOSTING_PREFIX) ?? false;

    console.log('[AUTH ROUTE]', { baseUrl, isHosting, path: req.nextUrl.pathname });

    return await makeAuth({ baseUrl, isHosting }).handler(req);
  } catch (error) {
    console.error('[AUTH ROUTE ERROR]', error);
    // Return error details in development
    return new Response(
      JSON.stringify({
        error: 'Authentication error',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
