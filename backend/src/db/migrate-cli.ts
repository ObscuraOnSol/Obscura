import "dotenv/config";

import { migrate } from "./migrate.ts";
import { pool } from "./index.ts";

await migrate();
await pool.end();
console.log("[migrate] done");
