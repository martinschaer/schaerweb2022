// Packing for ghost recordings sent to the leaderboard.
//
// A ghost is one {t, x, y, a} sample per fixed physics step, so a 30 s lap is
// ~1800 of them — far too much to ship as JSON. Two observations shrink it:
//
//   * `t` is redundant. Samples are exactly one FIXED_DT apart, so only the
//     first timestamp has to travel; the rest are reconstructed on decode.
//   * `x`, `y` and `a` do not need float precision. The car is 30x40 world
//     units and circuits span at most 2000, so 1/8-unit steps (an error of at
//     most 0.0625, under 0.2% of a car length) are indistinguishable on screen.
//
// That leaves 6 bytes per sample, base64'd into a single string field.

// Multiplied into an Int16, this covers +/-4095.875 world units at 0.125
// resolution. The widest circuit reaches 2000, so there is 2x headroom.
const POS_SCALE = 8;
const ANG_SCALE = 32767 / Math.PI;

const HEADER_BYTES = 2;
const SAMPLE_BYTES = 6;
const FORMAT_VERSION = 1;

// The `ghost` field accepts at most 131072 base64 characters, which is 98304
// packed bytes. Staying under it bounds the lap length we can submit; the
// schema's lap_ms ceiling (240 s => 14400 samples => 115200 chars) is the
// binding constraint, and this is the belt-and-braces check on the client.
export const MAX_GHOST_SAMPLES = 16000;

const clampInt16 = (v: number) => Math.max(-32768, Math.min(32767, Math.round(v)));

// Fold an angle into (-PI, PI] so it survives the Int16 mapping. matter-js lets
// body.angle accumulate past a full turn, which would otherwise overflow.
const wrapAngle = (a: number) => {
  const wrapped = ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  return wrapped - Math.PI;
};

const bytesToBase64 = (bytes: Uint8Array) => {
  // btoa takes a string, and spreading a 100 KB array into String.fromCharCode
  // blows the argument limit, so feed it in chunks.
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
};

const base64ToBytes = (b64: string) => {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

export type EncodedGhost = { data: string; t0: number };

export function encodeGhost(ghost: Array<IGhost>): EncodedGhost | null {
  if (ghost.length === 0 || ghost.length > MAX_GHOST_SAMPLES) return null;

  const buffer = new ArrayBuffer(HEADER_BYTES + ghost.length * SAMPLE_BYTES);
  const view = new DataView(buffer);
  view.setUint8(0, FORMAT_VERSION);
  view.setUint8(1, 0); // reserved

  ghost.forEach((sample, i) => {
    const at = HEADER_BYTES + i * SAMPLE_BYTES;
    view.setInt16(at, clampInt16(sample.x * POS_SCALE), true);
    view.setInt16(at + 2, clampInt16(sample.y * POS_SCALE), true);
    view.setInt16(at + 4, clampInt16(wrapAngle(sample.a) * ANG_SCALE), true);
  });

  return {
    data: bytesToBase64(new Uint8Array(buffer)),
    // t0 is the offset of the first sample within the lap: a fraction of a
    // step, never anywhere near a second.
    t0: Math.max(0, Math.round(ghost[0].t)),
  };
}

// `step` is the interval between samples (FIXED_DT). Returns an empty array for
// anything it cannot read, so a corrupt or future-format row simply means "no
// ghost" rather than a broken game.
export function decodeGhost(data: string, t0: number, step: number): Array<IGhost> {
  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(data);
  } catch {
    return [];
  }

  if (bytes.length < HEADER_BYTES) return [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint8(0) !== FORMAT_VERSION) return [];

  const count = Math.floor((bytes.length - HEADER_BYTES) / SAMPLE_BYTES);
  const ghost: Array<IGhost> = new Array(count);
  for (let i = 0; i < count; i += 1) {
    const at = HEADER_BYTES + i * SAMPLE_BYTES;
    ghost[i] = {
      t: t0 + i * step,
      x: view.getInt16(at, true) / POS_SCALE,
      y: view.getInt16(at + 2, true) / POS_SCALE,
      a: view.getInt16(at + 4, true) / ANG_SCALE,
    };
  }
  return ghost;
}
