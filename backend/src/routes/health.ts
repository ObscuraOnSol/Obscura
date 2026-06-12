import { Router } from "express";

import { env } from "../lib/env.ts";

export const healthRouter = Router();

// GET /api/health — liveness. Intentionally does not touch the database.
healthRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: env.version,
  });
});
