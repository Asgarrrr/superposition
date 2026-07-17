// The single source of truth for the username format, shared by the Better Auth
// validator (signup), the public RPC lookup, and the OG-image route so the three
// can never disagree. Pure (no db) — safe to import anywhere.

export const USERNAME_RE = /^[a-zA-Z0-9_.]{3,20}$/;

// Handles that would shadow or be confused with a route/system path — a username
// must never collide with the static /profile/me segment or the app's own paths.
export const RESERVED_USERNAMES = new Set([
  "me",
  "admin",
  "api",
  "profile",
  "levels",
  "level",
  "daily",
  "align",
]);
