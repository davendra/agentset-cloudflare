import { randomBytes } from "crypto";
import fs from "fs";
import path from "path";
import pino from "pino";
import pretty from "pino-pretty";
import { GenericContainer, Network, Wait } from "testcontainers";

const logger = pino(pretty({ colorize: true }));

const env = {
  POSTGRES_DB: "public",
  POSTGRES_USER: "user",
  POSTGRES_PASSWORD: "password",
};

const DATA_DIR = "/data/postgres";

// Hold references for shutdown
let postgresContainer: any = null;
let supavisorContainer: any = null;
let network: any = null;

async function setup() {
  /**
   * Supabase's Supavisor, their Postgres connection pooler, operates WS proxy for use in edge functions, just like Neon does!
   * *And it's fully compatible with Neon's serverless driver!*
   *
   * AFAICT, there's no public example of operating this locally with the WS proxy.
   *
   * Adapt code for Postgres and Supavisor from this Docker Compose config:
   * https://github.com/supabase/storage/blob/master/.docker/docker-compose-infra.yml
   * Here's the Dockerfile for Supavisor:
   * https://github.com/supabase/supavisor/blob/main/Dockerfile
   *
   * In the future, we might be able to use Supabase CLI, but it still uses PgBouncer and not Supavisor.
   *
   * Here's how it works:
   * - Supavisor has a "metadata" database to track each tenant and their own remote database. We're just using a single Postgres instance
   *   for both this meta database and our tenant database.
   * - Use Supavisor's admin API to create a new tenant. This includes the credentials of the tenant's own Postgres database.
   * - Supavisor runs the WS proxy on `localhost:4000/v2`
   * - Supavisor connection string is "postgres://[PG_USER].[TENANT_ID]:[PG_PASSWORD]@localhost:5432/[PG_DATABASE]"
   * - Use Neon's serverless driver and Prisma's adapter to connect over WS
   */

  logger.info("Starting Postgres...");
  network = await new Network().start();

  // persistence
  const dataDir = path.join(__dirname, DATA_DIR);
  fs.mkdirSync(dataDir, { recursive: true });

  postgresContainer = await new GenericContainer("postgres")
    .withName("db") // Hostname in Docker network
    .withNetwork(network)
    .withCopyContentToContainer([
      {
        content: "CREATE SCHEMA IF NOT EXISTS _supavisor;",
        target: "/docker-entrypoint-initdb.d/init.sql",
      },
    ])
    .withEnvironment({ ...env, PGDATA: "/data/postgres" })
    .withHealthCheck({
      test: ["CMD-SHELL", "pg_isready -d postgres"],
      interval: 1000,
      timeout: 30000,
      retries: 20,
      startPeriod: 0,
    })
    .withBindMounts([
      {
        source: dataDir,
        target: "/data/postgres",
      },
    ])
    .withWaitStrategy(Wait.forHealthCheck())
    .start();

  logger.info("Started Postgres.");
  logger.info("Starting Supavisor...");

  const API_JWT_SECRET = "dev";
  const JWT =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQ1MTkyODI0LCJleHAiOjE5NjA3Njg4MjR9.M9jrxyvPLkUxWgOYSf5dNdJ8v_eRrq810ShFRT8N-6M";

  supavisorContainer = await new GenericContainer("supabase/supavisor:1.1.39")
    .withExposedPorts(
      // Tenant API and WS proxy
      {
        container: 4000,
        host: 4000,
      },
      // Direct pooled Postgres connections (for Prisma migrations, etc)
      {
        container: 5432,
        host: 5432,
      },
    )
    .withNetwork(network)
    .withEnvironment({
      PORT: "4000",
      PROXY_PORT_SESSION: "5432",
      PROXY_PORT_TRANSACTION: "6543",
      DATABASE_URL: `postgres://${env.POSTGRES_USER}:${env.POSTGRES_PASSWORD}@db:5432/${env.POSTGRES_DB}`,
      SECRET_KEY_BASE: randomBytes(64).toString("base64"),
      VAULT_ENC_KEY: "12345678901234567890123456789032",
      API_JWT_SECRET,
      REGION: "local",
      ERL_AFLAGS: " -proto_dist inet_tcp", // Defaults to inet6_tcp, fails without this. I suspect this changes it to IPv4 or something
    })
    .withLogConsumer((stream) => {
      stream.on("data", (line) => logger.info(line));
      stream.on("err", (line) => logger.error(line));
    })
    // .withWaitStrategy(Wait.forHttp("/api/health", 4000).forStatusCode(204))
    .withCommand(["/bin/sh", "-c", "/app/bin/migrate && /app/bin/server"])
    .start();

  logger.info("Started Supavisor.");
  logger.info("Configuring Supavisor tenant...");

  const TENANT_ID = "dev_tenant";
  const response = await fetch(
    `http://localhost:4000/api/tenants/${TENANT_ID}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${JWT}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tenant: {
          db_host: "db",
          db_port: 5432,
          db_database: "public",
          ip_version: "auto",
          require_user: true,
          upstream_ssl: false,
          enforce_ssl: false,
          users: [
            {
              db_user: env.POSTGRES_USER,
              db_password: env.POSTGRES_PASSWORD,
              mode_type: "transaction",
              pool_checkout_timeout: 10000,
              pool_size: 10,
            },
          ],
        },
      }),
    },
  );
  if (!response.ok) {
    throw new Error("Error creating Supavisor tenant");
  }

  logger.info("Configured Supavisor tenant.");
  logger.info("Supavisor is running at http://localhost:4000");

  await new Promise((resolve) => setTimeout(resolve, 1000));
  while (true) {}
}

// Shutdown hook
async function shutdown() {
  logger.error("Shutting down containers and network...");
  try {
    if (supavisorContainer) await supavisorContainer.stop();
  } catch (e) {
    logger.error({ err: e }, "Error stopping supavisor container");
  }
  try {
    if (postgresContainer) await postgresContainer.stop();
  } catch (e) {
    logger.error({ err: e }, "Error stopping postgres container");
  }
  try {
    if (network) await network.stop();
  } catch (e) {
    logger.error({ err: e }, "Error stopping network");
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

setup();
