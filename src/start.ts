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

// Superposition is a pure client-side game (AudioContext, localStorage,
// keyboard/swipe). There is no server data, so server rendering is disabled
// app-wide: routes render on the client, the shell is prerendered static HTML.
export const startInstance = createStart(() => ({
  defaultSsr: false,
  requestMiddleware: [csrfMiddleware],
}));
