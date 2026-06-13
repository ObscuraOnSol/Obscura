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
};
