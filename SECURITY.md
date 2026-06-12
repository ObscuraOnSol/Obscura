# Security Policy

## Reporting a vulnerability

**Email [obscurasol@outlook.com](mailto:obscurasol@outlook.com)** — do **not** open
a public issue for security reports.

- We acknowledge reports within **48 hours**.
- We aim to patch **critical** issues within **7 days**.
- Good-faith research will not face legal action. We credit reporters on the fix
  unless you ask us not to.

Please include repro steps, affected component (frontend / backend / program),
and impact.

## Scope

**In scope:** the backend APIs, the Next.js frontend, the `obscura_pool` Anchor
program, the migration runner, and CI/deploy configuration in this repository.

**Out of scope:** the fund-privacy money core (escrow internals, relayer path,
association-set verifier, settlement verifier) — documented at interface level
only and not implemented here; third-party infrastructure (Helius, Render,
GHCR); and social-engineering of maintainers.

## Project-specific attack surfaces

Given the architecture, the most likely vectors are:

1. **Order-privacy leakage** — anything that exposes order size/price/timing
   before reveal (e.g. logging the commit preimage, timing side-channels in the
   batch trigger). Private material must stay client-side.
2. **Commit-reveal integrity** — a reveal that does not hash to its commit must
   be rejected on-chain (`keccak(price\|qty\|secret)`); regressions here are
   critical.
3. **Clearing-price / batch-auction manipulation** — wash fills or skew of the
   price oracle and global stats.
4. **Auth bypass** — SIWS nonce reuse (nonces are single-use, consumed on
   verify), forged signatures, or `X-API-Key` leakage. Keys are SHA-256 hashed
   at rest and shown once; signing keys live in KMS/HSM and are never inlined.
5. **SQL injection / API abuse** — all queries are parameterized; rate limits are
   tier-gated. Report any unparameterized path.
6. **Settlement-exit screening bypass** — any path that lets an external exit
   skip the association-set clean-provenance proof.

## Deployed program addresses

To be published here once programs are deployed to mainnet (deploys are via
multisig; all programs are independently audited first).
