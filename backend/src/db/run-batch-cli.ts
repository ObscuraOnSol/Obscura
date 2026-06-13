import "dotenv/config";

import { runBatch } from "../services/matching.ts";
import { pool } from "./index.ts";

// Manually trigger one batch auction (ops tool + local testing).
const result = await runBatch();
console.log("[batch]", JSON.stringify(result, null, 2));
await pool.end();
