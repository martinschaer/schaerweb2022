import Matter from "matter-js";
import * as THREE from "three";

import {
  BARRIER_HEIGHT,
  BARRIER_THICKNESS,
  SPACER,
  TRIM_HEIGHT,
  TRIM_SCALE,
} from "./constants";
import { barrierMaterial, trimMaterial } from "./materials";

type Game = {
  engine: { world: any };
  world: THREE.Group;
  color: string;
};

const FACES = 5; // originally it was 10

// An arc-shaped band: out along the outer radius, back along the inner one.
// Doubles as the matter-js collision hull and, extruded, as the mesh.
const createCircleVertices = (
  r: number,
  deg = 90,
  faces = FACES,
  thickness = BARRIER_THICKNESS,
) => {
  const hT = thickness / 2;
  const vertices = [];
  for (let a = 0; a <= deg; a += deg / faces) {
    const x = Math.sin((a * Math.PI) / 180) * (r + hT);
    const y = -Math.cos((a * Math.PI) / 180) * (r + hT);
    vertices.push({ x, y });
  }
  for (let a = deg; a >= 0; a -= deg / faces) {
    const x = Math.sin((a * Math.PI) / 180) * (r - hT);
    const y = -Math.cos((a * Math.PI) / 180) * (r - hT);
    vertices.push({ x, y });
  }
  return vertices;
};

// A repeated point at the arc seam would hand earcut a degenerate ear and can
// drop a triangle out of the extruded cap.
const toShape = (vertices: Array<Matter.Vector>): THREE.Shape => {
  const points: Array<THREE.Vector2> = [];
  vertices.forEach(({ x, y }) => {
    const last = points[points.length - 1];
    if (last && Math.abs(last.x - x) < 1e-6 && Math.abs(last.y - y) < 1e-6) {
      return;
    }
    points.push(new THREE.Vector2(x, y));
  });
  return new THREE.Shape(points);
};

const EXTRUDE = { bevelEnabled: false, steps: 1 } as const;

export default class Corner implements IBound {
  game: Game;

  color: string;

  x: number;

  y: number;

  a: number;

  vertices: Array<Matter.Vector>;

  body: Matter.Body;

  mesh: THREE.Group;

  constructor(game: Game, { x, y, r, a = 0, c }: ICorner) {
    this.game = game;
    this.color = c ?? game.color;
    this.x = x * SPACER;
    this.y = y * SPACER;
    this.a = a;
    const angle = (this.a * Math.PI) / 180;

    this.vertices = createCircleVertices(r * SPACER, 90);
    Matter.Vertices.rotate(this.vertices, angle, { x: 0, y: 0 });

    // A second, thinner band on the same arc. Insetting an arbitrary polygon is
    // fiddly; regenerating it from the same helper with a smaller thickness is
    // exact and costs one more loop.
    const trimVertices = createCircleVertices(
      r * SPACER,
      90,
      FACES,
      BARRIER_THICKNESS * TRIM_SCALE,
    );
    Matter.Vertices.rotate(trimVertices, angle, { x: 0, y: 0 });

    this.body = Matter.Bodies.fromVertices(0, 0, [this.vertices], {
      isStatic: true,
    });
    const center = Matter.Vertices.centre(this.vertices);
    Matter.Body.setPosition(this.body, {
      x: this.x + center.x,
      y: this.y + center.y,
    });
    Matter.World.add(this.game.engine.world, this.body);

    this.mesh = this.build(trimVertices);
    game.world.add(this.mesh);
  }

  // ExtrudeGeometry extrudes a flat XY shape along +Z, which is exactly the
  // game's convention, and produces non-indexed geometry — so its automatic
  // computeVertexNormals() gives each face its own flat normal. That replaces
  // the hand-rolled TRIANGLE_STRIP-per-edge loop the p5 build needed, because
  // p5 handed immediate-mode vertices whatever normal() was last set to and
  // never derived them from the geometry.
  private build(trimVertices: Array<Matter.Vector>): THREE.Group {
    const group = new THREE.Group();
    group.position.set(this.x, this.y, 0);

    const barrier = new THREE.Mesh(
      new THREE.ExtrudeGeometry(toShape(this.vertices), {
        ...EXTRUDE,
        depth: BARRIER_HEIGHT,
      }),
      barrierMaterial(this.color),
    );
    barrier.castShadow = true;
    barrier.receiveShadow = true;
    group.add(barrier);

    const trim = new THREE.Mesh(
      new THREE.ExtrudeGeometry(toShape(trimVertices), {
        ...EXTRUDE,
        depth: TRIM_HEIGHT,
      }),
      trimMaterial(this.color),
    );
    trim.position.z = BARRIER_HEIGHT;
    group.add(trim);

    return group;
  }

  remove = () => {
    Matter.World.remove(this.game.engine.world, this.body);
    this.game.world.remove(this.mesh);
    this.mesh.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
  };
}
