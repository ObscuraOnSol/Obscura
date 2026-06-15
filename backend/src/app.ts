import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import helmet from "helmet";

import { env } from "./lib/env.ts";
import { sessionMiddleware } from "./lib/session.ts";
import { healthRouter } from "./routes/health.ts";
import { marketRouter } from "./routes/market.ts";
import { settlementsRouter } from "./routes/settlements.ts";
import { providersRouter } from "./routes/providers.ts";
import { ordersRouter } from "./routes/orders.ts";
import { sessionRouter } from "./routes/session.ts";
import { keysRouter } from "./routes/keys.ts";
import { authRouter } from "./routes/auth.ts";
import { alertsRouter } from "./routes/alerts.ts";
import { notificationsRouter } from "./routes/notifications.ts";
import { leaderboardRouter } from "./routes/leaderboard.ts";
import { swaggerHtml, swaggerSpec } from "./lib/swagger.ts";

/** Builds the Express app and wires routes. No server.listen here — see index.ts. */
export function createApp() {
  const app = createAppWithoutDocs();
  return app;
}

export function createAppWithoutDocs() {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );
  app.use(
    cors({
      // "*" allows any origin; otherwise only the configured allow-list.
      origin: env.corsOrigins.includes("*") ? "*" : env.corsOrigins,
    }),
  );
  app.use(express.json({ limit: "256kb" }));
  // Attaches req.sessionWallet when a valid SIWS Bearer token is present.
  app.use(sessionMiddleware);

  // Friendly index + top-level health check (handy as Render's Health Check Path).
  app.get("/", (_req, res) => {
    res.json({
      name: "Obscura API",
      status: "ok",
      health: "/health",
      docs: "/v1/agent/docs",
      docsJson: "/v1/agent/docs.json",
    });
  });
  app.get("/v1/agent/docs", (_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.send(swaggerHtml);
  });
  app.get("/v1/agent/docs.json", (_req, res) => {
    res.json(swaggerSpec);
  });
  app.get("/v1/agents/docs.json", (_req, res) => {
    res.json(swaggerSpec);
  });
  app.get("/v1/api/network", (_req, res) => {
    res.json({
      network: env.network,
    });
  });
  app.use(healthRouter); // GET /health

  // All public + agent APIs live under /api.
  app.use("/api", healthRouter);
  app.use("/api", marketRouter);
  app.use("/api", settlementsRouter);
  app.use("/api", providersRouter);
  app.use("/api", ordersRouter);
  app.use("/api", sessionRouter);
  app.use("/api", keysRouter);
  app.use("/api", authRouter);
  app.use("/api", alertsRouter);
  app.use("/api", notificationsRouter);
  app.use("/api", leaderboardRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  // Centralised error handler.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[error]", err);
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}

export const app = createApp();
