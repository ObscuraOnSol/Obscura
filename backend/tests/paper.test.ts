import { describe, it, expect, mock, beforeEach } from "bun:test";
import request from "supertest";

let queryMockImpl = (...args: any[]): Promise<any> => Promise.resolve({ rows: [], rowCount: 0 });

// Mock the db index module
mock.module("../src/db/index.ts", () => {
  return {
    query: (...args: any[]) => queryMockImpl(...args),
    pool: {
      query: (...args: any[]) => queryMockImpl(...args),
    }
  };
});

// Mock the solana verification helper
mock.module("../src/lib/solana.ts", () => {
  return {
    verifyUsdcTransfer: () => Promise.resolve(false), // Real calls fail, paper bypass must succeed
  };
});

import { app } from "../src/app.ts";

describe("Paper Trading Mode & Leaderboard", () => {
  beforeEach(() => {
    queryMockImpl = (...args: any[]): Promise<any> => Promise.resolve({ rows: [], rowCount: 0 });
  });

  describe("POST /api/auth/verify (Bypass)", () => {
    it("bypasses SIWS signature verification for paper wallets", async () => {
      queryMockImpl = (text: string, params: any[]) => {
        if (text.includes("SELECT nonce FROM auth_nonces")) {
          return Promise.resolve({ rows: [{ nonce: "nonce123" }], rowCount: 1 });
        }
        if (text.includes("INSERT INTO users")) {
          expect(params[1]).toBe(true); // is_paper is true
          return Promise.resolve({ rows: [], rowCount: 1 });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      };

      const res = await request(app)
        .post("/api/auth/verify")
        .send({
          wallet: "paper_mockAddress123",
          nonce: "a".repeat(32),
          signature: "dummySignatureString",
        });

      expect(res.status).toBe(200);
      expect(res.body.wallet).toBe("paper_mockAddress123");
      expect(res.body.session).toBeDefined();
    });

    it("does not bypass SIWS signature verification for regular wallets", async () => {
      queryMockImpl = (text: string, params: any[]) => {
        if (text.includes("SELECT nonce FROM auth_nonces")) {
          return Promise.resolve({ rows: [{ nonce: "nonce123" }], rowCount: 1 });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      };

      const res = await request(app)
        .post("/api/auth/verify")
        .send({
          wallet: "4RWwwY8LowKYSrzE9t8Z5Tn15rLH6D1Uz1z5NvxHzPj6", // regular wallet
          nonce: "a".repeat(32),
          signature: "dummySignatureString",
        });

      // Signature verification failed because it's not a paper wallet
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("signature verification failed");
    });
  });

  describe("POST /api/session/orders/:id/settle (Bypass)", () => {
    it("bypasses USDC transfer check when user is a paper trader", async () => {
      queryMockImpl = (text: string, params: any[]) => {
        if (text.includes("SELECT status, assigned_provider_wallet")) {
          return Promise.resolve({
            rows: [{
              status: "matched",
              assigned_provider_wallet: "prov-123",
              clearing_price: "1.50",
              hours: 4,
              network: "devnet",
            }],
            rowCount: 1,
          });
        }
        if (text.includes("SELECT is_paper")) {
          return Promise.resolve({
            rows: [{ is_paper: true }], // user is a paper trader
            rowCount: 1,
          });
        }
        if (text.includes("UPDATE orders")) {
          return Promise.resolve({ rows: [], rowCount: 1 });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      };

      const res = await request(app)
        .post("/api/session/orders/order-uuid-123/settle")
        .send({
          wallet: "paper_mockAddress123",
          txSig: "A".repeat(50),
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("settled");
    });

    it("does not bypass USDC check when user is a regular trader", async () => {
      queryMockImpl = (text: string, params: any[]) => {
        if (text.includes("SELECT status, assigned_provider_wallet")) {
          return Promise.resolve({
            rows: [{
              status: "matched",
              assigned_provider_wallet: "prov-123",
              clearing_price: "1.50",
              hours: 4,
              network: "devnet",
            }],
            rowCount: 1,
          });
        }
        if (text.includes("SELECT is_paper")) {
          return Promise.resolve({
            rows: [{ is_paper: false }], // regular user
            rowCount: 1,
          });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      };

      const res = await request(app)
        .post("/api/session/orders/order-uuid-123/settle")
        .send({
          wallet: "4RWwwY8LowKYSrzE9t8Z5Tn15rLH6D1Uz1z5NvxHzPj6",
          txSig: "A".repeat(50),
        });

      // Verification fails because user is not a paper trader and verifyUsdcTransfer returned false
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("payment_verification_failed");
    });
  });

  describe("GET /api/leaderboard", () => {
    it("returns paper-trading leaderboard ranked list", async () => {
      const mockLeaderboard = [
        {
          wallet: "paper_user1",
          total_leases: "15",
          total_hours: "60",
          total_spend: "90.000000",
        },
        {
          wallet: "paper_user2",
          total_leases: "8",
          total_hours: "24",
          total_spend: "48.000000",
        }
      ];

      queryMockImpl = (text: string, params: any[]) => {
        if (text.includes("is_paper = TRUE")) {
          return Promise.resolve({
            rows: mockLeaderboard,
            rowCount: 2,
          });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      };

      const res = await request(app).get("/api/leaderboard");

      expect(res.status).toBe(200);
      expect(res.body.leaderboard.length).toBe(2);
      expect(res.body.leaderboard[0].rank).toBe(1);
      expect(res.body.leaderboard[0].wallet).toBe("paper_user1");
      expect(res.body.leaderboard[0].totalHours).toBe(60);
      expect(res.body.leaderboard[1].rank).toBe(2);
      expect(res.body.leaderboard[1].totalSpend).toBe(48);
    });
  });
});
