import Matter from 'matter-js'
import p5 from 'p5'

type Game = {
  engine: { world: any }
  is3D: boolean
  p5Instance: p5
  color: string
}

const THICKNESS = 20
const SPACER = 100
const HEIGHT = 10
const CYLINDER_DETAIL_X = 16 // originally it was 20

export default class Obstacle {
  game: Game

  color: string

  x: number

  y: number

  d: number

  body: Matter.Body

  constructor(game: Game, { x, y, d, c }: IObstacle) {
    this.game = game
    this.color = c ?? game.color
    this.x = x
    this.y = y
    this.d = d * SPACER + THICKNESS
    this.body = Matter.Bodies.circle(x * SPACER, y * SPACER, this.d / 2, {
      isStatic: true,
    })
    Matter.World.add(this.game.engine.world, this.body)
  }

  show = () => {
    const pos = this.body.position
    this.game.p5Instance.push()
    this.game.p5Instance.translate(
      pos.x,
      pos.y,
      this.game.is3D ? HEIGHT / 2 : undefined
    )
    this.game.p5Instance.fill(this.color)
    this.game.p5Instance.noStroke()
    if (this.game.is3D) {
      this.game.p5Instance.rotateX(p5.prototype.PI / 2)
      this.game.p5Instance.cylinder(this.d / 2, HEIGHT, CYLINDER_DETAIL_X)
    } else {
      this.game.p5Instance.circle(0, 0, this.d)
    }
    this.game.p5Instance.pop()
  }

  remove = () => {
    Matter.World.remove(this.game.engine.world, this.body)
  }
}
