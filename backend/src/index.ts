import "dotenv/config";

import { app } from "./app.ts";
import { env } from "./lib/env.ts";
import { migrate } from "./db/migrate.ts";

async function main() {
  if (env.databaseUrl) {
    await migrate();
  } else {
    console.warn(
      "[startup] DATABASE_URL not set — skipping migrations. Read APIs will error until a database is configured.",
    );
  }

  app.listen(env.port, () => {
    console.log(
      `[startup] Obscura backend listening on :${env.port} (${env.nodeEnv}) — batch interval ${env.matchingIntervalSeconds}s`,
    );
  });
}

main().catch((err) => {
  console.error("[startup] fatal:", err);
  process.exit(1);
});
