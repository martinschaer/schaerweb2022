import Matter from "matter-js";
import * as THREE from "three";

import { SPACER } from "./constants";
import { PALETTE, checkpointMaterial } from "./materials";

type Game = {
  engine: { world: any };
  world: THREE.Group;
  color: string;
};

const THICKNESS = 10;
// Set nearly flush with the floor, so a gate reads as an inlaid timing strip
// rather than a slab lying on top of the concrete.
const GATE_HEIGHT = 2;
const GATE_Z = 1;

export default class Checkpoint {
  game: Game;

  x: number;

  y: number;

  w: number;

  angle: number;

  body: Matter.Body;

  color: string;

  mesh: THREE.Mesh;

  constructor(game: Game, { x, y, w, a, label, c }: ICheckpoint) {
    this.game = game;
    this.color = c ?? PALETTE.cyan;
    this.x = x * SPACER;
    this.y = y * SPACER;
    this.w = w * SPACER;
    this.angle = (a * Math.PI) / 180;
    this.body = Matter.Bodies.rectangle(this.x, this.y, this.w, THICKNESS, {
      isStatic: true,
      isSensor: true,
      label,
    });
    Matter.Body.setAngle(this.body, this.angle);
    Matter.World.add(game.engine.world, this.body);

    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(this.w, THICKNESS, GATE_HEIGHT),
      checkpointMaterial(this.color),
    );
    this.mesh.position.set(this.x, this.y, GATE_Z);
    this.mesh.rotation.z = this.angle;
    game.world.add(this.mesh);
  }

  remove = () => {
    const { engine } = this.game;
    if (engine) Matter.World.remove(engine.world, this.body);
    this.game.world.remove(this.mesh);
    this.mesh.geometry.dispose();
  };
}
