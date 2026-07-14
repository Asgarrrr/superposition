import { defineConfig } from "drizzle-kit";

// bun auto-loads .env, so process.env.DATABASE_URL is populated locally; Railway
// injects it in production. Migrations are emitted to ./src/db/migrations and
// committed. Paths are resolved from the project root (where the CLI runs), not
// this file's location.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
