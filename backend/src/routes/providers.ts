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
  wallet: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "invalid Solana address"),
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
  wallet: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "invalid Solana address"),
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
        message: `Failed to verify collateral payment of ${stakeAmount} USDC and protocol fee of ${feeAmount.toFixed(4)} USDC to their respective wallets.`,
      });
      return;
    }

    const { rows } = await query<{ id: string }>(
      `INSERT INTO providers (wallet, gpu_type, capacity, stake_amount, status, host, port, username, password, rate_micro)
       VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, $8, $9) RETURNING id`,
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
    }>(
      `SELECT id, wallet, gpu_type, capacity, stake_amount, rate_micro, successful_pings, failed_pings, status
       FROM providers
       WHERE status = 'active'
         AND ($1::text IS NULL OR gpu_type = $1)
       ORDER BY rate_micro ASC, updated_at DESC`,
      [gpuType],
    );
    res.json({
      providers: rows.map((r) => ({
        id: r.id,
        wallet: r.wallet,
        gpuType: r.gpu_type,
        capacity: r.capacity,
        stakeAmount: Number(r.stake_amount),
        rateMicro: Number(r.rate_micro),
        successfulPings: r.successful_pings,
        failedPings: r.failed_pings,
        status: r.status,
      })),
    });
  }),
);
