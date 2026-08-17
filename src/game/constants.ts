// Shared barrier dimensions. These were copy-pasted into Wall.ts, Corner.ts and
// Obstacle.ts in the p5 build; they have to agree for the LED trim to sit at the
// same height all the way round a circuit, so they live in one place now.

// World units per circuit grid unit. Every coordinate in circuits/*.json is
// multiplied by this.
export const SPACER = 100;

export const BARRIER_THICKNESS = 20;
export const BARRIER_HEIGHT = 10;

// The emissive strip capping every barrier. Narrower than the barrier so the
// unlit shoulder either side reads as a channel the strip is set into.
export const TRIM_HEIGHT = 1.6;
export const TRIM_SCALE = 0.55;
