import { describe, expect, it } from "vitest";
import { LEVELS } from "../../engine/levels.ts";
import { campaignLevel, replayResponse, withRenderSlot } from "./render.ts";

describe("replayResponse — URL canonicalization", () => {
  const canonical = "/api/replay/c/accord/aa.gif";

  // Every non-canonical spelling of the same replay must 301 to the one form,
  // so the browser/CDN and the in-memory GIF cache key on a single URL.
  it.each([
    ["missing .gif suffix", "c/accord/aa"],
    ["empty middle segment", "c//accord/aa.gif"],
    ["trailing slash", "c/accord/aa.gif/"],
    ["leading slash", "/c/accord/aa.gif"],
  ])("301s a %s variant to the canonical URL", async (_label, variant) => {
    const res = await replayResponse(variant);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe(canonical);
  });

  it("does not redirect the already-canonical form", async () => {
    // "zz" is not a legal trace, so it stops at 404 — the point is: no 301.
    const res = await replayResponse("c/accord/zz.gif");
    expect(res.status).not.toBe(301);
  });
});

describe("campaignLevel — resolve by stable id", () => {
  it("resolves a known id to its level", () => {
    expect(campaignLevel("accord")?.id).toBe("accord");
    expect(campaignLevel("retenue")?.id).toBe("retenue");
  });

  it("returns null for an unknown id", () => {
    expect(campaignLevel("nope")).toBeNull();
  });

  // The old scheme keyed on a 1-based positional index. It must no longer
  // resolve: a purely numeric segment is never a valid level id.
  it("returns null for an old positional plate", () => {
    expect(campaignLevel("1")).toBeNull();
  });

  // Invariant that makes the line above safe: if any id were purely numeric,
  // an old positional URL could mis-resolve to the wrong level.
  it("no level id is purely numeric", () => {
    expect(LEVELS.every((l) => !/^\d+$/.test(l.id))).toBe(true);
  });
});

describe("replayResponse — campaign id resolution", () => {
  it("404s an old positional plate URL", async () => {
    const res = await replayResponse("c/1/aa.gif");
    expect(res.status).toBe(404);
  });

  it("404s an unknown level id", async () => {
    const res = await replayResponse("c/nope/aa.gif");
    expect(res.status).toBe(404);
  });
});

describe("withRenderSlot — concurrency cap", () => {
  it("admits up to the cap and sheds the rest with null (→ 429)", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const slow = () => gate.then(() => "ok");

    // Three slots fill; each awaits the gate and holds its slot.
    const admitted = [
      withRenderSlot(slow),
      withRenderSlot(slow),
      withRenderSlot(slow),
    ];
    // The fourth is over the cap and is shed immediately.
    const shed = await withRenderSlot(slow);
    expect(shed).toBeNull();

    release();
    expect(await Promise.all(admitted)).toEqual(["ok", "ok", "ok"]);

    // Slots are freed afterwards, so a later render is admitted again.
    expect(await withRenderSlot(() => "later")).toBe("later");
  });
});
