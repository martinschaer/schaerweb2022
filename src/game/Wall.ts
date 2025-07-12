import Matter from "matter-js";
import p5 from "p5";

type Game = {
  engine: { world: any };
  is3D: boolean;
  p5Instance?: p5;
  color: string;
};

const THICKNESS = 20;
const HEIGHT = 10;
const SPACER = 100;

export default class Wall implements IBound {
  game: Game;

  l: number;

  cx: number;

  cy: number;

  angle: number;

  color: string;

  body: Matter.Body;

  constructor(game: Game, { x1, y1, x2, y2, c }: IWall) {
    this.game = game;
    this.color = c ?? game.color;
    const a = (x2 - x1) * SPACER;
    const b = (y2 - y1) * SPACER;
    this.l = Math.sqrt(a * a + b * b);
    // const d = Math.sqrt(b * b * hT * hT / (a * a + b * b))
    // const c = Math.sqrt(hT * hT - d * d)
    this.cx = a / 2;
    this.cy = b / 2;
    this.angle = Math.atan(b / a);
    this.body = Matter.Bodies.rectangle(
      x1 * SPACER + this.cx,
      y1 * SPACER + this.cy,
      this.l,
      THICKNESS,
      { isStatic: true },
    );
    Matter.Body.setAngle(this.body, this.angle);
    Matter.World.add(game.engine.world, this.body);
  }

  remove = () => {
    Matter.World.remove(this.game.engine.world, this.body);
  };

  show = () => {
    if (!this.game.p5Instance) return;
    const pos = this.body.position;
    this.game.p5Instance.push();
    this.game.p5Instance.translate(
      pos.x,
      pos.y,
      this.game.is3D ? HEIGHT / 2 : undefined,
    );
    this.game.p5Instance.fill(this.color);
    // this.game.p5Instance.noStroke();
    this.game.p5Instance.rectMode(p5.prototype.CENTER);
    if (this.game.is3D) {
      this.game.p5Instance.rotateZ(this.angle);
      this.game.p5Instance.box(this.l, THICKNESS, HEIGHT);
    } else {
      this.game.p5Instance.rotate(this.angle);
      this.game.p5Instance.rect(0, 0, this.l, THICKNESS);
    }
    this.game.p5Instance.pop();
  };
}
