import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";

// import ws from "ws";

import { PrismaClient } from "../generated/client";

const createPrismaClient = () => {
  const connectionString = process.env.DATABASE_URL;

  // Skip Neon adapter for:
  // 1. No DATABASE_URL (build time / missing env var)
  // 2. Prisma Accelerate URLs (prisma:// or prisma+)
  // 3. Local PostgreSQL (@localhost or @127.0.0.1)
  // 4. No WebSocket (Node.js without polyfill)
  // 5. Supabase direct connections (port 5432, not pooler)
  // Prisma Accelerate doesn't support driver adapters
  // Neon adapter requires WebSocket support - Supabase direct connections don't support this
  if (
    !connectionString ||
    typeof WebSocket === "undefined" ||
    connectionString.includes("@localhost") ||
    connectionString.includes("@127.0.0.1") ||
    connectionString.startsWith("prisma://") ||
    connectionString.startsWith("prisma+") ||
    (connectionString.includes("supabase.co") && connectionString.includes(":5432"))
  ) {
    return new PrismaClient({
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error"],
    });
  }

  // Supabase pooled connection string (must use Supavisor)
  // Only Neon hosts support this -- non-deterministic errors otherwise
  neonConfig.pipelineConnect = false;

  // So it can also work in Node.js
  neonConfig.webSocketConstructor = WebSocket;

  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
};

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
