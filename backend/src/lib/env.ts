/** Centralised, typed access to environment configuration. */
export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3001),
  version: process.env.npm_package_version ?? "0.1.0",
  databaseUrl: process.env.DATABASE_URL ?? "",
  matchingIntervalSeconds: Number(process.env.MATCHING_INTERVAL_SECONDS ?? 45),
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
};
