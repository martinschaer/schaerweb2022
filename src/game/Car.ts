import Matter from "matter-js";
import p5 from "p5";

type Game = {
  engine: { world: any };
  is3D: boolean;
  models: { car: p5.Geometry | null };
  p5Instance?: p5;
};

export default class Car {
  game: Game;

  body: Matter.Body;

  color: string;

  turnFactor: number;

  accFactor: number;

  constructor(
    game: Game,
    { x, y, a = 0, c }: { x: number; y: number; a?: number; c: string },
  ) {
    this.game = game;
    this.color = c;
    this.body = Matter.Bodies.rectangle(x, y, 30, 40, { label: "car" });
    this.body.frictionAir = 0.08;
    this.turnFactor = 0.025;
    this.accFactor = 0.004;
    Matter.Body.setAngle(this.body, (Math.PI / 2) * ((a + 90) / 90));
    Matter.World.add(game.engine.world, this.body);
  }

  static show(x: number, y: number, a: number, color: string, game: Game) {
    if (!game.p5Instance) return;
    game.p5Instance.push();
    game.p5Instance.translate(x, y, game.is3D ? 10 : undefined);
    game.p5Instance.rotate(a);
    game.p5Instance.rectMode(p5.prototype.CENTER);
    game.p5Instance.noStroke();
    game.p5Instance.fill(color);
    if (game.is3D && game.models.car != null) {
      game.p5Instance.translate(0, 0, -10);
      game.p5Instance.scale(10);
      game.p5Instance.rotateX(Math.PI / 2);
      game.p5Instance.rotateY(Math.PI);
      game.p5Instance.model(game.models.car);
    } else {
      game.p5Instance.rect(0, 0, 30, 40);
    }
    game.p5Instance.pop();
  }

  show = () => {
    Car.show(
      this.body.position.x,
      this.body.position.y,
      this.body.angle,
      this.color,
      this.game,
    );
  };

  remove = () => {
    Matter.World.remove(this.game.engine.world, this.body);
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
