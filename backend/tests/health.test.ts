import { describe, it, expect } from "bun:test";
import request from "supertest";

import { app } from "../src/app.ts";

describe("GET /api/health", () => {
  it("returns 200 with status ok and a valid ISO timestamp", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.version).toBe("string");

    // timestamp must round-trip as a valid ISO date
    const parsed = new Date(res.body.timestamp);
    expect(Number.isNaN(parsed.getTime())).toBe(false);
    expect(parsed.toISOString()).toBe(res.body.timestamp);
  });

  it("exposes a top-level /health for platform health checks", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("serves a friendly root index", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.health).toBe("/health");
  });

  it("returns 404 json for unknown routes", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("not_found");
  });
});
