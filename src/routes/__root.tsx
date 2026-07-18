import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";

import appCss from "../index.css?url";
import { RegisterSW } from "../ui/RegisterSW.tsx";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" },
      { name: "theme-color", content: "#14110E" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black" },
      { name: "apple-mobile-web-app-title", content: "Superposition" },
      { title: "Superposition" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    // literal mirrors --color-room: paints the root dark on the very first
    // frame, before the stylesheet (and its token) has loaded
    <html lang="fr" style={{ backgroundColor: "#14110e" }}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <RegisterSW />
        <Scripts />
      </body>
    </html>
  );
}
