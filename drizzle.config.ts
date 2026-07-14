import { defineConfig } from "drizzle-kit";

// bun auto-loads .env, so process.env.DATABASE_URL is populated locally; Railway
// injects it in production. Migrations are emitted to ./drizzle and committed.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
