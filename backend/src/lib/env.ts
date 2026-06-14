/** Centralised, typed access to environment configuration. */
export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3001),
  version: process.env.npm_package_version ?? "0.1.0",
  databaseUrl: process.env.DATABASE_URL ?? "",
  matchingIntervalSeconds: Number(process.env.MATCHING_INTERVAL_SECONDS ?? 45),
  // CORS_ORIGIN may be a single origin, a comma-separated list of origins, or
  // "*" to allow any. e.g. "http://localhost:3000,https://obscura.onrender.com"
  corsOrigins: (process.env.CORS_ORIGIN ?? "*")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  sshHost: process.env.SSH_HOST ?? "localhost",
  sshPort: process.env.SSH_PORT ?? "2222",
  sshUsername: process.env.SSH_USERNAME ?? "root",
  sshPassword: process.env.SSH_PASSWORD ?? "obscura",
  webCliUrl: process.env.WEB_CLI_URL ?? "http://localhost:7681",
  network: process.env.NETWORK ?? "devnet",
  obscuraCollateralWallet: process.env.OBSCURA_COLLATERAL_WALLET ?? "4RWwwY8LowKYSrzE9t8Z5Tn15rLH6D1Uz1z5NvxHzPj6",
  obscuraServiceWallet: process.env.OBSCURA_SERVICE_WALLET ?? "FHMr5nLShb3AxFmdqS2dEwdseKFvaic6vyFcCm3Hm6Jn",
  usdcMint: process.env.USDC_MINT ?? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  usdcMintDevnet: process.env.USDC_MINT_DEVNET ?? "Gh9ZwEmd5Tg4Pq9d9Kh7X4T6PHW3cWUKAdJ1z7X3J42s",
};
