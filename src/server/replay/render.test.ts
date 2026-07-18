import { describe, expect, it } from "vitest";
import { replayResponse, withRenderSlot } from "./render.ts";

describe("replayResponse — URL canonicalization", () => {
  const canonical = "/api/replay/c/1/aa.gif";

  // Every non-canonical spelling of the same replay must 301 to the one form,
  // so the browser/CDN and the in-memory GIF cache key on a single URL.
  it.each([
    ["missing .gif suffix", "c/1/aa"],
    ["empty middle segment", "c//1/aa.gif"],
    ["trailing slash", "c/1/aa.gif/"],
    ["leading slash", "/c/1/aa.gif"],
  ])("301s a %s variant to the canonical URL", async (_label, variant) => {
    const res = await replayResponse(variant);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe(canonical);
  });

  it("does not redirect the already-canonical form", async () => {
    // "zz" is not a legal trace, so it stops at 404 — the point is: no 301.
    const res = await replayResponse("c/1/zz.gif");
    expect(res.status).not.toBe(301);
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
