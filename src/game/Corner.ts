import Matter from "matter-js";
import p5 from "p5";

type Game = {
  engine: { world: any };
  is3D: boolean;
  p5Instance?: p5;
  color: string;
  showStrokes: boolean;
};

const THICKNESS = 20;
const HEIGHT = 10;
const SPACER = 100;

// Winding direction of a closed 2D polygon, via its signed area. Needed to
// know which side of an edge faces outwards when building the side wall's
// normals; the sign convention is self-consistent regardless of the y-down
// coordinates the game uses.
const windingSign = (verts: Array<Matter.Vector>) => {
  let sum = 0;
  for (let i = 0; i < verts.length; i += 1) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum >= 0 ? 1 : -1;
};

const createCircleVertices = (
  r: number,
  deg = 90,
  faces = 5, // originally it was 10
  thickness = THICKNESS,
) => {
  const hT = thickness / 2;
  const vertices = [];
  for (let a = 0; a <= deg; a += deg / faces) {
    const x = Math.sin((a * p5.prototype.PI) / 180) * (r + hT);
    const y = -Math.cos((a * p5.prototype.PI) / 180) * (r + hT);
    vertices.push({ x, y });
  }
  for (let a = deg; a >= 0; a -= deg / faces) {
    const x = Math.sin((a * p5.prototype.PI) / 180) * (r - hT);
    const y = -Math.cos((a * p5.prototype.PI) / 180) * (r - hT);
    vertices.push({ x, y });
  }
  return vertices;
};

export default class Corner {
  game: Game;

  color: string;

  x: number;

  y: number;

  // r: number;

  a: number;

  vertices: Array<Matter.Vector>;

  winding: number;

  body: Matter.Body;

  constructor(game: Game, { x, y, r, a = 0, c }: ICorner) {
    this.game = game;
    this.color = c ?? game.color;
    this.x = x * SPACER;
    this.y = y * SPACER;
    // this.r = r;
    this.a = a;
    this.vertices = createCircleVertices(r * SPACER, 90);
    Matter.Vertices.rotate(this.vertices, (this.a * p5.prototype.PI) / 180, {
      x: 0,
      y: 0,
    });
    this.winding = windingSign(this.vertices);
    const center = Matter.Vertices.centre(this.vertices);
    this.body = Matter.Bodies.fromVertices(0, 0, [this.vertices], {
      isStatic: true,
    });
    Matter.Body.setPosition(this.body, {
      x: this.x + center.x,
      y: this.y + center.y,
    });
    Matter.World.add(this.game.engine.world, this.body);
  }

  remove = () => {
    Matter.World.remove(this.game.engine.world, this.body);
  };

  show = () => {
    if (!this.game.p5Instance) return;
    if (this.game.is3D) {
      this.game.p5Instance.push();
      this.game.p5Instance.translate(this.x, this.y, 0);
      this.game.p5Instance.fill(this.color);
      if (this.game.showStrokes) {
        this.game.p5Instance.stroke("#111917");
        this.game.p5Instance.strokeWeight(0.5);
      } else {
        this.game.p5Instance.noStroke();
      }

      // Side wall, one quad per perimeter edge so each gets its own flat
      // normal. p5 hands immediate-mode vertices whatever normal() was last
      // set to — (0, 0, 1) by default — and never derives them from the
      // geometry, so emitting this as one long strip lit every vertical face
      // as though it pointed at the sky. That matched the old flat ambient
      // rig but makes corners glow next to correctly shaded box() walls.
      const { length } = this.vertices;
      for (let i = 0; i < length; i += 1) {
        const a = this.vertices[i];
        const b = this.vertices[(i + 1) % length];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        if (len === 0) continue; // duplicate vertex at the arc seam
        const nx = ((dy / len) * this.winding);
        const ny = ((-dx / len) * this.winding);

        this.game.p5Instance.beginShape(p5.prototype.TRIANGLE_STRIP);
        this.game.p5Instance.normal(nx, ny, 0);
        this.game.p5Instance.vertex(a.x, a.y, 0);
        this.game.p5Instance.vertex(a.x, a.y, HEIGHT);
        this.game.p5Instance.vertex(b.x, b.y, 0);
        this.game.p5Instance.vertex(b.x, b.y, HEIGHT);
        this.game.p5Instance.endShape();
      }

      // top
      // this.game.p5Instance.beginShape(p5.prototype.TESS);
      this.game.p5Instance.beginShape();
      this.game.p5Instance.normal(0, 0, 1);
      this.vertices.forEach((v) => {
        this.game.p5Instance?.vertex(v.x, v.y, HEIGHT);
      });
      this.game.p5Instance.endShape(p5.prototype.CLOSE);

      this.game.p5Instance.pop();
    } else {
      this.game.p5Instance.push();
      this.game.p5Instance.translate(this.x, this.y);
      this.game.p5Instance.beginShape();
      this.vertices.forEach((v) => {
        this.game.p5Instance?.vertex(v.x, v.y);
      });
      this.game.p5Instance.endShape(p5.prototype.CLOSE);
      this.game.p5Instance.pop();
    }
  };
}
