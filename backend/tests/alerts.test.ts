import { describe, it, expect, mock, beforeEach } from "bun:test";
import request from "supertest";

let queryMockImpl = (...args: any[]): Promise<any> => Promise.resolve({ rows: [], rowCount: 0 });
let broadcastMock = mock((type: string, data: any) => {});

// Mock the db index module before importing app
mock.module("../src/db/index.ts", () => {
  return {
    query: (...args: any[]) => queryMockImpl(...args),
    pool: {
      query: (...args: any[]) => queryMockImpl(...args),
    }
  };
});

// Mock the websocket broadcast
mock.module("../src/services/websocket.ts", () => {
  return {
    broadcast: broadcastMock,
  };
});

import { app } from "../src/app.ts";
import { checkPriceAlerts } from "../src/services/alerts.ts";

describe("Price Alerts API", () => {
  beforeEach(() => {
    broadcastMock.mockClear();
    queryMockImpl = (...args: any[]): Promise<any> => Promise.resolve({ rows: [], rowCount: 0 });
  });

  describe("POST /api/session/price-alerts", () => {
    it("returns 400 when validation fails", async () => {
      const res = await request(app)
        .post("/api/session/price-alerts")
        .send({ gpuType: "", targetPrice: -5 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("validation_failed");
    });

    it("returns 401 when wallet/session is missing", async () => {
      const res = await request(app)
        .post("/api/session/price-alerts")
        .send({ gpuType: "H100", targetPrice: 2.50 });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("unauthorized");
    });

    it("returns 201 and creates the alert successfully when validated", async () => {
      const mockAlert = {
        id: "alert-uuid-123",
        wallet: "4RWwwY8LowKYSrzE9t8Z5Tn15rLH6D1Uz1z5NvxHzPj6",
        gpu_type: "H100",
        target_price: "2.500000",
        network: "devnet",
        is_triggered: false,
        created_at: new Date().toISOString(),
      };

      queryMockImpl = (text: string, params: any[]) => {
        if (text.includes("INSERT INTO price_alerts")) {
          return Promise.resolve({
            rows: [mockAlert],
            rowCount: 1,
          });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      };

      const res = await request(app)
        .post("/api/session/price-alerts")
        .send({
          wallet: "4RWwwY8LowKYSrzE9t8Z5Tn15rLH6D1Uz1z5NvxHzPj6",
          gpuType: "H100",
          targetPrice: 2.50,
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe("alert-uuid-123");
      expect(res.body.gpuType).toBe("H100");
      expect(res.body.targetPrice).toBe(2.50);
      expect(res.body.isTriggered).toBe(false);
    });
  });

  describe("GET /api/session/price-alerts", () => {
    it("returns 400 when query wallet is missing", async () => {
      const res = await request(app).get("/api/session/price-alerts");
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("valid ?wallet= or session required");
    });

    it("returns the list of alerts for a wallet", async () => {
      const mockAlerts = [
        {
          id: "alert-1",
          gpu_type: "H100",
          target_price: "2.500000",
          network: "devnet",
          is_triggered: false,
          triggered_at: null,
          created_at: new Date().toISOString(),
        },
        {
          id: "alert-2",
          gpu_type: "A100",
          target_price: "1.200000",
          network: "devnet",
          is_triggered: true,
          triggered_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        }
      ];

      queryMockImpl = (text: string, params: any[]) => {
        if (text.includes("SELECT id, gpu_type")) {
          expect(params[0]).toBe("4RWwwY8LowKYSrzE9t8Z5Tn15rLH6D1Uz1z5NvxHzPj6");
          return Promise.resolve({
            rows: mockAlerts,
            rowCount: 2,
          });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      };

      const res = await request(app)
        .get("/api/session/price-alerts")
        .query({ wallet: "4RWwwY8LowKYSrzE9t8Z5Tn15rLH6D1Uz1z5NvxHzPj6" });

      expect(res.status).toBe(200);
      expect(res.body.alerts.length).toBe(2);
      expect(res.body.alerts[0].gpuType).toBe("H100");
      expect(res.body.alerts[0].targetPrice).toBe(2.50);
      expect(res.body.alerts[0].isTriggered).toBe(false);
      expect(res.body.alerts[1].isTriggered).toBe(true);
    });
  });

  describe("DELETE /api/session/price-alerts/:id", () => {
    it("returns 400 when ID is not a valid UUID", async () => {
      const res = await request(app)
        .delete("/api/session/price-alerts/invalid-uuid")
        .send({ wallet: "4RWwwY8LowKYSrzE9t8Z5Tn15rLH6D1Uz1z5NvxHzPj6" });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_id");
    });

    it("returns 404 when alert is not found or unauthorized", async () => {
      queryMockImpl = () => Promise.resolve({ rows: [], rowCount: 0 });

      const res = await request(app)
        .delete("/api/session/price-alerts/e8316c02-e257-4148-bc88-348616174a7a")
        .send({ wallet: "4RWwwY8LowKYSrzE9t8Z5Tn15rLH6D1Uz1z5NvxHzPj6" });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("alert_not_found");
    });

    it("returns 200 and success when deleted", async () => {
      queryMockImpl = (text: string, params: any[]) => {
        if (text.includes("DELETE FROM price_alerts")) {
          return Promise.resolve({ rows: [], rowCount: 1 });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      };

      const res = await request(app)
        .delete("/api/session/price-alerts/e8316c02-e257-4148-bc88-348616174a7a")
        .send({ wallet: "4RWwwY8LowKYSrzE9t8Z5Tn15rLH6D1Uz1z5NvxHzPj6" });

      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(true);
      expect(res.body.id).toBe("e8316c02-e257-4148-bc88-348616174a7a");
    });
  });

  describe("checkPriceAlerts Service Function", () => {
    it("updates qualifying alerts and broadcasts them over WS", async () => {
      const mockTriggeredAlerts = [
        {
          id: "alert-uuid-999",
          wallet: "4RWwwY8LowKYSrzE9t8Z5Tn15rLH6D1Uz1z5NvxHzPj6",
          gpu_type: "H100",
          target_price: "2.500000",
          network: "devnet",
          triggered_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        }
      ];

      queryMockImpl = (text: string, params: any[]) => {
        if (text.includes("UPDATE price_alerts")) {
          expect(params[0]).toBe("H100");
          expect(params[1]).toBe("devnet");
          expect(params[2]).toBe(2.10); // current price
          return Promise.resolve({
            rows: mockTriggeredAlerts,
            rowCount: 1,
          });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      };

      await checkPriceAlerts("H100", 2.10, "devnet");

      // Verify that websocket broadcast was called
      expect(broadcastMock).toHaveBeenCalledTimes(1);
      const broadcastArg = broadcastMock.mock.calls[0] as [string, any];
      expect(broadcastArg[0]).toBe("price_alert");
      expect(broadcastArg[1].id).toBe("alert-uuid-999");
      expect(broadcastArg[1].gpuType).toBe("H100");
      expect(broadcastArg[1].targetPrice).toBe(2.50);
      expect(broadcastArg[1].clearingPrice).toBe(2.10);
    });
  });
});
