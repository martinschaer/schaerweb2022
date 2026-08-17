import Matter from "matter-js";
import * as THREE from "three";

import {
  BARRIER_HEIGHT,
  BARRIER_THICKNESS,
  SPACER,
  TRIM_SCALE,
} from "./constants";
import { barrierMaterial, trimMaterial } from "./materials";

type Game = {
  engine: { world: any };
  world: THREE.Group;
  color: string;
};

const CYLINDER_SEGMENTS = 16; // originally it was 20
// A ring, not a disc: capping a pillar with a solid emissive top turns it into
// a glowing puck and loses the whole silhouette. The width matches the strip
// running along a straight barrier, so a pillar reads as the same fitting
// wrapped round a circle.
const TRIM_WIDTH = BARRIER_THICKNESS * TRIM_SCALE;
// Clear of the pillar's own top face, which is coplanar with it.
const TRIM_Z_OFFSET = 0.05;

export default class Obstacle implements IBound {
  game: Game;

  color: string;

  x: number;

  y: number;

  d: number;

  body: Matter.Body;

  mesh: THREE.Group;

  constructor(game: Game, { x, y, d, c }: IObstacle) {
    this.game = game;
    this.color = c ?? game.color;
    this.x = x;
    this.y = y;
    this.d = d * SPACER + BARRIER_THICKNESS;
    this.body = Matter.Bodies.circle(x * SPACER, y * SPACER, this.d / 2, {
      isStatic: true,
    });
    Matter.World.add(this.game.engine.world, this.body);

    this.mesh = this.build();
    game.world.add(this.mesh);
  }

  private build(): THREE.Group {
    const group = new THREE.Group();
    const pos = this.body.position;
    group.position.set(pos.x, pos.y, 0);

    const radius = this.d / 2;

    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(
        radius,
        radius,
        BARRIER_HEIGHT,
        CYLINDER_SEGMENTS,
      ),
      barrierMaterial(this.color),
    );
    // three's cylinders run along Y; the game is Z-up — the same fixup the p5
    // build did with rotateX(PI / 2).
    post.rotation.x = Math.PI / 2;
    post.position.z = BARRIER_HEIGHT / 2;
    post.castShadow = true;
    post.receiveShadow = true;
    group.add(post);

    const trim = new THREE.Mesh(
      new THREE.RingGeometry(
        Math.max(radius - TRIM_WIDTH, radius * 0.5),
        radius,
        CYLINDER_SEGMENTS,
      ),
      trimMaterial(this.color),
    );
    // RingGeometry already lies in XY facing +Z, which is up here.
    trim.position.z = BARRIER_HEIGHT + TRIM_Z_OFFSET;
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
