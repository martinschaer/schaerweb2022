import Matter from 'matter-js'
import p5 from 'p5'

// import carModelURL from 'url:../../assets/car.obj'
// import newRecordAudioURL from 'url:../../assets/newrecord.m4a'

import seoul from './circuits/seoul.json'
import Checkpoint from './Checkpoint'
import Car from './Car'
import Corner from './Corner'
import Obstacle from './Obstacle'
import Wall from './Wall'

const carModelURL = '/car.obj'
const newRecordAudioURL = '/newrecord.m4a'

const formatLapTime = (ms: number) => (Math.round(ms) / 1000).toString()

export default class Game {
  $el: HTMLElement

  $circuit: HTMLSelectElement

  $lastLap: HTMLElement | null

  $bestLap: HTMLElement | null

  $currLap: HTMLElement | null

  p5Instance?: p5

  canvas: p5.Renderer

  color: string

  car: Car

  finish?: Checkpoint

  checkpoints: Array<Checkpoint>

  ghost: Array<IGhost>

  tempGhost: Array<IGhost>

  camera: p5.Camera

  engine: Matter.Engine

  bounds: Array<IBound>

  circuit: ICircuit

  circuits: { [name: string]: ICircuit }

  checks: number

  lastLap: number

  bestLap: number | null

  lapStart: number

  is3D: boolean

  width: number

  height: number

  spacer: number

  winW: number

  winH: number

  transX: number

  transY: number

  audio: p5.MediaElement

  models: { car: p5.Geometry }

  constructor(el: HTMLElement) {
    this.$el = el
    const rect = document.body.getBoundingClientRect()
    this.winW = rect.width
    this.winH = rect.height
    this.circuits = {
      // test: testCircuit,
      seoul,
      // drift,
      // page5,
    }

    this.bounds = []
    this.checkpoints = []
    this.tempGhost = []
    this.is3D = true
    this.circuit = seoul
    this.transX = 0
    this.transY = 0
    this.checks = 0
    this.lastLap = null
    this.lapStart = null
    this.width = 1200
    this.height = 900
    this.spacer = 100
    this.color = '#00ff7f'
    this.models = { car: null }
    this.ghost = []
    this.bestLap = null

    this.$circuit = this.$el.querySelector('#circuit') as HTMLSelectElement
    this.$lastLap = this.$el.querySelector('#last-lap')
    this.$bestLap = this.$el.querySelector('#best-lap')
    this.$currLap = this.$el.querySelector('#curr-lap')

    // create an engine
    this.engine = Matter.Engine.create()
    this.engine.gravity.scale = 0

    // create car
    this.car = new Car(this, {
      x: this.circuit.car.x * this.spacer,
      y: this.circuit.car.y * this.spacer,
      a: this.circuit.car.a,
      c: this.color,
    })

  }

  preload() {
    if (this.p5Instance) {
      this.models.car = this.p5Instance.loadModel(
        carModelURL,
        undefined,
        undefined,
        '.obj'
      )
    }
  }

  getGhostInTimestamp(t: number) {
    const len = this.ghost.length
    let last: IGhost
    let tmp: IGhost
    for (let i = 0; i < len; i += 1) {
      tmp = this.ghost[i]
      if (tmp.t < t) {
        last = tmp
      } else {
        if (last && t - last.t < tmp.t - t) {
          return last
        }
        return tmp
      }
    }
    return tmp
  }

  loadData() {
    if (this.p5Instance) {
      this.bestLap = this.p5Instance.getItem(`lr-${this.circuit.key}`) as number
      this.ghost =
        (this.p5Instance.getItem(`lrg-${this.circuit.key}`) as Array<IGhost>) ||
        []
    }
  }

  createElements() {
    this.bounds.forEach((x) => {
      x.remove()
    })

    this.bounds = []
    this.circuit.obstacles.forEach((obstacle) =>
      this.bounds.push(new Obstacle(this, obstacle))
    )

    this.circuit.corners.forEach((corner) =>
      this.bounds.push(new Corner(this, corner))
    )

    this.circuit.walls.forEach((wall) => this.bounds.push(new Wall(this, wall)))

    // create finish line
    if (this.finish) this.finish.remove()
    this.finish = new Checkpoint(this, this.circuit.finish)
    this.checkpoints.forEach((x) => x.remove())
    this.checkpoints = []
    this.circuit.checkpoints.forEach((cp) =>
      this.checkpoints.push(new Checkpoint(this, cp))
    )
  }

  onChangeCircuit() {
    this.circuit = this.circuits[this.$circuit.value]
    this.loadData()
    this.car.reset(
      this.circuit.car.x * this.spacer,
      this.circuit.car.y * this.spacer,
      this.circuit.car.a
    )
    this.createElements()
    this.$circuit.blur()
  }

  onCollisionStart(event: Matter.IEventCollision<Matter.Engine>) {
    event.pairs.forEach((pair) => {
      if (
        (pair.bodyA.label === 'car' && pair.bodyB.label.includes('check')) ||
        (pair.bodyA.label.includes('check') && pair.bodyB.label === 'car')
      ) {
        const check =
          pair.bodyA.label === 'car' ? pair.bodyB.label : pair.bodyA.label
        const checkVal = parseInt(check.split(' ')[1], 10)
        // eslint-disable-next-line no-bitwise
        this.checks |= 1 << (checkVal - 1)
      }
      if (
        (pair.bodyA.label === 'car' && pair.bodyB.label === 'finish') ||
        (pair.bodyA.label === 'finish' && pair.bodyB.label === 'car')
      ) {
        const now = this.engine.timing.timestamp
        if (this.checks === 2 ** this.checkpoints.length - 1) {
          if (this.lapStart !== null) {
            this.lastLap = now - this.lapStart
            if (this.bestLap === null) {
              this.bestLap = this.lastLap
              this.ghost = [...this.tempGhost]
              this.p5Instance?.storeItem(`lrg-${this.circuit.key}`, this.ghost)
            } else if (this.lastLap < this.bestLap) {
              this.bestLap = this.lastLap
              this.ghost = [...this.tempGhost]
              this.p5Instance?.storeItem(`lrg-${this.circuit.key}`, this.ghost)
              this.p5Instance?.storeItem(`lr-${this.circuit.key}`, this.bestLap)
              this.audio.play()
            }
          }
        }
        this.lapStart = now
        this.checks = 0
        this.tempGhost = []
      }
    })
  }

  /* static getInstance() {
    if (!game) game = new Game()
    return game
  } */

  setup() {
    if (this.p5Instance && !this.canvas) {
      this.canvas = this.p5Instance.createCanvas(
        this.winW,
        this.winH,
        this.is3D ? p5.prototype.WEBGL : p5.prototype.P2D
      )
      this.canvas.parent(this.$el)
    }

    this.loadData()

    // circuit selector
    Object.keys(this.circuits).forEach((key) => {
      const opt = document.createElement('option')
      opt.value = key
      opt.innerText = this.circuits[key].name
      opt.selected = key === this.circuit.key
      this.$circuit.appendChild(opt)
    })
    this.$circuit.addEventListener('change', () => this.onChangeCircuit())

    this.audio = this.p5Instance.createAudio(newRecordAudioURL)

    if (this.is3D && this.p5Instance) {
      this.p5Instance.perspective(0.6)
      this.camera = this.p5Instance.createCamera()
    }

    this.createElements()

    // events
    Matter.Events.on(this.engine, 'collisionStart', (event) =>
      this.onCollisionStart(event)
    )

    // create renderer
    // TODO: render matter en otro canvas
    /*
    if (!this.is3D) {
      this.render = Matter.Render.create({
        canvas: cnv.elt,
        engine: this.engine,
        options: {
          width: this.winW,
          height: this.winH,
          showVelocity: true,
          showPositions: true,
          showBounds: true
        }
      })
      Matter.Render.run(this.render)
    }
    */
  }

  draw() {
    Matter.Engine.update(this.engine)

    if (this.p5Instance.keyIsDown(p5.prototype.LEFT_ARROW)) {
      this.car.turn(-1)
    }

    if (this.p5Instance.keyIsDown(p5.prototype.RIGHT_ARROW)) {
      this.car.turn(1)
    }

    if (this.p5Instance.keyIsDown(p5.prototype.UP_ARROW)) {
      this.car.accelerate()
    }

    // if (keyIsDown(DOWN_ARROW)) {}

    // Draw
    //
    this.p5Instance.clear(0, 0, 0, 0)
    this.p5Instance.push()
    if (!this.is3D) {
      if (this.winW < this.width) {
        this.transX =
          (this.car.body.position.x / this.width) * (this.winW - this.width)
      } else {
        this.transX = (this.winW - this.width) / 2
      }
      if (this.winH < this.height) {
        this.transY =
          (this.car.body.position.y / this.height) * (this.winH - this.height)
      } else {
        this.transY = (this.winH - this.height) / 2
      }
      this.p5Instance.translate(this.transX, this.transY)
    } else {
      this.p5Instance.ambientLight(128, 128, 128)
      this.p5Instance.pointLight(250, 250, 250, 0, 0, 100)
      this.p5Instance.translate(
        -this.circuit.stand.x * this.spacer,
        -this.circuit.stand.y * this.spacer,
        0
      )

      this.camera.camera(
        0, // x
        0, // y
        this.spacer * 4, // z
        this.car.body.position.x - this.circuit.stand.x * this.spacer, // x
        this.car.body.position.y - this.circuit.stand.y * this.spacer, // y
        0, // z
        0,
        0,
        -1
      )

      /*
      this.camera.camera(
        this.car.body.position.x,
        this.car.body.position.y,
        20,
        this.car.body.position.x + Math.cos(this.car.body.angle + PI / 2) * 10,
        this.car.body.position.y + Math.sin(this.car.body.angle + PI / 2) * 10,
        20,
        0, 0, -1
      )
      */
    }

    this.bounds.forEach((bound) => {
      bound.show()
    })
    this.car.show()
    if (this.finish) this.finish.show()
    this.checkpoints.forEach((checkpoint) => {
      checkpoint.show()
    })
    if (this.ghost.length) {
      const { x, y, a } = this.getGhostInTimestamp(
        this.engine.timing.timestamp - this.lapStart
      )
      const gColor = this.p5Instance.color(this.color)
      gColor.setAlpha(128)
      Car.show(x, y, a, gColor.toString(), this)
    }
    this.p5Instance.pop()

    // Ghost
    this.tempGhost.push({
      t: this.engine.timing.timestamp - this.lapStart,
      x: this.car.body.position.x,
      y: this.car.body.position.y,
      a: this.car.body.angle,
    })

    // HUD
    if (this.$lastLap) this.$lastLap.innerText = formatLapTime(this.lastLap)
    if (this.$bestLap) this.$bestLap.innerText = formatLapTime(this.bestLap)
    if (this.$currLap)
      this.$currLap.innerText = formatLapTime(
        this.engine.timing.timestamp - this.lapStart
      )
  }

  windowResized() {
    const rect = document.body.getBoundingClientRect()
    this.winW = rect.width
    this.winH = rect.height
    this.p5Instance.resizeCanvas(this.winW, this.winH)
  }

  makeSketch() {
    const self = this
    return (sketch: p5) => {
      // eslint-disable-next-line no-param-reassign
      sketch.setup = () => {
        self.setup()

        // since this is inside a web component, the setup function fails
        // while searching for the canvases in document to make them visible
        // https://github.com/processing/p5.js/blob/5d4fd14e57a0102448dbd0231bd031a4016b137c/src/core/main.js#L348
        self.canvas.elt.style.visibility = ''
        delete self.canvas.elt.dataset.hidden
      }
      // eslint-disable-next-line no-param-reassign
      sketch.draw = () => {
        self.draw()
      }
      // eslint-disable-next-line no-param-reassign
      sketch.preload = () => {
        self.preload()
      }
      // eslint-disable-next-line no-param-reassign
      sketch.windowResized = () => {
        self.windowResized()
      }
    }
  }

  run() {
    // eslint-disable-next-line new-cap
    this.p5Instance = new p5(this.makeSketch())
  }
}
