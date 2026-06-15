import { Router } from "express";
import { z } from "zod";

import { query } from "../db/index.ts";
import { asyncHandler } from "../lib/async.ts";
import { env } from "../lib/env.ts";
import { verifyUsdcTransfer, verifyUsdcSplitTransfer } from "../lib/solana.ts";
import { buildSplitTransferTx } from "../lib/tx-builder.ts";

export const providersRouter = Router();

// POST /api/providers/build-register-tx — build serialized listing tx.
const buildListingSchema = z.object({
  wallet: z.string().regex(/^(paper_[a-zA-Z0-9]+|[1-9A-HJ-NP-Za-km-z]{32,44})$/, "invalid Solana address"),
  rate: z.number().positive(),
});

providersRouter.post(
  "/providers/build-register-tx",
  asyncHandler(async (req, res) => {
    const parsed = buildListingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed", issues: parsed.error.issues });
      return;
    }
    const { wallet, rate } = parsed.data;

    const collateral = rate * 17.78;
    const protocolFee = collateral * 0.007;

    try {
      const serializedTx = await buildSplitTransferTx(
        wallet,
        env.obscuraCollateralWallet,
        collateral,
        env.obscuraServiceWallet,
        protocolFee
      );
      res.json({ serializedTx });
    } catch (e) {
      console.error("[solana-tx-builder] Failed to build listing tx:", e);
      res.status(500).json({
        error: "tx_build_failed",
        message: e instanceof Error ? e.message : "failed to build transaction"
      });
    }
  })
);

// POST /api/providers — register GPU capacity as a node operator.
const providerSchema = z.object({
  wallet: z.string().regex(/^(paper_[a-zA-Z0-9]+|[1-9A-HJ-NP-Za-km-z]{32,44})$/, "invalid Solana address"),
  gpuType: z.string().min(1).max(64),
  capacity: z.number().int().positive(),
  stakeAmount: z.number().nonnegative(),
  host: z.string().max(256),
  port: z.string().max(10),
  username: z.string().max(64),
  password: z.string().max(256),
  rateMicro: z.number().int().positive(),
  txSig: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,88}$/, "invalid transaction signature"),
});

providersRouter.post(
  "/providers",
  asyncHandler(async (req, res) => {
    const parsed = providerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed", issues: parsed.error.issues });
      return;
    }
    const {
      wallet,
      gpuType,
      capacity,
      stakeAmount,
      host,
      port,
      username,
      password,
      rateMicro,
      txSig,
    } = parsed.data;

    // Verify USDC collateral transfer and protocol fee on-chain
    const feeAmount = stakeAmount * 0.007;
    const ok = await verifyUsdcSplitTransfer(
      txSig,
      wallet,
      env.obscuraCollateralWallet,
      stakeAmount,
      env.obscuraServiceWallet,
      feeAmount,
    );
    if (!ok) {
      res.status(400).json({
        error: "collateral_verification_failed",
        message: `Unable to verify the collateral payment of ${stakeAmount} USDC and protocol fee of ${feeAmount.toFixed(4)} USDC on-chain. Please ensure the transaction signature is correct, that the transaction has successfully processed on Solana, and that your wallet has enough USDC.`,
      });
      return;
    }

    const { rows } = await query<{ id: string }>(
      `INSERT INTO providers (wallet, gpu_type, capacity, stake_amount, status, host, port, username, password, rate_micro, network)
       VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, $8, $9, $10) RETURNING id`,
      [
        wallet,
        gpuType,
        capacity,
        stakeAmount,
        host,
        port,
        username,
        password,
        rateMicro,
        env.network,
      ],
    );
    res.status(201).json({ id: rows[0].id, gpuType, capacity, status: "active" });
  }),
);

// GET /api/providers — GPU provider listings (public-safe).
providersRouter.get(
  "/providers",
  asyncHandler(async (req, res) => {
    const gpuType = typeof req.query.gpuType === "string" ? req.query.gpuType : null;
    const { rows } = await query<{
      id: string;
      wallet: string;
      gpu_type: string;
      capacity: number;
      stake_amount: string;
      rate_micro: string;
      successful_pings: number;
      failed_pings: number;
      status: string;
      total_orders: string;
      settled_orders: string;
    }>(
      `SELECT p.id, p.wallet, p.gpu_type, p.capacity, p.stake_amount, p.rate_micro, p.successful_pings, p.failed_pings, p.status,
              COALESCE(o.total_orders, 0) AS total_orders,
              COALESCE(o.settled_orders, 0) AS settled_orders
       FROM providers p
       LEFT JOIN (
         SELECT assigned_provider_wallet,
                COUNT(*) AS total_orders,
                COUNT(*) FILTER (WHERE status = 'settled') AS settled_orders
         FROM orders
         GROUP BY assigned_provider_wallet
       ) o ON p.wallet = o.assigned_provider_wallet
       WHERE p.status = 'active'
         AND ($1::text IS NULL OR p.gpu_type = $1)
         AND p.network = $2
       ORDER BY p.rate_micro ASC, p.updated_at DESC`,
      [gpuType, env.network],
    );
    res.json({
      providers: rows.map((r) => {
        const totalPings = r.successful_pings + r.failed_pings;
        const uptime = totalPings > 0 ? (r.successful_pings / totalPings) * 100 : 100;
        
        const totalOrders = Number(r.total_orders);
        const settledOrders = Number(r.settled_orders);
        const fillRate = totalOrders > 0 ? (settledOrders / totalOrders) * 100 : 100;
        const reputation = Math.round((uptime * 0.4) + (fillRate * 0.6));

        return {
          id: r.id,
          wallet: r.wallet,
          gpuType: r.gpu_type,
          capacity: r.capacity,
          stakeAmount: Number(r.stake_amount),
          rateMicro: Number(r.rate_micro),
          successfulPings: r.successful_pings,
          failedPings: r.failed_pings,
          status: r.status,
          uptime,
          fillRate,
          reputation,
        };
      }),
    });
  }),
);
