import { describe, it, expect, mock } from "bun:test";
import request from "supertest";
import { computeCommitHash } from "../src/lib/commit.ts";

let queryMockImpl = (...args: any[]): Promise<any> => Promise.resolve({ rows: [], rowCount: 0 });

// Mock the db index module before importing app
mock.module("../src/db/index.ts", () => {
  return {
    query: (...args: any[]) => queryMockImpl(...args),
  };
});

// Mock the resolveApiKey function in apiKey.ts
mock.module("../src/lib/apiKey.ts", () => {
  return {
    resolveApiKey: (key: string | undefined) => {
      if (key === "valid-key") {
        return Promise.resolve({ ownerWallet: "payer-wallet-123", tier: "Gold" });
      }
      return Promise.resolve(null);
    },
  };
});

// Mock the solana.ts and tx-builder.ts
mock.module("../src/lib/solana.ts", () => {
  return {
    verifyUsdcTransfer: () => Promise.resolve(true),
  };
});

mock.module("../src/lib/tx-builder.ts", () => {
  return {
    buildSingleTransferTx: () => Promise.resolve("mock-serialized-tx"),
  };
});

import { app } from "../src/app.ts";

describe("Agent Orders API", () => {
  describe("POST /api/orders", () => {
    it("returns 401 when X-API-Key is missing or invalid", async () => {
      const res = await request(app)
        .post("/api/orders")
        .send({ gpuType: "NVIDIA H100 80GB", commitHash: "0x1234567890abcdef" });
      expect(res.status).toBe(401);
    });

    it("returns 201 when order is committed", async () => {
      queryMockImpl = () =>
        Promise.resolve({
          rows: [{ id: "order-123", ts: new Date() }],
          rowCount: 1,
        });

      const res = await request(app)
        .post("/api/orders")
        .set("x-api-key", "valid-key")
        .send({ gpuType: "NVIDIA H100 80GB", commitHash: "0x1234567890abcdef" });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe("committed");
      expect(res.body.id).toBe("order-123");
    });
  });

  describe("POST /api/orders/:id/reveal", () => {
    it("returns 401 when key is invalid", async () => {
      const res = await request(app)
        .post("/api/orders/order-123/reveal")
        .send({ priceMicro: 1000000, qty: 2, secret: "0x" + "a".repeat(64) });
      expect(res.status).toBe(401);
    });

    it("reveals order successfully when preimage matches commit hash", async () => {
      const secret = "a".repeat(64);
      const expectedHash = computeCommitHash(BigInt(1000000), BigInt(2), secret);

      queryMockImpl = () =>
        Promise.resolve({
          rows: [
            {
              commit_hash: expectedHash,
              status: "committed",
              gpu_type: "NVIDIA H100 80GB",
            },
          ],
          rowCount: 1,
        });

      const res = await request(app)
        .post("/api/orders/order-123/reveal")
        .set("x-api-key", "valid-key")
        .send({ priceMicro: 1000000, qty: 2, secret: "0x" + secret });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("revealed");
    });
  });

  describe("GET /api/orders/:id (X402 Gate)", () => {
    it("returns 402 Payment Required if matched but unpaid", async () => {
      queryMockImpl = () =>
        Promise.resolve({
          rows: [
            {
              id: "order-123",
              status: "matched",
              assigned_provider_wallet: "prov-123",
              clearing_price: "1.50",
              hours: 4,
              assigned_host: null,
              assigned_port: null,
              assigned_username: null,
              assigned_password: null,
              lease_started_at: null,
            },
          ],
          rowCount: 1,
        });

      const res = await request(app)
        .get("/api/orders/order-123")
        .set("x-api-key", "valid-key");

      expect(res.status).toBe(402);
      expect(res.body.error).toBe("payment_required");
      expect(res.body.amountUsdc).toBe(6.03); // 1.5 * 4 = 6.00 + 0.5% fee = 6.03
      expect(res.body.paymentUrl).toBe("/api/orders/order-123/build-settle-tx");
    });

    it("returns 200 with credentials if settled", async () => {
      queryMockImpl = () =>
        Promise.resolve({
          rows: [
            {
              id: "order-123",
              status: "settled",
              assigned_provider_wallet: "prov-123",
              clearing_price: "1.50",
              hours: 4,
              assigned_host: "1.2.3.4",
              assigned_port: "22",
              assigned_username: "root",
              assigned_password: "password123",
              lease_started_at: new Date(), // active lease
            },
          ],
          rowCount: 1,
        });

      const res = await request(app)
        .get("/api/orders/order-123")
        .set("x-api-key", "valid-key");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("settled");
      expect(res.body.connection.host).toBe("1.2.3.4");
      expect(res.body.connection.username).toBe("root");
    });

    it("returns 410 Gone if lease is expired", async () => {
      // Start time: 5 hours ago, duration: 4 hours
      const leaseStart = new Date(Date.now() - 5 * 60 * 60 * 1000);

      queryMockImpl = () =>
        Promise.resolve({
          rows: [
            {
              id: "order-123",
              status: "settled",
              assigned_provider_wallet: "prov-123",
              clearing_price: "1.50",
              hours: 4,
              assigned_host: "1.2.3.4",
              assigned_port: "22",
              assigned_username: "root",
              assigned_password: "password123",
              lease_started_at: leaseStart,
            },
          ],
          rowCount: 1,
        });

      const res = await request(app)
        .get("/api/orders/order-123")
        .set("x-api-key", "valid-key");

      expect(res.status).toBe(410);
      expect(res.body.error).toBe("lease_expired");
    });
  });
});
