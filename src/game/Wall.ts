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

export default class Wall implements IBound {
  game: Game;

  l: number;

  cx: number;

  cy: number;

  angle: number;

  color: string;

  body: Matter.Body;

  mesh: THREE.Group;

  constructor(game: Game, { x1, y1, x2, y2, c }: IWall) {
    this.game = game;
    this.color = c ?? game.color;
    const a = (x2 - x1) * SPACER;
    const b = (y2 - y1) * SPACER;
    this.l = Math.sqrt(a * a + b * b);
    this.cx = a / 2;
    this.cy = b / 2;
    this.angle = Math.atan(b / a);
    this.body = Matter.Bodies.rectangle(
      x1 * SPACER + this.cx,
      y1 * SPACER + this.cy,
      this.l,
      BARRIER_THICKNESS,
      { isStatic: true },
    );
    Matter.Body.setAngle(this.body, this.angle);
    Matter.World.add(game.engine.world, this.body);

    this.mesh = this.build();
    game.world.add(this.mesh);
  }

  // Static body, so the transform is set once here rather than per frame. This
  // is the whole point of the move off p5: a wall costs nothing to draw again
  // once it exists.
  private build(): THREE.Group {
    const group = new THREE.Group();
    const pos = this.body.position;
    group.position.set(pos.x, pos.y, 0);
    group.rotation.z = this.angle;

    const barrier = new THREE.Mesh(
      new THREE.BoxGeometry(this.l, BARRIER_THICKNESS, BARRIER_HEIGHT),
      barrierMaterial(this.color),
    );
    barrier.position.z = BARRIER_HEIGHT / 2;
    barrier.castShadow = true;
    barrier.receiveShadow = true;
    group.add(barrier);

    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(
        this.l,
        BARRIER_THICKNESS * TRIM_SCALE,
        TRIM_HEIGHT,
      ),
      trimMaterial(this.color),
    );
    trim.position.z = BARRIER_HEIGHT + TRIM_HEIGHT / 2;
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
