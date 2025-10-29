import { NextResponse } from "next/server";
import { db } from "@agentset/db";

// Force Node.js runtime for Prisma Client compatibility
export const runtime = 'nodejs';

export async function GET() {
  try {
    console.log('[HEALTH CHECK] Starting health check...');

    // Test database connection
    console.log('[HEALTH CHECK] Testing database connection...');
    await db.$connect();
    console.log('[HEALTH CHECK] Database connected successfully');

    // Test simple query
    console.log('[HEALTH CHECK] Running test query...');
    const userCount = await db.user.count();
    console.log('[HEALTH CHECK] Query successful, user count:', userCount);

    await db.$disconnect();

    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      userCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[HEALTH CHECK ERROR]', error);
    console.error('[HEALTH CHECK ERROR TYPE]', typeof error);
    console.error('[HEALTH CHECK ERROR CONSTRUCTOR]', error?.constructor?.name);

    // Serialize the full error object
    const errorDetails = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
      type: typeof error,
      constructor: error?.constructor?.name,
      stringified: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      raw: String(error),
    };

    console.error('[HEALTH CHECK ERROR DETAILS]', errorDetails);

    return NextResponse.json(
      {
        status: 'unhealthy',
        error: errorDetails,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
