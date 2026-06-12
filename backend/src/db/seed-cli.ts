import "dotenv/config";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { pool } from "./index.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED = join(__dirname, "..", "..", "db", "seed.sql");

const sql = await readFile(SEED, "utf8");
await pool.query(sql);
await pool.end();
console.log("[seed] done");
