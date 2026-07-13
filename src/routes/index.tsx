import { createFileRoute } from "@tanstack/react-router";
import App from "../ui/App.tsx";

// The whole game is a client-only SPA (AudioContext, localStorage, keyboard).
// Server rendering is disabled app-wide in src/start.ts; this route just
// mounts App, whose internal screen router owns title / select / play.
export const Route = createFileRoute("/")({ component: App });
