import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import helmet from "helmet";

import { env } from "./lib/env.ts";
import { healthRouter } from "./routes/health.ts";
import { marketRouter } from "./routes/market.ts";
import { settlementsRouter } from "./routes/settlements.ts";
import { providersRouter } from "./routes/providers.ts";
import { ordersRouter } from "./routes/orders.ts";
import { sessionRouter } from "./routes/session.ts";
import { authRouter } from "./routes/auth.ts";

/** Builds the Express app and wires routes. No server.listen here — see index.ts. */
export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      // "*" allows any origin; otherwise only the configured allow-list.
      origin: env.corsOrigins.includes("*") ? "*" : env.corsOrigins,
    }),
  );
  app.use(express.json({ limit: "256kb" }));

  // Friendly index + top-level health check (handy as Render's Health Check Path).
  app.get("/", (_req, res) => {
    res.json({ name: "Obscura API", status: "ok", health: "/health" });
  });
  app.use(healthRouter); // GET /health

  // All public + agent APIs live under /api.
  app.use("/api", healthRouter);
  app.use("/api", marketRouter);
  app.use("/api", settlementsRouter);
  app.use("/api", providersRouter);
  app.use("/api", ordersRouter);
  app.use("/api", sessionRouter);
  app.use("/api", authRouter);

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
