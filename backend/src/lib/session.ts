import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

const SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";
const TTL_MS = 1000 * 60 * 60 * 12; // 12h

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

/** Issue a short-TTL HMAC-signed session token binding a wallet. */
export function signSession(wallet: string): string {
  const payload = b64url(JSON.stringify({ wallet, exp: Date.now() + TTL_MS }));
  const sig = b64url(createHmac("sha256", SECRET).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verifySession(token: string): { wallet: string } | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = b64url(createHmac("sha256", SECRET).update(payload).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { wallet, exp } = JSON.parse(
      Buffer.from(payload, "base64url").toString(),
    ) as { wallet: string; exp: number };
    if (typeof exp !== "number" || Date.now() > exp) return null;
    return { wallet };
  } catch {
    return null;
  }
}

export interface SessionRequest extends Request {
  sessionWallet?: string;
}

/** If a valid Bearer session token is present, attach its verified wallet. */
export function sessionMiddleware(
  req: SessionRequest,
  _res: Response,
  next: NextFunction,
): void {
  const auth = req.header("authorization");
  if (auth?.startsWith("Bearer ")) {
    const s = verifySession(auth.slice(7));
    if (s) req.sessionWallet = s.wallet;
  }
  next();
}
