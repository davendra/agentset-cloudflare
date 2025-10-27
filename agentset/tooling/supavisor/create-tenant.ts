async function createTenant() {
  const response = await fetch(
    `http://localhost:4000/api/tenants/${process.env.TENANT_ID}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${process.env.JWT}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tenant: {
          db_host: "db",
          db_port: 5432,
          db_database: process.env.POSTGRES_DB,
          ip_version: "auto",
          require_user: true,
          upstream_ssl: false,
          enforce_ssl: false,
          users: [
            {
              db_user: process.env.POSTGRES_USER,
              db_password: process.env.POSTGRES_PASSWORD,
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

  console.info("Configured Supavisor tenant.");
}

createTenant();
