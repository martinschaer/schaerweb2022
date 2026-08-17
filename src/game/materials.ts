import * as THREE from "three";

// Every colour and material in the scene, created once and shared. In the p5
// build each show() re-issued fill()/specularMaterial() per frame, so nothing
// was ever allocated; three.js is retained-mode, and a MeshStandardMaterial per
// wall would mean a shader program permutation and a uniform upload per wall.
// Circuits may override colours per entity (the optional `c` field on IWall,
// ICorner, IObstacle, ICheckpoint), so the caches are keyed by colour.

// The site's palette. `dark` is the page background (global.css) and therefore
// also the fog colour, `cyan` the checkpoint/link accent, `green` the track.
export const PALETTE = {
  dark: "#111917",
  cyan: "#00f5e6",
  green: "#00ff7f",
} as const;

type Rgb = [number, number, number];

const hexToRgb = (hex: string): Rgb => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

export const mixHex = (from: string, to: string, t: number): string => {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const channel = (i: number) =>
    Math.round(a[i] + (b[i] - a[i]) * t)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(0)}${channel(1)}${channel(2)}`;
};

// One minor grid cell per circuit grid unit (SPACER = 100 world units), so the
// floor markings line up with the coordinates the circuit JSON is authored in
// and give the eye a scale reference — the thing that makes the cars read as
// R/C models rather than full-size.
export const FLOOR_CELL = 100;
const FLOOR_CELLS_PER_TILE = 4;
const FLOOR_TILE_PX = 512;
const FLOOR_CELL_PX = FLOOR_TILE_PX / FLOOR_CELLS_PER_TILE;

// The concrete is the page background lifted toward the accent. It has to sit
// far enough off `dark` that the light pools have somewhere to go before they
// clip — a steep falloff over a near-black floor reads as black everywhere —
// while staying on the dark-to-cyan line that keeps it inside the palette.
export const FLOOR_COLOR = mixHex(PALETTE.dark, PALETTE.cyan, 0.16);

let gridTexture: THREE.Texture | null = null;
let glowTexture: THREE.Texture | null = null;

// Painted rather than loaded: the whole thing is four colours and a noise
// pass, and shipping it as code keeps the game asset-free apart from car.obj.
function buildGridTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = FLOOR_TILE_PX;
  canvas.height = FLOOR_TILE_PX;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = FLOOR_COLOR;
  ctx.fillRect(0, 0, FLOOR_TILE_PX, FLOOR_TILE_PX);

  // Concrete tooth. Sparse and low-contrast on purpose: this is only ever seen
  // at a grazing angle under a coloured light, where a stronger grain turns
  // into visible tiling.
  ctx.fillStyle = "rgba(255, 255, 255, 0.025)";
  for (let i = 0; i < 5000; i += 1) {
    ctx.fillRect(
      Math.random() * FLOOR_TILE_PX,
      Math.random() * FLOOR_TILE_PX,
      1,
      1,
    );
  }

  ctx.strokeStyle = "rgba(0, 245, 230, 0.10)";
  ctx.lineWidth = 1;
  for (let i = 1; i < FLOOR_CELLS_PER_TILE; i += 1) {
    const p = i * FLOOR_CELL_PX + 0.5;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, FLOOR_TILE_PX);
    ctx.moveTo(0, p);
    ctx.lineTo(FLOOR_TILE_PX, p);
    ctx.stroke();
  }

  // Tile boundary, drawn brighter so the floor has a coarse rhythm as well as
  // a fine one. Offset by half a line width so it lands inside the tile and
  // isn't clipped by the wrap.
  ctx.strokeStyle = "rgba(0, 245, 230, 0.20)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(1, 0);
  ctx.lineTo(1, FLOOR_TILE_PX);
  ctx.moveTo(0, 1);
  ctx.lineTo(FLOOR_TILE_PX, 1);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Radial falloff for the additive sprites that stand in for a bloom pass. A
// real EffectComposer would need its own render target, which fights the
// transparent canvas this page composites over its own background.
function buildGlowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.12, "rgba(255, 255, 255, 0.55)");
  gradient.addColorStop(0.4, "rgba(255, 255, 255, 0.12)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function getGridTexture(): THREE.Texture {
  if (!gridTexture) gridTexture = buildGridTexture();
  return gridTexture;
}

export function getGlowTexture(): THREE.Texture {
  if (!glowTexture) glowTexture = buildGlowTexture();
  return glowTexture;
}

// Called once the renderer exists, since the useful ceiling is hardware
// dependent. The floor is seen almost edge-on at the far end of every circuit,
// which is exactly where isotropic filtering turns the grid into mush.
export function configureTextures(maxAnisotropy: number) {
  const texture = getGridTexture();
  texture.anisotropy = Math.min(8, maxAnisotropy);
  texture.needsUpdate = true;
}

const cache = new Map<string, THREE.Material>();

function cached<T extends THREE.Material>(key: string, build: () => T): T {
  const hit = cache.get(key);
  if (hit) return hit as T;
  const material = build();
  cache.set(key, material);
  return material;
}

// Track barriers: walls, corners and obstacles. Slightly metallic and fairly
// rough, so the spotlights read as broad sheen down the length of a barrier
// rather than as a mirror highlight sitting off to one side.
export const barrierMaterial = (color: string) =>
  cached(
    `barrier:${color}`,
    () =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.62,
        metalness: 0.18,
      }),
  );

// The LED strip capping every barrier — the single loudest "this is a modern
// indoor venue" cue in the scene, and one extra draw call per entity.
export const trimMaterial = (color: string) =>
  cached(
    `trim:${color}`,
    () =>
      new THREE.MeshStandardMaterial({
        color: PALETTE.dark,
        emissive: color,
        emissiveIntensity: 1.8,
        roughness: 0.4,
      }),
  );

// Timing gates, inlaid flush with the floor. Translucent so the grid still
// reads through them, emissive so they don't go dark between the light pools.
export const checkpointMaterial = (color: string) =>
  cached(
    `checkpoint:${color}`,
    () =>
      new THREE.MeshStandardMaterial({
        color: PALETTE.dark,
        emissive: color,
        emissiveIntensity: 1.1,
        transparent: true,
        opacity: 0.55,
        roughness: 0.5,
        depthWrite: false,
      }),
  );

// Lightly self-lit. A purely reflective shell disappears whenever the car is
// between two light pools, and losing the thing you are steering to a dark
// patch of floor is a gameplay bug, not a mood.
export const carMaterial = (color: string) =>
  cached(
    `car:${color}`,
    () =>
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.22,
        roughness: 0.38,
        metalness: 0.3,
      }),
  );

// The recorded best lap replayed as a hologram rather than as a second solid
// car, so it never reads as traffic to race against.
export const ghostMaterial = (color: string) =>
  cached(
    `ghost:${color}`,
    () =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
  );

export const poleMaterial = () =>
  cached(
    "pole",
    () =>
      new THREE.MeshStandardMaterial({
        color: PALETTE.dark,
        roughness: 0.8,
        metalness: 0.4,
      }),
  );

// DoubleSide because the camera looks down into the shade from above and up at
// its underside from across the circuit; a single-sided cone would vanish from
// one of the two.
export const shadeMaterial = () =>
  cached(
    "shade",
    () =>
      new THREE.MeshStandardMaterial({
        color: mixHex(PALETTE.dark, PALETTE.cyan, 0.08),
        roughness: 0.55,
        metalness: 0.5,
        side: THREE.DoubleSide,
      }),
  );

// Unlit on purpose: the bulb is the source, so shading it would be backwards.
export const bulbMaterial = () =>
  cached("bulb", () => new THREE.MeshBasicMaterial({ color: PALETTE.cyan }));

export const glowMaterial = (color: string) =>
  cached(
    `glow:${color}`,
    () =>
      new THREE.SpriteMaterial({
        map: getGlowTexture(),
        color,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
  );

// Sized per circuit (the plane spans the circuit bounds plus a margin), so
// unlike everything above this one is built fresh and disposed with its venue.
export function createFloorMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: "#ffffff", // the tint lives in the texture
    map: getGridTexture().clone(),
    roughness: 0.45,
    metalness: 0.12,
  });
}

// Teardown for the whole module. Only the web component's disconnectedCallback
// reaches here; the caches are global because the page never runs two games.
export function disposeMaterials() {
  cache.forEach((material) => material.dispose());
  cache.clear();
  gridTexture?.dispose();
  gridTexture = null;
  glowTexture?.dispose();
  glowTexture = null;
}
