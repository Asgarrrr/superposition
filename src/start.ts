import { createStart } from "@tanstack/react-start";

// Superposition is a pure client-side game (AudioContext, localStorage,
// keyboard/swipe). There is no server data, so server rendering is disabled
// app-wide: routes render on the client, the shell is prerendered static HTML.
export const startInstance = createStart(() => ({
  defaultSsr: false,
}));
