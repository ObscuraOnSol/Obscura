import "dotenv/config";

import { app } from "./app.ts";
import { env } from "./lib/env.ts";
import { migrate } from "./db/migrate.ts";
import { startMatchingEngine } from "./services/matching.ts";
import { startHealthChecker } from "./services/health.ts";
import { startEscrowManager } from "./services/escrow.ts";

import { initWebSocketServer } from "./services/websocket.ts";

async function main() {
  if (env.databaseUrl) {
    await migrate();
  } else {
    console.warn(
      "[startup] DATABASE_URL not set — skipping migrations. Read APIs will error until a database is configured.",
    );
  }

  const server = app.listen(env.port, () => {
    console.log(
      `[startup] Obscura backend listening on :${env.port} (${env.nodeEnv}) — batch interval ${env.matchingIntervalSeconds}s`,
    );
  });

  initWebSocketServer(server);


  // Start background engines
  if (env.databaseUrl) {
    startMatchingEngine();
    startHealthChecker();
    startEscrowManager();
  }
}

main().catch((err) => {
  console.error("[startup] fatal:", err);
  process.exit(1);
});
