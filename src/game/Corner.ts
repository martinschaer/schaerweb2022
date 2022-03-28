import Matter from 'matter-js'
import p5 from 'p5'
import { ICorner } from './game.d'

type Game = {
  engine: { world: any }
  is3D: boolean
  p5Instance: p5
  color: string
}

const THICKNESS = 20
const SPACER = 100

const createCircleVertices = (
  r: number,
  deg = 90,
  faces = 10,
  thickness = THICKNESS
) => {
  const hT = thickness / 2
  const vertices = []
  for (let a = 0; a <= deg; a += deg / faces) {
    const x = Math.sin((a * p5.prototype.PI) / 180) * (r + hT)
    const y = -Math.cos((a * p5.prototype.PI) / 180) * (r + hT)
    vertices.push({ x, y })
  }
  for (let a = deg; a >= 0; a -= deg / faces) {
    const x = Math.sin((a * p5.prototype.PI) / 180) * (r - hT)
    const y = -Math.cos((a * p5.prototype.PI) / 180) * (r - hT)
    vertices.push({ x, y })
  }
  return vertices
}

export default class Corner {
  game: Game

  color: string

  x: number

  y: number

  r: number

  a: number

  vertices: Array<Matter.Vector>

  body: Matter.Body

  constructor(game: Game, { x, y, r, a = 0, c }: ICorner) {
    this.game = game
    this.color = c ?? game.color
    this.x = x * SPACER
    this.y = y * SPACER
    this.a = a
    this.vertices = createCircleVertices(r * SPACER, 90)
    Matter.Vertices.rotate(this.vertices, (this.a * p5.prototype.PI) / 180, {
      x: 0,
      y: 0,
    })
    const center = Matter.Vertices.centre(this.vertices)
    this.body = Matter.Bodies.fromVertices(0, 0, [this.vertices], {
      isStatic: true,
    })
    Matter.Body.setPosition(this.body, {
      x: this.x + center.x,
      y: this.y + center.y,
    })
    Matter.World.add(this.game.engine.world, this.body)
  }

  remove = () => {
    Matter.World.remove(this.game.engine.world, this.body)
  }

  show = () => {
    this.game.p5Instance.fill(this.color)
    this.game.p5Instance.noStroke()
    if (this.game.is3D) {
      this.game.p5Instance.push()
      this.game.p5Instance.translate(this.x, this.y, 0)
      this.game.p5Instance.beginShape(p5.prototype.TRIANGLE_STRIP)
      this.vertices.forEach((v) => {
        this.game.p5Instance.vertex(v.x, v.y, 0)
        this.game.p5Instance.vertex(v.x, v.y, 10)
      })
      this.game.p5Instance.vertex(this.vertices[0].x, this.vertices[0].y, 0)
      this.game.p5Instance.vertex(this.vertices[0].x, this.vertices[0].y, 10)
      this.game.p5Instance.endShape(p5.prototype.CLOSE)

      // top
      this.game.p5Instance.beginShape(p5.prototype.TESS)
      this.vertices.forEach((v) => {
        this.game.p5Instance.vertex(v.x, v.y, 10)
      })
      this.game.p5Instance.endShape(p5.prototype.CLOSE)
      this.game.p5Instance.pop()
    } else {
      this.game.p5Instance.push()
      this.game.p5Instance.translate(this.x, this.y)
      this.game.p5Instance.beginShape()
      this.vertices.forEach((v) => {
        this.game.p5Instance.vertex(v.x, v.y)
      })
      this.game.p5Instance.endShape(p5.prototype.CLOSE)
      this.game.p5Instance.pop()
    }
  }
}
