// Better Auth server instance: email + password accounts, Drizzle/Postgres
// adapter. Server-only. Consumed by the /api/auth/$ handler and by server
// functions that need the current session.

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { db } from "../db/index.ts";
import { account, session, user, verification } from "../db/schema.ts";
import { RESERVED_USERNAMES, USERNAME_RE } from "./username.ts";

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
  advanced: {
    ipAddress: {
      // Railway's edge strips any client-supplied X-Forwarded-For and appends
      // the connecting IP, with its internal hops in the CGNAT range. Trusting
      // that range lets the rate limiter walk the chain from the right past
      // Railway's hops to the real (unspoofable) client IP — without this it
      // refuses multi-hop chains and falls back to one shared bucket per path.
      trustedProxies: ["100.0.0.0/8"],
    },
  },
  // tanstackStartCookies MUST stay LAST: it wraps the response to flush
  // Set-Cookie through @tanstack/react-start-server. A plugin registered after
  // it would run before cookies are written and break the session.
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 20,
      // a custom validator REPLACES the plugin's default charset check, so it
      // must re-assert the shared format rule on top of the reserved-word rule
      usernameValidator: (name) =>
        USERNAME_RE.test(name) && !RESERVED_USERNAMES.has(name.toLowerCase()),
    }),
    tanstackStartCookies(),
  ],
});
