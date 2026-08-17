import Matter from "matter-js";
import * as THREE from "three";

import { carMaterial, ghostMaterial } from "./materials";

type Game = {
  engine: { world: any };
};

// The p5 build drew the model through
//   translate(x, y, 10) rotate(a) translate(0, 0, -10) scale(10)
//   rotateX(PI / 2) rotateY(PI)
// A rotation about Z leaves a Z-translation untouched, so the outer +10 and the
// inner -10 cancel: what is left is a mesh at (x, y, 0) turned by the body's
// angle, over a model that has been scaled and stood upright. Everything but
// the per-frame part is baked into the geometry once at load.
export function prepareCarGeometry(
  geometry: THREE.BufferGeometry,
): THREE.BufferGeometry {
  geometry.rotateY(Math.PI);
  geometry.rotateX(Math.PI / 2);
  geometry.scale(10, 10, 10);
  return geometry;
}

export default class Car {
  game: Game;

  body: Matter.Body;

  color: string;

  turnFactor: number;

  accFactor: number;

  // Null until the OBJ has loaded — the car's matter body is created in Game's
  // constructor so the circuit can be placed synchronously, long before the
  // renderer or the model exist.
  mesh: THREE.Mesh | null = null;

  constructor(
    game: Game,
    { x, y, a = 0, c }: { x: number; y: number; a?: number; c: string },
  ) {
    this.game = game;
    this.color = c;
    this.body = Matter.Bodies.rectangle(x, y, 30, 40, { label: "car" });
    // Handling. Physics runs at a fixed 60 steps/sec (see FIXED_DT in game.ts):
    //   steering rate = turnFactor * PI * 60 rad/s
    //   top speed     ∝ accFactor / frictionAir
    // frictionAir also sets how fast the velocity vector realigns with the
    // heading, which is what gives the car its drift.
    this.body.frictionAir = 0.08;

    // Starting values only — game.ts applies the active preset (see
    // DEFAULT_PRESETS) once the car exists, and the Handling controls
    // overwrite these live.
    this.turnFactor = 0.023;
    this.accFactor = 0.0036;

    Matter.Body.setAngle(this.body, (Math.PI / 2) * ((a + 90) / 90));
    Matter.World.add(game.engine.world, this.body);
  }

  attach(world: THREE.Group, geometry: THREE.BufferGeometry) {
    this.mesh = new THREE.Mesh(geometry, carMaterial(this.color));
    // The contact shadow under the car is what sells the scale: without it the
    // model reads as a sprite sliding over the floor rather than as a model car
    // sitting on it.
    this.mesh.castShadow = true;
    world.add(this.mesh);
    this.sync();
  }

  // The only per-frame render work in the game. Everything else on the circuit
  // is a static body whose transform was set when it was built.
  sync = () => {
    if (!this.mesh) return;
    const pos = this.body.position;
    this.mesh.position.set(pos.x, pos.y, 0);
    this.mesh.rotation.z = this.body.angle;
  };

  // The recorded best lap, replayed as a hologram. Shares the car's geometry,
  // so it costs one draw call and no memory.
  static createGhost(
    world: THREE.Group,
    geometry: THREE.BufferGeometry,
    color: string,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, ghostMaterial(color));
    mesh.visible = false;
    world.add(mesh);
    return mesh;
  }

  remove = () => {
    Matter.World.remove(this.game.engine.world, this.body);
    this.mesh?.removeFromParent();
  };

  turn = (dir: number) => {
    Matter.Body.setAngle(
      this.body,
      this.body.angle + Math.PI * this.turnFactor * dir,
    );
  };

  accelerate = () => {
    Matter.Body.applyForce(
      this.body,
      this.body.position,
      Matter.Vector.rotate({ x: 0, y: this.accFactor }, this.body.angle),
    );
  };

  reset = (x: number, y: number, a = 0) => {
    Matter.Body.setPosition(this.body, { x, y });
    Matter.Body.setAngle(this.body, (Math.PI / 2) * ((a + 90) / 90));
  };
}
