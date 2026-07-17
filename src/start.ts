import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

// Reject cross-site calls to our state-changing server functions (the score
// submits). Scoped to serverFn mutations: better-auth's own route handler under
// /api/auth (handlerType "router") keeps its cross-origin OAuth flows, and the
// read RPCs (GET getDailyPuzzle/getDailyBoard/getLevelBoard) stay ungated — a
// same-origin GET sends no Origin header, so CSRF-gating a side-effect-free read
// only risks 403ing legitimate clients that also omit Sec-Fetch-Site/Referer.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) =>
    ctx.handlerType === "serverFn" && ctx.request.method !== "GET",
});

// Superposition's components are client-only (AudioContext, localStorage,
// keyboard/swipe), so no route renders its COMPONENT on the server. But the
// public profile needs real per-request <head> tags for social crawlers, which
// requires its loader + head to run server-side — and a child route can only be
// as SSR-permissive as its parents. So the default is `data-only`: loaders and
// head run on the server, components still render only on the client. The only
// loaders in the app (daily, profile) are pure server-safe data reads.
export const startInstance = createStart(() => ({
  defaultSsr: "data-only",
  requestMiddleware: [csrfMiddleware],
}));
