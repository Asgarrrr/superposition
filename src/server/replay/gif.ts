// A minimal GIF89a encoder for animated replays. No dependency: the stale
// encoders on npm (gifenc, gif-encoder-2, omggif — all last released in 2022)
// fail our freshness rule, and our palette is a fixed handful of colours, so a
// GIF89a with a single global colour table and standard variable-width LZW is a
// small, self-contained, directly-verifiable piece of code (see gif.test.ts).
//
// Layout: header, logical screen descriptor + global colour table, a NETSCAPE
// looping extension, then one (graphic control extension + image descriptor +
// LZW image data) block per frame, and the trailer.

/** RGB triples for the global colour table; index 0 is the transparent/background
 *  key. At most 256 entries; padded up to the next power of two on write. */
export type Palette = readonly (readonly [number, number, number])[];

export interface GifFrame {
  /** One palette index per pixel, row-major, length width*height. */
  indices: Uint8Array;
  /** Frame delay in centiseconds (1/100 s). */
  delayCs: number;
}

export interface GifOptions {
  width: number;
  height: number;
  palette: Palette;
  frames: GifFrame[];
  /** 0 = loop forever (the default). */
  loop?: number;
}

class ByteSink {
  private buf = new Uint8Array(1024);
  private len = 0;
  private ensure(n: number) {
    if (this.len + n <= this.buf.length) return;
    let cap = this.buf.length * 2;
    while (cap < this.len + n) cap *= 2;
    const next = new Uint8Array(cap);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
  }
  byte(v: number) {
    this.ensure(1);
    this.buf[this.len++] = v & 0xff;
  }
  bytes(vs: ArrayLike<number>) {
    this.ensure(vs.length);
    this.buf.set(vs as Uint8Array, this.len);
    this.len += vs.length;
  }
  u16(v: number) {
    this.byte(v);
    this.byte(v >> 8);
  }
  ascii(s: string) {
    for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i));
  }
  done(): Uint8Array {
    return this.buf.slice(0, this.len);
  }
}

/** Smallest table-size exponent (1..8) whose 2^size covers the palette. */
function tableSizeExp(entries: number): number {
  let exp = 1;
  while (1 << (exp + 1) < entries) exp++;
  return Math.min(exp, 7);
}

/**
 * GIF variable-width LZW over one frame's palette indices. `minCodeSize` is the
 * bits per index (>= 2). Emits a leading clear code, grows the code width as the
 * dictionary fills, resets on overflow, and ends with the end-of-information
 * code. Bits are packed LSB-first, as the format requires.
 */
export function lzwEncode(
  indices: Uint8Array,
  minCodeSize: number,
): Uint8Array {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  const out = new ByteSink();
  let acc = 0;
  let accBits = 0;
  let codeSize = minCodeSize + 1;
  const emit = (code: number) => {
    acc |= code << accBits;
    accBits += codeSize;
    while (accBits >= 8) {
      out.byte(acc & 0xff);
      acc >>= 8;
      accBits -= 8;
    }
  };

  // Dictionary keyed by the standard LZW string: a prefix *code* (<= 12 bits)
  // extended by the next index (8 bits), packed into one number as
  // (prefixCode << 8) | index. `prefix` is always a live code, so a single
  // emit site suffices — no raw-index vs coined-code dispatch.
  let dict = new Map<number, number>();
  let next = clearCode + 2;
  const reset = () => {
    dict = new Map();
    codeSize = minCodeSize + 1;
    next = clearCode + 2;
  };

  emit(clearCode);
  reset();
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const key = (prefix << 8) | indices[i];
    const found = dict.get(key);
    if (found !== undefined) {
      prefix = found;
      continue;
    }
    emit(prefix);
    dict.set(key, next);
    next++;
    // grow the code width once the dictionary outgrows it — GIF/giflib bump
    // one code later than plain LZW (verified against a real decoder)
    if (next > 1 << codeSize && codeSize < 12) codeSize++;
    if (next === 4096) {
      emit(clearCode);
      reset();
    }
    prefix = indices[i];
  }
  emit(prefix);
  emit(eoiCode);
  if (accBits > 0) out.byte(acc & 0xff);
  return out.done();
}

/** Writes LZW bytes as GIF sub-blocks: [len][<=255 bytes]…, then a 0 terminator. */
function writeImageData(sink: ByteSink, minCodeSize: number, data: Uint8Array) {
  sink.byte(minCodeSize);
  for (let i = 0; i < data.length; i += 255) {
    const chunk = data.subarray(i, i + 255);
    sink.byte(chunk.length);
    sink.bytes(chunk);
  }
  sink.byte(0);
}

export function encodeGif(opts: GifOptions): Uint8Array {
  const { width, height, palette, frames, loop = 0 } = opts;
  const exp = tableSizeExp(palette.length);
  const gctLen = 1 << (exp + 1);
  // indices are drawn from the (padded) global table, so the LZW code size is
  // sized to it, never below the GIF minimum of 2
  const minCodeSize = Math.max(2, exp + 1);

  const sink = new ByteSink();
  sink.ascii("GIF89a");
  // logical screen descriptor
  sink.u16(width);
  sink.u16(height);
  sink.byte(0x80 | (exp << 4) | exp); // GCT present, colour resolution, GCT size
  sink.byte(0); // background colour index
  sink.byte(0); // pixel aspect ratio
  // global colour table, padded to its declared length
  for (let i = 0; i < gctLen; i++) {
    const c = palette[i] ?? [0, 0, 0];
    sink.byte(c[0]);
    sink.byte(c[1]);
    sink.byte(c[2]);
  }
  // NETSCAPE looping extension
  sink.byte(0x21);
  sink.byte(0xff);
  sink.byte(0x0b);
  sink.ascii("NETSCAPE2.0");
  sink.byte(0x03);
  sink.byte(0x01);
  sink.u16(loop);
  sink.byte(0x00);

  for (const frame of frames) {
    // graphic control extension: disposal 1 (leave in place), no transparency
    sink.byte(0x21);
    sink.byte(0xf9);
    sink.byte(0x04);
    sink.byte(0x04);
    sink.u16(Math.max(2, Math.round(frame.delayCs)));
    sink.byte(0x00); // transparent colour index (unused)
    sink.byte(0x00);
    // image descriptor
    sink.byte(0x2c);
    sink.u16(0);
    sink.u16(0);
    sink.u16(width);
    sink.u16(height);
    sink.byte(0x00); // no local colour table
    writeImageData(sink, minCodeSize, lzwEncode(frame.indices, minCodeSize));
  }

  sink.byte(0x3b); // trailer
  return sink.done();
}
