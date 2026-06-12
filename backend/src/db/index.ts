import pg from "pg";

/**
 * A single shared connection pool, created from DATABASE_URL.
 * No ORM — queries are written as plain parameterized SQL via `pool.query`.
 */
const connectionString = process.env.DATABASE_URL ?? "";
const isLocalHost = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);

/**
 * SSL policy: local dev needs none. Managed providers (Supabase, Render, Neon)
 * require it. Honour an explicit `PGSSL=disable`, otherwise enable SSL for any
 * non-localhost host.
 */
function resolveSsl(): pg.PoolConfig["ssl"] {
  if (process.env.PGSSL === "disable") return undefined;
  if (process.env.PGSSL === "require") return { rejectUnauthorized: false };
  if (isLocalHost) return undefined;
  return { rejectUnauthorized: false };
}

export const pool = new pg.Pool({
  connectionString,
  ssl: resolveSsl(),
  max: Number(process.env.PG_POOL_MAX ?? 10),
});

export type QueryParam = string | number | boolean | null | Date;

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: QueryParam[] = [],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}
