import { Router } from "express";
import { z } from "zod";
import { execSync } from "child_process";

import { query } from "../db/index.ts";
import { asyncHandler } from "../lib/async.ts";
import { computeCommitHash, commitMatches } from "../lib/commit.ts";
import type { SessionRequest } from "../lib/session.ts";
import { env } from "../lib/env.ts";

/**
 * Browser/session order API for wallet-connected users (as opposed to the
 * X-API-Key agent API). When the caller presents a valid SIWS session token the
 * wallet comes from that verified token; otherwise it falls back to the body
 * wallet (the connected address) for read-style flows.
 *
 * Privacy note: price/qty are NEVER persisted. At reveal we verify the preimage
 * against the stored commit hash and then discard it; matching the actual values
 * happens in the (out-of-scope) batch matching engine. The orders table stays
 * public-safe.
 */
export const sessionRouter = Router();

const wallet = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "invalid Solana address");
const commitHash = z.string().regex(/^(0x)?[0-9a-fA-F]{64}$/, "expected a 32-byte keccak hash");

async function ensureUser(w: string): Promise<void> {
  await query(
    `INSERT INTO users (wallet) VALUES ($1) ON CONFLICT (wallet) DO NOTHING`,
    [w],
  );
}

// POST /api/session/orders — commit phase.
const commitSchema = z.object({
  wallet,
  gpuType: z.string().min(1).max(64),
  commitHash,
});
sessionRouter.post(
  "/session/orders",
  asyncHandler(async (req, res) => {
    const parsed = commitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed", issues: parsed.error.issues });
      return;
    }
    const w = (req as SessionRequest).sessionWallet ?? parsed.data.wallet;
    const { gpuType, commitHash: hash } = parsed.data;
    await ensureUser(w);
    const { rows } = await query<{ id: string; ts: Date }>(
      `INSERT INTO orders (wallet, gpu_type, commit_hash, status)
       VALUES ($1, $2, $3, 'committed') RETURNING id, ts`,
      [w, gpuType, hash.replace(/^0x/, "")],
    );
    res.status(201).json({
      id: rows[0].id,
      status: "committed",
      phase: "COMMITTED",
      ts: rows[0].ts,
    });
  }),
);

// POST /api/session/orders/:id/reveal — reveal phase.
const revealSchema = z.object({
  wallet,
  priceMicro: z.number().int().nonnegative(),
  qty: z.number().int().positive(),
  secret: z.string().regex(/^(0x)?[0-9a-fA-F]{64}$/, "secret must be 32 bytes"),
});
sessionRouter.post(
  "/session/orders/:id/reveal",
  asyncHandler(async (req, res) => {
    const parsed = revealSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed", issues: parsed.error.issues });
      return;
    }
    const w = (req as SessionRequest).sessionWallet ?? parsed.data.wallet;
    const { priceMicro, qty, secret } = parsed.data;

    const id = String(req.params.id);
    const { rows } = await query<{
      commit_hash: string;
      status: string;
      gpu_type: string;
    }>(
      `SELECT commit_hash, status, gpu_type FROM orders WHERE id = $1 AND wallet = $2`,
      [id, w],
    );
    if (rows.length === 0) {
      res.status(404).json({ error: "order not found" });
      return;
    }
    if (rows[0].status !== "committed") {
      res.status(409).json({ error: `cannot reveal an order in status '${rows[0].status}'` });
      return;
    }

    // Enforce the commit-reveal invariant: the preimage must hash to the commit.
    const expected = computeCommitHash(BigInt(priceMicro), BigInt(qty), secret);
    if (!commitMatches(expected, rows[0].commit_hash)) {
      res.status(400).json({ error: "reveal does not match committed hash" });
      return;
    }

    // Mark revealed and record an EPHEMERAL matching intent. price/qty live in
    // order_intents only for the batch window; the matching engine deletes them
    // on settlement, so they never persist in a public-safe table.
    await query(
      `UPDATE orders SET revealed = TRUE, status = 'revealed' WHERE id = $1 AND wallet = $2`,
      [id, w],
    );
    await query(
      `INSERT INTO order_intents (order_id, wallet, gpu_type, price_micro, qty)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (order_id) DO UPDATE
         SET price_micro = EXCLUDED.price_micro, qty = EXCLUDED.qty`,
      [id, w, rows[0].gpu_type, priceMicro, qty],
    );
    res.json({ id, status: "revealed", phase: "REVEALED" });
  }),
);

// POST /api/session/orders/:id/cancel
sessionRouter.post(
  "/session/orders/:id/cancel",
  asyncHandler(async (req, res) => {
    const bodyW = wallet.safeParse(req.body?.wallet);
    const w = (req as SessionRequest).sessionWallet ?? (bodyW.success ? bodyW.data : null);
    if (!w) {
      res.status(400).json({ error: "valid wallet required" });
      return;
    }
    const { rowCount } = await query(
      `UPDATE orders SET status = 'cancelled'
       WHERE id = $1 AND wallet = $2 AND status IN ('committed','revealed')`,
      [String(req.params.id), w],
    );
    if (!rowCount) {
      res.status(404).json({ error: "order not found or not cancellable" });
      return;
    }
    res.json({ id: String(req.params.id), status: "cancelled" });
  }),
);

// GET /api/session/orders?wallet=...
sessionRouter.get(
  "/session/orders",
  asyncHandler(async (req, res) => {
    const w = wallet.safeParse(req.query.wallet);
    if (!w.success) {
      res.status(400).json({ error: "valid ?wallet= required" });
      return;
    }
    const { rows } = await query<{
      id: string;
      gpu_type: string;
      commit_hash: string;
      revealed: boolean;
      status: string;
      ts: Date;
    }>(
      `SELECT id, gpu_type, commit_hash, revealed, status, ts
       FROM orders WHERE wallet = $1 ORDER BY ts DESC LIMIT 100`,
      [w.data],
    );
    res.json({
      orders: rows.map((r) => ({
        id: r.id,
        gpuType: r.gpu_type,
        commitHash: r.commit_hash,
        revealed: r.revealed,
        status: r.status,
        ts: r.ts,
      })),
    });
  }),
);

interface ConnectionDetails {
  host: string;
  port: string;
  username: string;
  password?: string;
  webCliUrl: string;
}

function getDockerConnection(id: string): ConnectionDetails | null {
  try {
    // Check if docker is installed and running
    execSync("docker --version", { stdio: "ignore" });
  } catch (e) {
    return null; // Docker not available
  }

  const containerName = `obscura-node-${id.slice(0, 8)}`;

  try {
    // Check if container is running
    const isRunning = execSync(`docker inspect -f '{{.State.Running}}' ${containerName}`, { stdio: "pipe" })
      .toString()
      .trim();

    if (isRunning !== "true") {
      // If it exists but is stopped, start it
      execSync(`docker start ${containerName}`, { stdio: "ignore" });
    }
  } catch (e) {
    // Container does not exist, let's create and start it
    try {
      // Run the container exposing port 22 and 7681 on random host ports
      execSync(`docker run -d --name ${containerName} -p 22 -p 7681 obscura-gpu-server`, { stdio: "ignore" });
    } catch (err) {
      console.error("Failed to run docker container, fallback to env config", err);
      return null;
    }
  }

  try {
    // Get host port mappings
    const sshPortOutput = execSync(`docker port ${containerName} 22`, { stdio: "pipe" }).toString().trim();
    const webPortOutput = execSync(`docker port ${containerName} 7681`, { stdio: "pipe" }).toString().trim();

    // Parse port (matches e.g. "0.0.0.0:32768" or "[::]:32768" or "32768")
    const sshPort = sshPortOutput.split(":").pop() || "2222";
    const webPort = webPortOutput.split(":").pop() || "7681";

    return {
      host: "localhost",
      port: sshPort,
      username: "root",
      password: "obscura",
      webCliUrl: `http://localhost:${webPort}`,
    };
  } catch (e) {
    console.error("Failed to parse docker ports", e);
    return null;
  }
}

// GET /api/session/orders/:id/connection
sessionRouter.get(
  "/session/orders/:id/connection",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const { rows } = await query(
      `SELECT id FROM orders WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) {
      res.status(404).json({ error: "order not found" });
      return;
    }

    // Try to get dynamic Docker connection if running locally with docker
    const dockerConn = getDockerConnection(id);
    if (dockerConn) {
      res.json(dockerConn);
      return;
    }

    // Fallback to static environment variable configurations (useful for Render/remote deploy)
    res.json({
      host: env.sshHost,
      port: env.sshPort,
      username: env.sshUsername,
      password: env.sshPassword,
      webCliUrl: env.webCliUrl,
    });
  }),
);
