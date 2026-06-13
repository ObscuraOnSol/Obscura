import "dotenv/config";

import { app } from "./app.ts";
import { env } from "./lib/env.ts";
import { migrate } from "./db/migrate.ts";
import { startMatchingEngine } from "./services/matching.ts";

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

  // The matching engine runs the batch auction on an interval.
  if (env.databaseUrl) startMatchingEngine();
}

main().catch((err) => {
  console.error("[startup] fatal:", err);
  process.exit(1);
});
