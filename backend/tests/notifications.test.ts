import { describe, it, expect, mock, beforeEach } from "bun:test";
import request from "supertest";

let queryMockImpl = (...args: any[]): Promise<any> => Promise.resolve({ rows: [], rowCount: 0 });
let broadcastMock = mock(() => {});

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

describe("Notification Prefs API", () => {
  beforeEach(() => {
    broadcastMock.mockClear();
    queryMockImpl = (...args: any[]): Promise<any> => Promise.resolve({ rows: [], rowCount: 0 });
  });

  describe("GET /api/session/notification-prefs", () => {
    it("returns 400 when session/wallet is missing", async () => {
      const res = await request(app).get("/api/session/notification-prefs");
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("valid ?wallet= or session required");
    });

    it("returns default preferences when user has none saved", async () => {
      queryMockImpl = (text: string, params: any[]) => {
        if (text.includes("SELECT notification_prefs")) {
          return Promise.resolve({ rows: [], rowCount: 0 });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      };

      const res = await request(app)
        .get("/api/session/notification-prefs")
        .query({ wallet: "4RWwwY8LowKYSrzE9t8Z5Tn15rLH6D1Uz1z5NvxHzPj6" });

      expect(res.status).toBe(200);
      expect(res.body.emailEnabled).toBe(false);
      expect(res.body.priceAlertsEnabled).toBe(true);
      expect(res.body.orderFillsEnabled).toBe(true);
    });

    it("returns saved preferences when user has them set", async () => {
      const savedPrefs = {
        emailEnabled: true,
        emailAddress: "test@example.com",
        telegramEnabled: true,
        telegramUsername: "test_tg",
        priceAlertsEnabled: false,
        orderFillsEnabled: true,
      };

      queryMockImpl = (text: string, params: any[]) => {
        if (text.includes("SELECT notification_prefs")) {
          return Promise.resolve({
            rows: [{ notification_prefs: savedPrefs }],
            rowCount: 1,
          });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      };

      const res = await request(app)
        .get("/api/session/notification-prefs")
        .query({ wallet: "4RWwwY8LowKYSrzE9t8Z5Tn15rLH6D1Uz1z5NvxHzPj6" });

      expect(res.status).toBe(200);
      expect(res.body.emailEnabled).toBe(true);
      expect(res.body.emailAddress).toBe("test@example.com");
      expect(res.body.priceAlertsEnabled).toBe(false);
    });
  });

  describe("PUT /api/session/notification-prefs", () => {
    it("returns 400 validation error when body has invalid fields", async () => {
      const res = await request(app)
        .put("/api/session/notification-prefs")
        .send({
          wallet: "4RWwwY8LowKYSrzE9t8Z5Tn15rLH6D1Uz1z5NvxHzPj6",
          emailEnabled: true,
          emailAddress: "invalid-email-string",
          telegramEnabled: false,
          priceAlertsEnabled: "not-a-boolean",
          orderFillsEnabled: true,
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("validation_failed");
    });

    it("returns 401 when unauthorized", async () => {
      const res = await request(app)
        .put("/api/session/notification-prefs")
        .send({
          emailEnabled: true,
          emailAddress: "test@example.com",
          telegramEnabled: false,
          telegramUsername: "",
          priceAlertsEnabled: true,
          orderFillsEnabled: true,
        });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("unauthorized");
    });

    it("saves preferences successfully and returns 200", async () => {
      queryMockImpl = (text: string, params: any[]) => {
        if (text.includes("INSERT INTO users")) {
          return Promise.resolve({ rows: [], rowCount: 1 });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      };

      const payload = {
        wallet: "4RWwwY8LowKYSrzE9t8Z5Tn15rLH6D1Uz1z5NvxHzPj6",
        emailEnabled: true,
        emailAddress: "test@example.com",
        telegramEnabled: true,
        telegramUsername: "my_tg",
        priceAlertsEnabled: false,
        orderFillsEnabled: true,
      };

      const res = await request(app)
        .put("/api/session/notification-prefs")
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.emailEnabled).toBe(true);
      expect(res.body.emailAddress).toBe("test@example.com");
      expect(res.body.telegramUsername).toBe("my_tg");
      expect(res.body.priceAlertsEnabled).toBe(false);
    });
  });

  describe("Price alert checking with notification prefs", () => {
    it("skips WebSocket broadcast when priceAlertsEnabled is false", async () => {
      const mockTriggeredAlerts = [
        {
          id: "alert-uuid-1",
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
          return Promise.resolve({
            rows: mockTriggeredAlerts,
            rowCount: 1,
          });
        }
        if (text.includes("SELECT notification_prefs FROM users")) {
          return Promise.resolve({
            rows: [{ notification_prefs: { priceAlertsEnabled: false } }],
            rowCount: 1,
          });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      };

      await checkPriceAlerts("H100", 2.10, "devnet");

      // Verify that websocket broadcast was NOT called
      expect(broadcastMock).not.toHaveBeenCalled();
    });

    it("sends WebSocket broadcast when priceAlertsEnabled is true/default", async () => {
      const mockTriggeredAlerts = [
        {
          id: "alert-uuid-2",
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
          return Promise.resolve({
            rows: mockTriggeredAlerts,
            rowCount: 1,
          });
        }
        if (text.includes("SELECT notification_prefs FROM users")) {
          return Promise.resolve({
            rows: [{ notification_prefs: { priceAlertsEnabled: true } }],
            rowCount: 1,
          });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      };

      await checkPriceAlerts("H100", 2.10, "devnet");

      // Verify that websocket broadcast WAS called
      expect(broadcastMock).toHaveBeenCalledTimes(1);
    });
  });
});
