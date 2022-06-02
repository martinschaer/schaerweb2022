import Matter from 'matter-js'
import p5 from 'p5'

const SPACER = 100
const THICKNESS = 10

type Game = {
  engine: { world: any }
  is3D: boolean
  p5Instance: p5
  color: string
}

export default class Checkpoint {
  game: Game

  x: number

  y: number

  w: number

  angle: number

  body: Matter.Body

  color: string

  constructor(game: Game, { x, y, w, a, label, c }: ICheckpoint) {
    this.game = game
    this.color = c ?? game.color
    this.x = x * SPACER
    this.y = y * SPACER
    this.w = w * SPACER
    this.angle = (a * p5.prototype.PI) / 180
    this.body = Matter.Bodies.rectangle(this.x, this.y, this.w, THICKNESS, {
      isStatic: true,
      isSensor: true,
      label,
    })
    Matter.Body.setAngle(this.body, this.angle)
    Matter.World.add(game.engine.world, this.body)
  }

  remove = () => {
    const { engine } = this.game
    if (engine) Matter.World.remove(engine.world, this.body)
  }

  show = () => {
    const fillColor = this.game.p5Instance.color(this.color)
    fillColor.setAlpha(128)
    this.game.p5Instance.push()
    this.game.p5Instance.translate(
      this.x,
      this.y,
      this.game.is3D ? 1 : undefined
    )
    this.game.p5Instance.fill(fillColor)
    this.game.p5Instance.noStroke()
    this.game.p5Instance.rectMode(p5.prototype.CENTER)
    if (this.game.is3D) {
      this.game.p5Instance.rotateZ(this.angle)
      this.game.p5Instance.box(this.w, THICKNESS, 2)
    } else {
      this.game.p5Instance.rotate(this.angle)
      this.game.p5Instance.rect(0, 0, this.w, THICKNESS)
    }
    this.game.p5Instance.pop()
  }
}
