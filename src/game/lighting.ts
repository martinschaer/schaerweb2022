import * as THREE from "three";

import {
  FLOOR_CELL,
  PALETTE,
  bulbMaterial,
  createFloorMaterial,
  glowMaterial,
  mixHex,
  poleMaterial,
  shadeMaterial,
} from "./materials";

// The venue: a concrete floor, four pendant lamps hanging over the circuit, and
// the lights they carry. The room is never modelled — exp2 fog in the page's own
// background colour (see view.ts) eats the floor's far edge, so what reads as
// "underground" is the absence of anything beyond the light pools.

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

// All distances are world units, i.e. circuit grid units x SPACER (100).
//
// The lamps hang high enough that light comes down onto the track rather than
// skimming across it — a lamp lighting the far side of the circuit at a shallow
// angle gives a tiny N.L and the whole scene goes black — but strictly below
// the camera's 400, so a pendant hanging over the far corner never swings
// between the camera and the car.
const LAMP_HEIGHT = 340;
const LAMP_MARGIN = 150; // pushes the lamps off the racing line

const CABLE_RADIUS = 2.5;
// Runs from the shade up past the top of the frustum. There is no ceiling to
// meet; the fog takes it before it ends.
const CABLE_LENGTH = 320;
const SHADE_RADIUS_TOP = 9;
const SHADE_RADIUS_BOTTOM = 42;
const SHADE_HEIGHT = 36;
const SHADE_SEGMENTS = 16;
const BULB_RADIUS = 15;
const BULB_DETAIL = 12;
// Stands in for a bloom pass. Sized against the shade so the glow looks like it
// is spilling out of the fitting rather than hovering near it.
const GLOW_SIZE = SHADE_RADIUS_BOTTOM * 5;

const FLOOR_Z = -0.5; // just under the barriers (z 0..10) and gates (z 1)
// Deliberately far past the track: the floor has to run out beyond the point
// where the fog has gone fully opaque, otherwise its edge reads as a horizon.
// It costs two triangles.
const FLOOR_MARGIN = 1500;
const FLOOR_TILE = FLOOR_CELL * 4; // one texture tile spans four grid cells

// Ambient stands in for light bouncing around the room. Kept on the palette's
// dark-to-cyan line and very low: it exists to keep the barriers' shadowed
// faces from going to absolute black, not to light the scene.
const AMBIENT_COLOR = mixHex(PALETTE.dark, PALETTE.cyan, 0.12);
const AMBIENT_INTENSITY = 1.4;

const LAMP_COLOR = PALETTE.cyan;
// Wide enough to reach from directly under a lamp out across the circuit.
// Corner-mounted lamps at LAMP_HEIGHT need most of the available half-angle;
// the penumbra keeps the cone's edge from drawing a hard ellipse on the floor.
const LAMP_ANGLE = 1.25;
const LAMP_PENUMBRA = 0.45;
const LAMP_DECAY = 2;

// Target combined irradiance at the circuit centre, in three's physical units.
// Intensity is then solved per circuit from the lamp-to-centre distance, which
// is what keeps a small circuit and a large one equally lit — the job the
// p5 build's lightFalloff(constant, 0, k/halfDiagonal^2) used to do.
//
// The ceiling on this is the barriers, not the floor: track green is very
// nearly full reflectance in its green channel, so a lit barrier reaches
// albedo/PI * E and clips to a flat neon slab once E passes ~3. Everything
// stays under that, and the emissive trim is what carries the brightness.
const LAMP_TARGET_IRRADIANCE = 1.6;

const SHADOW_MAP_SIZE = 2048;
// World units here run to thousands, so three's defaults (tuned for scenes a
// few units across) leave shadow acne all over the floor.
const SHADOW_BIAS = -0.0005;
const SHADOW_NORMAL_BIAS = 2;
// Widens the PCF kernel. A hard-edged shadow under a barrier reads as painted
// on; these lamps are broad fittings a long way off, so their shadows should
// not be crisper than the penumbra of the cone casting them.
const SHADOW_RADIUS = 3;

// Scans the circuit geometry for its extent. No circuit JSON declares one, and
// the lamps need to know where the corners are.
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

export interface IVenue {
  group: THREE.Group;
  dispose: () => void;
}

function buildFloor(bounds: IBounds): THREE.Mesh {
  const width = bounds.maxX - bounds.minX + FLOOR_MARGIN * 2;
  const height = bounds.maxY - bounds.minY + FLOOR_MARGIN * 2;
  const centreX = (bounds.minX + bounds.maxX) / 2;
  const centreY = (bounds.minY + bounds.maxY) / 2;

  const material = createFloorMaterial();
  const map = material.map!;
  map.repeat.set(width / FLOOR_TILE, height / FLOOR_TILE);
  // Anchors the grid to the world origin instead of to the plane's own corner,
  // so the floor markings line up with the circuit's coordinates whatever
  // extent the circuit happens to have.
  map.offset.set(
    (centreX - width / 2) / FLOOR_TILE,
    (centreY - height / 2) / FLOOR_TILE,
  );

  // PlaneGeometry already lies in XY, matching the game's Z-up convention.
  // Lighting is per-fragment, so two triangles are enough for smooth pools.
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.position.set(centreX, centreY, FLOOR_Z);
  mesh.receiveShadow = true;
  return mesh;
}

// Cable, shade, bulb and glow. Nothing here casts a shadow: every piece sits at
// or above the light it belongs to, so it could only ever shadow itself.
function buildPendant({ x, y }: ILamp): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, y, 0);

  const cable = new THREE.Mesh(
    new THREE.CylinderGeometry(CABLE_RADIUS, CABLE_RADIUS, CABLE_LENGTH, 6),
    poleMaterial(),
  );
  // three's cylinders run along Y; the game is Z-up.
  cable.rotation.x = Math.PI / 2;
  cable.position.z = LAMP_HEIGHT + SHADE_HEIGHT + CABLE_LENGTH / 2;
  group.add(cable);

  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(
      SHADE_RADIUS_TOP,
      SHADE_RADIUS_BOTTOM,
      SHADE_HEIGHT,
      SHADE_SEGMENTS,
      1,
      true,
    ),
    shadeMaterial(),
  );
  shade.rotation.x = Math.PI / 2;
  shade.position.z = LAMP_HEIGHT + SHADE_HEIGHT / 2;
  group.add(shade);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(BULB_RADIUS, BULB_DETAIL, BULB_DETAIL),
    bulbMaterial(),
  );
  bulb.position.z = LAMP_HEIGHT;
  group.add(bulb);

  const glow = new THREE.Sprite(glowMaterial(LAMP_COLOR));
  glow.scale.set(GLOW_SIZE, GLOW_SIZE, 1);
  glow.position.z = LAMP_HEIGHT;
  group.add(glow);

  return group;
}

function buildSpot(
  lamp: ILamp,
  centreX: number,
  centreY: number,
  intensity: number,
  shadowFar: number,
): THREE.SpotLight {
  const light = new THREE.SpotLight(
    LAMP_COLOR,
    intensity,
    0, // no cutoff distance; the inverse-square decay does the work
    LAMP_ANGLE,
    LAMP_PENUMBRA,
    LAMP_DECAY,
  );
  light.position.set(lamp.x, lamp.y, LAMP_HEIGHT);
  light.target.position.set(centreX, centreY, 0);

  light.castShadow = true;
  light.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
  light.shadow.camera.near = 40;
  light.shadow.camera.far = shadowFar;
  light.shadow.bias = SHADOW_BIAS;
  light.shadow.normalBias = SHADOW_NORMAL_BIAS;
  light.shadow.radius = SHADOW_RADIUS;

  return light;
}

// Built once per circuit — createElements() in game.ts rebuilds it whenever the
// bounds change, and disposes the previous one.
export function buildVenue(bounds: IBounds): IVenue {
  const group = new THREE.Group();
  const centreX = (bounds.minX + bounds.maxX) / 2;
  const centreY = (bounds.minY + bounds.maxY) / 2;

  const floor = buildFloor(bounds);
  group.add(floor);
  group.add(new THREE.AmbientLight(AMBIENT_COLOR, AMBIENT_INTENSITY));

  const lamps = getLampPositions(bounds);
  // Symmetric rig, so one distance covers all four. Solving intensity from it
  // (E = 4 * I * cos / d^2, with cos = LAMP_HEIGHT / d at the centre) is what
  // makes Drift Park and the Seoul circuit come out equally lit.
  const distance = Math.hypot(
    lamps[0].x - centreX,
    lamps[0].y - centreY,
    LAMP_HEIGHT,
  );
  const intensity =
    (LAMP_TARGET_IRRADIANCE * distance ** 3) / (4 * LAMP_HEIGHT);
  const shadowFar = Math.max(distance * 2.6, 2000);

  lamps.forEach((lamp) => {
    group.add(buildPendant(lamp));
    const light = buildSpot(lamp, centreX, centreY, intensity, shadowFar);
    group.add(light);
    // A SpotLight aims at its target's world position, and a target that is not
    // in the scene never gets its matrix updated.
    group.add(light.target);
  });

  const dispose = () => {
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
      if (object instanceof THREE.SpotLight) object.shadow.dispose();
    });
    // The floor is the only thing here that owns its material, because its
    // texture carries a per-circuit repeat and offset. Everything else draws
    // from the shared cache in materials.ts and must outlive this venue.
    const floorMaterial = floor.material as THREE.MeshStandardMaterial;
    floorMaterial.map?.dispose();
    floorMaterial.dispose();
    group.clear();
  };

  return { group, dispose };
}
