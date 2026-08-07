import { describe, expect, it } from "vitest";
import { LEVELS } from "../engine/levels.ts";
import { robotsTxt, sitemapXml } from "./seo.ts";

const ORIGIN = "https://superposition.example";

function locs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
}

describe("sitemapXml", () => {
  it("lists every plate in the bank, plus the two static screens", () => {
    const urls = locs(sitemapXml(ORIGIN)!);
    expect(urls).toHaveLength(LEVELS.length + 2);
    expect(urls).toContain(`${ORIGIN}/`);
    expect(urls).toContain(`${ORIGIN}/levels`);
    expect(urls).toContain(`${ORIGIN}/level/1`);
    expect(urls).toContain(`${ORIGIN}/level/${LEVELS.length}`);
  });

  // a throwaway prototype, never wired into the screen flow: listing it would
  // invite a crawler to index a test page as if it were the game
  it("does not list the align prototype", () => {
    expect(sitemapXml(ORIGIN)!).not.toContain("/align");
  });

  it("emits only absolute URLs on the configured origin", () => {
    for (const url of locs(sitemapXml(ORIGIN)!)) {
      expect(url.startsWith(`${ORIGIN}/`)).toBe(true);
    }
  });

  // profiles are user data: publishable one by one, not enumerable in a file
  // served to everyone
  it("names no profile and no api path", () => {
    const xml = sitemapXml(ORIGIN)!;
    expect(xml).not.toContain("/profile");
    expect(xml).not.toContain("/api");
    expect(xml).not.toContain("/daily");
  });

  it("does not double the slash of a trailing-slash origin", () => {
    expect(locs(sitemapXml(`${ORIGIN}/`)!)).toEqual(locs(sitemapXml(ORIGIN)!));
  });

  // relative <loc>s are invalid; no sitemap beats a broken one
  it("declines to exist without an origin", () => {
    expect(sitemapXml(undefined)).toBeNull();
    expect(sitemapXml("")).toBeNull();
  });
});

describe("robotsTxt", () => {
  it("closes /api/ and points at the absolute sitemap", () => {
    const txt = robotsTxt(ORIGIN);
    expect(txt).toContain("User-agent: *");
    expect(txt).toContain("Disallow: /api/");
    expect(txt).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  });

  it("does not double the slash of a trailing-slash origin", () => {
    expect(robotsTxt(`${ORIGIN}/`)).toBe(robotsTxt(ORIGIN));
  });

  // the Disallow rules stand on their own, so only the directive that needs an
  // absolute URL drops out
  it("keeps its rules but drops the directive without an origin", () => {
    const txt = robotsTxt(undefined);
    expect(txt).toContain("Disallow: /api/");
    expect(txt).not.toContain("Sitemap:");
  });
});
