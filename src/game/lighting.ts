import p5 from "p5";

// "Realistic" night lighting: dark ambient, exponential distance fog, and four
// warm lamp posts standing at the corners of whatever circuit is loaded. The
// basic mode (flat grey ambient + one static point light) stays in game.ts so
// its exact call order is preserved.

export type LightingMode = "basic" | "realistic";

export interface IBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ILamp {
  x: number;
  y: number;
}

// The site's palette, and the single source of truth for every colour this
// module introduces. `dark` is the page background (global.css), `cyan` the
// checkpoint/link accent, `green` the track. Nothing here re-declares green:
// it already arrives on the geometry as game.color, and the lamps are cyan so
// the light reads as a different element from the surface it falls on.
const PALETTE = {
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

const mixHex = (from: string, to: string, t: number): string => {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const channel = (i: number) =>
    Math.round(a[i] + (b[i] - a[i]) * t)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(0)}${channel(1)}${channel(2)}`;
};

const dim = (rgb: Rgb, k: number): Rgb =>
  rgb.map((v) => Math.round(v * k)) as Rgb;

// All distances are world units, i.e. circuit grid units x SPACER (100).
// The posts are tall on purpose: a corner lamp lighting the far side of the
// track at a shallow angle gives a tiny N.L and the whole scene goes black, so
// the height has to be a real fraction of the circuit's size to get the light
// coming down onto the tarmac rather than skimming across it.
const LAMP_HEIGHT = 260;
const LAMP_MARGIN = 150; // pushes the posts off the racing line
// Chunky on purpose: the posts stand at the far corners of a circuit that can
// be 2200 units across, so anything slender is sub-pixel from the camera.
const POLE_RADIUS = 9;
const POLE_DETAIL = 8;
// The pole is the page background colour, so it reads as a silhouette cut out
// of the lit ground rather than as an object with its own material.
const POLE_COLOR = PALETTE.dark;
const BULB_RADIUS = 22;
const BULB_DETAIL = 12;
const BULB_COLOR = PALETTE.cyan;

const GROUND_Z = -0.5; // just under the walls (z 0..10) and checkpoints (z 1)
// Deliberately far past the track: the plane has to run out beyond the point
// where the fog has gone fully opaque, otherwise its far edge reads as a hard
// horizon line. It costs two triangles, so there is no reason to be stingy.
const GROUND_MARGIN = 1500;
// The page background pulled a little way toward the accent. The mix has to be
// far enough off `dark` that the pools have somewhere to go before they clip —
// a steep falloff over a near-black floor just reads as black everywhere — but
// staying on the dark-to-cyan line keeps the tarmac inside the palette.
const GROUND_COLOR = mixHex(PALETTE.dark, PALETTE.cyan, 0.28);

// Ambient is the page background at low intensity, which is both on-palette
// and the physically sensible choice: ambient stands in for light bouncing off
// the surroundings, and the surroundings here are exactly the fog colour.
const AMBIENT: Rgb = dim(hexToRgb(PALETTE.dark), 0.55);
const LAMP_COLOR: Rgb = hexToRgb(PALETTE.cyan);

// Light falloff is 1 / (constant + quadratic * d^2).
//
// Both numbers exist to make the light look like it has a source. Four lamps
// spaced symmetrically around the track will always sum to something close to
// uniform unless each one falls off hard, so the quadratic term is set steep:
// it reaches FALLOFF_AT_CENTRE at the circuit's half-diagonal, which is also
// what keeps a small circuit and a large one equally lit.
//
// Steep falloff alone would just make everything dark, so the constant is
// dropped below 1. It caps near-field attenuation at 1/constant instead of 1,
// which brightens the pool directly under each lamp without touching the rate
// at which the light dies off with distance. Together they give roughly a 4x
// range between standing under a lamp and standing mid-circuit; at 1.0/0.8 it
// was 2x and read as flat ambient.
const LAMP_FALLOFF_CONSTANT = 0.25;
const FALLOFF_AT_CENTRE = 3;

// exp2 fog on eye distance. Unlike the falloff above this is a constant: the
// camera sits a fixed 400 units up (createCamera in game.ts) and only ever
// rotates, so eye distances run roughly 400..1600 on every circuit.
const FOG_DENSITY = 0.0007;
// Deliberately the site's own page background. Geometry and the ground plane
// both dissolve into exactly the colour showing through the transparent
// canvas, so the edge of the plane is invisible by construction rather than by
// being pushed far enough away.
const FOG_COLOR: Rgb = hexToRgb(PALETTE.dark);

// Scans the circuit geometry for its extent. No circuit JSON declares one, and
// the lamp posts need to know where the corners are.
export function getCircuitBounds(circuit: ICircuit, spacer: number): IBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const add = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  circuit.walls.forEach(({ x1, y1, x2, y2 }) => {
    add(x1, y1);
    add(x2, y2);
  });
  circuit.corners.forEach(({ x, y, r }) => {
    add(x - r, y - r);
    add(x + r, y + r);
  });
  circuit.obstacles.forEach(({ x, y, d }) => {
    add(x - d / 2, y - d / 2);
    add(x + d / 2, y + d / 2);
  });
  add(circuit.car.x, circuit.car.y);
  add(circuit.finish.x, circuit.finish.y);

  // A circuit with no geometry at all would leave these at +-Infinity.
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };

  return {
    minX: minX * spacer,
    minY: minY * spacer,
    maxX: maxX * spacer,
    maxY: maxY * spacer,
  };
}

export function getLampPositions(bounds: IBounds): Array<ILamp> {
  const x0 = bounds.minX - LAMP_MARGIN;
  const x1 = bounds.maxX + LAMP_MARGIN;
  const y0 = bounds.minY - LAMP_MARGIN;
  const y1 = bounds.maxY + LAMP_MARGIN;
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

interface IFogShaders {
  material: p5.Shader;
  stroke: p5.Shader;
}

// Built once, lazily: baseMaterialShader() needs a live WEBGL context, so this
// can't run before createCanvas().
let fogShaders: IFogShaders | null = null;
let fogShadersFailed = false;

// Fog distance is measured in world space against the camera's eye rather
// than by taking length() of a camera-space position, because the obvious
// camera-space route is unusable here: p5 2.0.3's line vertex shader invokes
// the getCameraInputs hook as the raw identifier `hook_getCameraInputs`
// instead of the `HOOK_getCameraInputs` macro every sibling call site uses, so
// hooking StrokeVertex getCameraInputs fails to compile. getWorldInputs is
// wired up correctly in both shaders, and distance-to-eye in world space is
// identical to length-in-camera-space anyway (the view matrix is rigid).
const worldFogHook = (vertexType: string) => `(${vertexType} inputs) {
  vFogDist = distance(inputs.position, uCameraPos);
  return inputs;
}`;

// getFinalColor receives the fully lit, composited colour, so the haze sits on
// top of the lighting result rather than being lit itself.
//
// The two shaders disagree on alpha: phongFrag premultiplies *after* the hook,
// so its colour arrives straight, while lineFrag premultiplies *before*, so
// the fog colour has to be premultiplied to match.
const finalColorHook = (premultiplied: boolean) => `(vec4 color) {
  float f = 1.0 - exp(-uFogDensity * uFogDensity * vFogDist * vFogDist);
  vec3 fog = uFogColor${premultiplied ? " * color.a" : ""};
  return vec4(mix(color.rgb, fog, clamp(f, 0.0, 1.0)), color.a);
}`;

// Fogging the strokes as well as the fills matters: without it the "#222"
// outlines on every wall, corner and obstacle stay crisp at distance while
// their fills haze, which reads as broken immediately.
export function getFogShaders(
  p: p5,
  getEye: () => [number, number, number],
): IFogShaders | null {
  if (fogShaders || fogShadersFailed) return fogShaders;

  const uniforms = {
    "float uFogDensity": () => FOG_DENSITY,
    "vec3 uFogColor": () => FOG_COLOR.map((c) => c / 255),
    "vec3 uCameraPos": getEye,
  };
  const declarations = {
    vertexDeclarations: "out float vFogDist;\nuniform vec3 uCameraPos;",
    fragmentDeclarations: "in float vFogDist;",
  };

  try {
    const material = p.baseMaterialShader().modify({
      uniforms,
      ...declarations,
      "Vertex getWorldInputs": worldFogHook("Vertex"),
      "vec4 getFinalColor": finalColorHook(false),
    });
    const stroke = p.baseStrokeShader().modify({
      uniforms,
      ...declarations,
      "StrokeVertex getWorldInputs": worldFogHook("StrokeVertex"),
      "vec4 getFinalColor": finalColorHook(true),
    });

    // p5 compiles lazily on first bind, which would put any GLSL error inside
    // draw() where it kills the whole sketch. Force it here so the catch below
    // can actually do its job.
    material.init();
    stroke.init();

    fogShaders = { material, stroke };
  } catch (error) {
    // WebGL1, perPixelLighting turned off, or a GLSL compile error. Degrade to
    // realistic lighting without fog rather than a dead draw loop.
    console.warn("Fog shaders unavailable, continuing without fog", error);
    fogShadersFailed = true;
    fogShaders = null;
  }

  return fogShaders;
}

// originX/originY are the world translation already applied to the scene.
// They have to be added back onto each lamp by hand because p5 does NOT run
// light positions through the model matrix: pointLight() stores the raw x/y/z
// it is given, and the shader transforms them by uViewMatrix alone. A
// translate() before the call moves the geometry but leaves the lights behind,
// which silently puts every lamp's light hundreds of units away from its post.
export function applyRealisticLighting(
  p: p5,
  bounds: IBounds,
  lamps: Array<ILamp>,
  originX: number,
  originY: number,
) {
  p.ambientLight(AMBIENT[0], AMBIENT[1], AMBIENT[2], 255);

  const halfDiagonal = Math.max(
    Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 2,
    1,
  );
  p.lightFalloff(
    LAMP_FALLOFF_CONSTANT,
    0,
    FALLOFF_AT_CENTRE / (halfDiagonal * halfDiagonal),
  );

  lamps.forEach(({ x, y }) => {
    p.pointLight(
      LAMP_COLOR[0],
      LAMP_COLOR[1],
      LAMP_COLOR[2],
      x + originX,
      y + originY,
      LAMP_HEIGHT,
    );
  });

  // Wet-tarmac sheen, kept deliberately weak and broad. A mirror highlight sits
  // partway between the lamp and the camera, not under the lamp — with a light
  // at LAMP_HEIGHT and the camera at 400, roughly 40% of the way across — and
  // p5 multiplies specular by 2.0 internally. Turned up, that offset blob
  // outshines the diffuse pool and the light stops looking like it belongs to
  // the post above it. Diffuse has to stay dominant.
  //
  // Set outside every object's own push(), so Wall, Corner, Obstacle,
  // Checkpoint and Car all inherit it without needing to know a lighting mode
  // exists. It cannot leak into basic mode: draw() wraps the whole frame in
  // push()/pop(), which restores the material and falloff state that p5's
  // per-frame _update() leaves alone.
  p.specularMaterial(30, 255);
  p.shininess(16);
}

export function drawGround(p: p5, bounds: IBounds) {
  const width = bounds.maxX - bounds.minX + GROUND_MARGIN * 2;
  const height = bounds.maxY - bounds.minY + GROUND_MARGIN * 2;

  p.push();
  p.translate(
    (bounds.minX + bounds.maxX) / 2,
    (bounds.minY + bounds.maxY) / 2,
    GROUND_Z,
  );
  p.noStroke();
  // Overrides the sheen set in applyRealisticLighting, for this surface only
  // (push/pop keeps it from reaching anything else). The ground is by far the
  // largest thing on screen, so it is where an off-centre mirror highlight is
  // visible as a bright patch sitting away from any lamp. Keeping the tarmac
  // near-diffuse leaves the pool centred under the post where it belongs.
  p.specularMaterial(6, 255);
  p.shininess(8);
  p.fill(GROUND_COLOR);
  // plane() already lies in XY, matching the game's Z-up convention. Lighting
  // is per-fragment, so two triangles are enough for smooth light pools, and
  // the fog fades the far edge out before it can read as a rectangle.
  p.plane(width, height, 1, 1);
  p.pop();
}

export function drawLampPost(p: p5, { x, y }: ILamp) {
  p.push();
  p.noStroke();
  p.fill(POLE_COLOR);
  p.translate(x, y, LAMP_HEIGHT / 2);
  // cylinder() runs along Y and the game is Z-up — same fixup Obstacle.show()
  // already does.
  p.rotateX(Math.PI / 2);
  p.cylinder(POLE_RADIUS, LAMP_HEIGHT, POLE_DETAIL, 1, true, true);
  p.pop();

  p.push();
  p.noStroke();
  p.translate(x, y, LAMP_HEIGHT);
  // Emissive so the bulb reads as the source itself rather than as a lit
  // object, and blooms through the fog.
  p.emissiveMaterial(BULB_COLOR);
  p.fill(BULB_COLOR);
  p.sphere(BULB_RADIUS, BULB_DETAIL, BULB_DETAIL);
  p.pop();
}
