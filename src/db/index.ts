// Postgres pool + Drizzle client. Server-only: imported only from server
// functions and the auth handler, so it's stripped from the browser bundle.

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.ts";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

export const pool = new Pool({ connectionString });
export const db = drizzle({ client: pool, schema });
