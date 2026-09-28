// Response curves for the analog inputs. A curve maps how far the stick or
// trigger is pushed to how much of it reaches the car:
//   linear       out = in
//   exponential  out = sign(in) * |in|^exponent
// An exponent above 1 softens small inputs (fine corrections on the straights)
// while still reaching full lock at the end of travel. Keys are always ±1, and
// ±1 maps to ±1 under every curve, so keyboard driving is unaffected.

export type RampMode = "linear" | "exponential";

export type Ramp = { mode: RampMode; exponent: number };

export const EXPONENT_MIN = 1;

export const EXPONENT_MAX = 4;

// The exponent is kept while the mode is linear, so flipping back to
// exponential restores whatever the player had dialled in.
export const DEFAULT_RAMP: Ramp = { mode: "linear", exponent: 2 };

export function applyRamp(value: number, ramp: Ramp): number {
  if (ramp.mode === "linear") return value;
  return Math.sign(value) * Math.abs(value) ** ramp.exponent;
}

// Whatever comes out of storage is untrusted: an older build, a hand edit, or
// nothing at all. Anything unusable falls back to the default.
export function parseRamp(stored: unknown): Ramp {
  if (!stored || typeof stored !== "object") return { ...DEFAULT_RAMP };
  const { mode, exponent } = stored as Partial<Ramp>;
  return {
    mode:
      mode === "linear" || mode === "exponential" ? mode : DEFAULT_RAMP.mode,
    exponent:
      typeof exponent === "number" && Number.isFinite(exponent)
        ? Math.min(Math.max(exponent, EXPONENT_MIN), EXPONENT_MAX)
        : DEFAULT_RAMP.exponent,
  };
}
