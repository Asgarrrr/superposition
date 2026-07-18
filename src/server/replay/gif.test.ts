import { describe, expect, it } from "vitest";
import { encodeGif, lzwEncode, type Palette } from "./gif.ts";

// An independent GIF LZW decoder (giflib code-width rule) — proves the encoder
// emits a stream a real decoder reads back, not just one it agrees with itself.
function lzwDecode(data: Uint8Array, minCodeSize: number): number[] {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let bitPos = 0;
  const readCode = () => {
    let code = 0;
    for (let i = 0; i < codeSize; i++) {
      const byte = data[bitPos >> 3];
      const bit = (byte >> (bitPos & 7)) & 1;
      code |= bit << i;
      bitPos++;
    }
    return code;
  };

  let dict: number[][] = [];
  const reset = () => {
    dict = [];
    for (let i = 0; i < clearCode; i++) dict[i] = [i];
    dict[clearCode] = [];
    dict[eoiCode] = [];
    codeSize = minCodeSize + 1;
  };
  reset();

  const out: number[] = [];
  let prev: number[] | null = null;
  for (;;) {
    const code = readCode();
    if (code === clearCode) {
      reset();
      prev = null;
      continue;
    }
    if (code === eoiCode) break;
    let entry: number[];
    if (code < dict.length) entry = dict[code];
    else entry = prev!.concat(prev![0]); // KwKwK case
    out.push(...entry);
    if (prev) dict.push(prev.concat(entry[0]));
    // the decoder trails the encoder by one entry, so it widens one code
    // earlier to keep the read width in step with the write width
    if (dict.length + 1 > 1 << codeSize && codeSize < 12) codeSize++;
    prev = entry;
  }
  return out;
}

const palette: Palette = Array.from(
  { length: 16 },
  (_, i) => [i * 16, (i * 7) % 256, (i * 13) % 256] as const,
);

describe("lzwEncode — round-trips through an independent decoder", () => {
  it("recovers a pattern that forces the code width to grow", () => {
    const px = new Uint8Array(64 * 48);
    for (let i = 0; i < px.length; i++) px[i] = (i * 3 + (i >> 2)) % 16;
    expect(lzwDecode(lzwEncode(px, 4), 4)).toEqual([...px]);
  });

  it("survives a real dictionary overflow reset (varied stream past 4096 entries)", () => {
    // A uniform run coins ~one entry per doubling and never nears the 4096-code
    // ceiling, so it can't exercise the reset. A varied stream coins roughly one
    // entry per pixel: 50k pixels drawn from the 16 palette codes cross 4096
    // several times over, forcing the encoder to emit clear codes and reset.
    // The generator is a seeded mulberry32 so the stream is fixed across runs.
    let s = 0x9e3779b9;
    const rng = () => {
      s |= 0;
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const px = new Uint8Array(50000);
    for (let i = 0; i < px.length; i++) px[i] = Math.floor(rng() * 16);
    expect(lzwDecode(lzwEncode(px, 4), 4)).toEqual([...px]);
  });
});

// Walks the GIF block structure (skipping the colour table, extensions and
// sub-block chains) to count image descriptors — a reliable frame count that a
// stray 0x2c byte in the LZW payload can't inflate.
function countFrames(gif: Uint8Array): number {
  let p = 13; // past header + logical screen descriptor
  const packed = gif[10];
  if (packed & 0x80) p += 3 * (1 << ((packed & 0x07) + 1)); // global colour table
  const skipSubBlocks = () => {
    while (gif[p] !== 0) p += 1 + gif[p];
    p++;
  };
  let frames = 0;
  for (;;) {
    const b = gif[p];
    if (b === 0x3b) break; // trailer
    if (b === 0x21) {
      p += 2; // extension introducer + label
      skipSubBlocks();
    } else if (b === 0x2c) {
      frames++;
      p += 10; // image descriptor (no local colour table here)
      p++; // LZW minimum code size
      skipSubBlocks();
    } else break;
  }
  return frames;
}

describe("encodeGif — structure", () => {
  it("emits a GIF89a with the requested frames and the trailer", () => {
    const w = 8;
    const h = 8;
    const f = () => new Uint8Array(w * h).map((_, i) => i % 16);
    const gif = encodeGif({
      width: w,
      height: h,
      palette,
      frames: [
        { indices: f(), delayCs: 50 },
        { indices: f(), delayCs: 200 },
      ],
    });
    expect(new TextDecoder().decode(gif.subarray(0, 6))).toBe("GIF89a");
    expect(gif[gif.length - 1]).toBe(0x3b); // trailer
    expect(countFrames(gif)).toBe(2);
  });
});
