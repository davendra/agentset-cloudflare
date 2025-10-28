import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";

// import ws from "ws";

import { PrismaClient } from "../generated/client";

const createPrismaClient = () => {
  const connectionString = process.env.DATABASE_URL ?? "";

  // For local PostgreSQL or Prisma Accelerate, use standard Prisma client without Neon adapter
  // Prisma Accelerate (prisma://) doesn't support driver adapters
  if (
    typeof WebSocket === "undefined" ||
    connectionString.includes("@localhost") ||
    connectionString.includes("@127.0.0.1") ||
    connectionString.startsWith("prisma://")
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
