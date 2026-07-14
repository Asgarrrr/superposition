// Better Auth server instance: email + password accounts, Drizzle/Postgres
// adapter. Server-only. Consumed by the /api/auth/$ handler and by server
// functions that need the current session.

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { db } from "../db/index.ts";
import { account, session, user, verification } from "../db/schema.ts";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: process.env.BETTER_AUTH_URL
    ? [process.env.BETTER_AUTH_URL]
    : undefined,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  emailAndPassword: { enabled: true },
  // tanstackStartCookies MUST be the LAST plugin: it wraps the response to
  // flush Set-Cookie through @tanstack/react-start-server. A plugin registered
  // after it would run before cookies are written and break the session.
  plugins: [tanstackStartCookies()],
});
