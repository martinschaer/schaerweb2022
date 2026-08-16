import Matter from "matter-js";
import p5 from "p5";

// import carModelURL from 'url:../../assets/car.obj'
// import newRecordAudioURL from 'url:../../assets/newrecord.m4a'

// The default circuit is imported eagerly since the constructor needs its
// data synchronously to place the car before any async setup runs. The rest
// are loaded on demand via dynamic import() when selected, so users who never
// switch circuits don't pay to parse/hold the other three in memory. Names
// are duplicated here (must match each JSON's "name" field) so the selector
// can be populated without importing every circuit upfront.
import testCircuit from "./circuits/test.json";
import Checkpoint from "./Checkpoint";
import Car from "./Car";
import Corner from "./Corner";
import Obstacle from "./Obstacle";
import Wall from "./Wall";

const CIRCUIT_MANIFEST: Array<{
  key: string;
  name: string;
  load: () => Promise<{ default: unknown }>;
}> = [
  {
    key: "test",
    name: (testCircuit as ICircuit).name,
    load: () => import("./circuits/test.json"),
  },
  {
    key: "seoul",
    name: "Seoul Underground Circuit",
    load: () => import("./circuits/seoul.json"),
  },
  {
    key: "drift",
    name: "Drift Park",
    load: () => import("./circuits/drift.json"),
  },
  {
    key: "page5",
    name: "Circuit P5",
    load: () => import("./circuits/page5.json"),
  },
];

const carModelURL = "/car.obj";
const newRecordAudioURL = "/newrecord.m4a";

// Physics runs on a fixed timestep decoupled from the render frame rate, so the
// game plays at the same real-world speed no matter how fast the machine draws.
const FIXED_DT = 1000 / 60; // ms per physics step (matter-js default)
const MAX_STEPS_PER_FRAME = 5; // catch-up cap; avoids the spiral of death

const HUD_CURR_LAP_THROTTLE_MS = 100; // current-lap display refresh rate

const formatLapTime = (ms: number) =>
  (Math.round(ms) / 1000).toLocaleString("en-US", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default class Game {
  $el: HTMLElement;

  $circuit: HTMLSelectElement;

  $lastLap: HTMLElement | null;

  $bestLap: HTMLElement | null;

  $currLap: HTMLElement | null;

  p5Instance?: p5;

  canvas: p5.Renderer | null = null;

  color: string;

  car: Car;

  finish?: Checkpoint;

  checkpoints: Array<Checkpoint>;

  ghost: Array<IGhost>;

  tempGhost: Array<IGhost>;

  camera: p5.Camera | null = null;

  engine: Matter.Engine;

  bounds: Array<IBound>;

  circuit: ICircuit;

  circuits: { [key: string]: ICircuit };

  checks: number;

  lastLap: number | null;

  bestLap: number | null;

  lapStart: number | null = null;

  accumulator: number = 0;

  is3D: boolean;

  width: number;

  height: number;

  spacer: number;

  winW: number;

  winH: number;

  transX: number;

  transY: number;

  audio: p5.MediaElement | null = null;

  models: { car: p5.Geometry | null };

  // HUD dedup/throttle state — avoids redundant Intl formatting and DOM writes.
  lastLapWritten: number | null = null;

  bestLapWritten: number | null = null;

  currLapThrottleAccum: number = 0;

  // Cached ghost car color string, computed once lazily.
  ghostColorStr: string | null = null;

  constructor(el: HTMLElement) {
    this.$el = el;
    const rect = document.body.getBoundingClientRect();
    this.winW = rect.width;
    this.winH = rect.height;
    // Cache of loaded circuits, keyed by circuit key. Populated lazily by
    // loadCircuit() as the user selects them; "test" is preloaded since it's
    // the default.
    this.circuits = {
      test: testCircuit as ICircuit,
    };

    this.bounds = [];
    this.checkpoints = [];
    this.tempGhost = [];
    this.is3D = true;
    this.circuit = testCircuit as ICircuit;
    this.transX = 0;
    this.transY = 0;
    this.checks = 0;
    this.lastLap = null;
    this.width = 1200;
    this.height = 900;
    this.spacer = 100;
    this.color = "#00ff7f";
    this.models = { car: null };
    this.ghost = [];
    this.bestLap = null;

    this.$circuit = this.$el.querySelector("#circuit") as HTMLSelectElement;
    this.$lastLap = this.$el.querySelector("#last-lap");
    this.$bestLap = this.$el.querySelector("#best-lap");
    this.$currLap = this.$el.querySelector("#curr-lap");

    // create an engine
    this.engine = Matter.Engine.create();
    this.engine.gravity.scale = 0;

    // create car
    this.car = new Car(this, {
      x: this.circuit.car.x * this.spacer,
      y: this.circuit.car.y * this.spacer,
      a: this.circuit.car.a,
      c: this.color,
    });
  }

  // preload() {
  //   if (this.p5Instance) {
  //     console.log("Preloading car model...");
  //     this.models.car = this.p5Instance.loadModel(
  //       carModelURL,
  //       undefined,
  //       undefined,
  //       ".obj",
  //     );
  //   }
  // }

  // Elapsed time of the current lap, in simulation ms. 0 until the car has
  // crossed the finish line for the first time.
  get lapTime(): number {
    return this.lapStart === null
      ? 0
      : this.engine.timing.timestamp - this.lapStart;
  }

  resetLap(start: number | null = null) {
    this.lapStart = start;
    this.checks = 0;
    this.tempGhost = [];
  }

  // Binary search: this.ghost is time-sorted, so we can find the closest
  // sample in O(log n) instead of scanning the whole (per-frame-growing) array.
  getGhostInTimestamp(t: number) {
    const { ghost } = this;
    const len = ghost.length;
    if (len === 0) return null;

    let lo = 0;
    let hi = len; // exclusive upper bound
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (ghost[mid].t < t) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }

    if (lo === 0) return ghost[0];
    if (lo === len) return ghost[len - 1];

    const before = ghost[lo - 1];
    const at = ghost[lo];
    return t - before.t < at.t - t ? before : at;
  }

  loadData() {
    if (this.p5Instance) {
      this.bestLap = this.p5Instance.getItem(
        `lr-${this.circuit.key}`,
      ) as number;
      this.ghost =
        (this.p5Instance.getItem(`lrg-${this.circuit.key}`) as Array<IGhost>) ||
        [];
    }
  }

  createElements() {
    this.bounds.forEach((x) => {
      x.remove();
    });

    this.bounds = [];
    this.circuit.obstacles.forEach((obstacle) =>
      this.bounds.push(new Obstacle(this, obstacle)),
    );

    this.circuit.corners.forEach((corner) =>
      this.bounds.push(new Corner(this, corner)),
    );

    this.circuit.walls.forEach((wall) =>
      this.bounds.push(new Wall(this, wall)),
    );

    // create finish line
    if (this.finish) this.finish.remove();
    this.finish = new Checkpoint(this, this.circuit.finish);
    this.checkpoints.forEach((x) => x.remove());
    this.checkpoints = [];
    this.circuit.checkpoints.forEach((cp) =>
      this.checkpoints.push(new Checkpoint(this, cp)),
    );
  }

  // Loads and caches a circuit's data on first request; returns the cached
  // copy on subsequent calls without re-importing.
  async loadCircuit(key: string): Promise<ICircuit> {
    if (!this.circuits[key]) {
      const entry = CIRCUIT_MANIFEST.find((c) => c.key === key);
      if (!entry) throw new Error(`Unknown circuit: ${key}`);
      const mod = await entry.load();
      this.circuits[key] = mod.default as ICircuit;
    }
    return this.circuits[key];
  }

  async onChangeCircuit() {
    this.circuit = await this.loadCircuit(this.$circuit.value);
    this.loadData();
    this.resetLap();
    this.car.reset(
      this.circuit.car.x * this.spacer,
      this.circuit.car.y * this.spacer,
      this.circuit.car.a,
    );
    this.createElements();
    this.$circuit.blur();
  }

  onCollisionStart(event: Matter.IEventCollision<Matter.Engine>) {
    event.pairs.forEach((pair) => {
      if (
        (pair.bodyA.label === "car" && pair.bodyB.label.includes("check")) ||
        (pair.bodyA.label.includes("check") && pair.bodyB.label === "car")
      ) {
        const check =
          pair.bodyA.label === "car" ? pair.bodyB.label : pair.bodyA.label;
        const checkVal = parseInt(check.split(" ")[1], 10);
        // eslint-disable-next-line no-bitwise
        this.checks |= 1 << (checkVal - 1);
      }
      if (
        (pair.bodyA.label === "car" && pair.bodyB.label === "finish") ||
        (pair.bodyA.label === "finish" && pair.bodyB.label === "car")
      ) {
        const now = this.engine.timing.timestamp;
        if (this.checks === 2 ** this.checkpoints.length - 1) {
          if (this.lapStart !== null) {
            this.lastLap = now - this.lapStart;
            if (this.bestLap === null || this.lastLap < this.bestLap) {
              const beatenRecord = this.bestLap !== null;
              this.bestLap = this.lastLap;
              this.ghost = [...this.tempGhost];
              this.p5Instance?.storeItem(`lrg-${this.circuit.key}`, this.ghost);
              this.p5Instance?.storeItem(
                `lr-${this.circuit.key}`,
                this.bestLap,
              );
              if (beatenRecord) this.audio?.play();
            }
          }
        }
        this.resetLap(now);
      }
    });
  }

  /* static getInstance() {
    if (!game) game = new Game()
    return game
  } */

  // Stop physics stepping and rendering entirely while the tab isn't visible,
  // instead of letting requestAnimationFrame keep ticking in the background.
  handleVisibilityChange = () => {
    if (!this.p5Instance) return;
    if (document.hidden) {
      this.p5Instance.noLoop();
    } else {
      // Drop any time that accumulated right before pausing so resuming
      // doesn't trigger a burst of catch-up physics steps.
      this.accumulator = 0;
      this.p5Instance.loop();
    }
  };

  async setup() {
    if (this.p5Instance && !this.canvas) {
      this.canvas = this.p5Instance.createCanvas(
        this.winW,
        this.winH,
        this.is3D ? p5.prototype.WEBGL : p5.prototype.P2D,
      );
      this.canvas.parent(this.$el);
      const model = await this.p5Instance.loadModel(carModelURL);
      this.models.car = model;
    }

    this.loadData();

    // circuit selector — built from the manifest so unselected circuits'
    // JSON doesn't need to be loaded just to populate the option list.
    CIRCUIT_MANIFEST.forEach(({ key, name }) => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.innerText = name;
      opt.selected = key === this.circuit.key;
      this.$circuit.appendChild(opt);
    });
    this.$circuit.addEventListener("change", () => this.onChangeCircuit());

    this.audio = this.p5Instance?.createAudio(newRecordAudioURL) ?? null;

    document.addEventListener("visibilitychange", this.handleVisibilityChange);

    if (this.is3D && this.p5Instance) {
      this.camera = this.p5Instance.createCamera();
      this.camera.perspective(0.66);

      this.camera.setPosition(
        0, // x
        0, // y
        this.spacer * 4, // z
      );
      this.camera.upX = 0;
      this.camera.upY = 0;
      this.camera.upZ = -1;

      this.p5Instance?.setCamera(this.camera);
    }

    this.createElements();

    // events
    Matter.Events.on(this.engine, "collisionStart", (event) =>
      this.onCollisionStart(event),
    );
  }

  // One physics step. Always advances the simulation by exactly FIXED_DT, so
  // handling and lap times are identical on every machine.
  step() {
    Matter.Engine.update(this.engine, FIXED_DT);

    if (this.p5Instance?.keyIsDown(p5.prototype.LEFT_ARROW)) {
      this.car.turn(-1);
    }

    if (this.p5Instance?.keyIsDown(p5.prototype.RIGHT_ARROW)) {
      this.car.turn(1);
    }

    if (this.p5Instance?.keyIsDown(p5.prototype.UP_ARROW)) {
      this.car.accelerate();
    }

    // if (keyIsDown(DOWN_ARROW)) {}

    // Ghost
    this.tempGhost.push({
      t: this.lapTime,
      x: this.car.body.position.x,
      y: this.car.body.position.y,
      a: this.car.body.angle,
    });
  }

  draw() {
    // Run as many fixed steps as the real elapsed time calls for. The clamp
    // covers the first frame, a tab returning from the background, and machines
    // too slow to keep up (those degrade to slow motion instead of tunnelling
    // the car through walls).
    this.accumulator += Math.min(
      this.p5Instance?.deltaTime ?? FIXED_DT,
      FIXED_DT * MAX_STEPS_PER_FRAME,
    );
    while (this.accumulator >= FIXED_DT) {
      this.accumulator -= FIXED_DT;
      this.step();
    }

    // Draw
    //
    this.p5Instance?.clear(0, 0, 0, 0);
    this.p5Instance?.push();
    if (!this.is3D) {
      if (this.winW < this.width) {
        this.transX =
          (this.car.body.position.x / this.width) * (this.winW - this.width);
      } else {
        this.transX = (this.winW - this.width) / 2;
      }
      if (this.winH < this.height) {
        this.transY =
          (this.car.body.position.y / this.height) * (this.winH - this.height);
      } else {
        this.transY = (this.winH - this.height) / 2;
      }
      this.p5Instance?.translate(this.transX, this.transY);
    } else {
      if (!this.p5Instance || !this.camera) return;
      this.p5Instance.ambientLight(128, 128, 128);
      this.p5Instance.pointLight(250, 250, 250, 0, 0, 100);
      this.p5Instance.translate(
        -this.circuit.stand.x * this.spacer,
        -this.circuit.stand.y * this.spacer,
        0,
      );

      this.camera.lookAt(
        this.car.body.position.x - this.circuit.stand.x * this.spacer, // x
        this.car.body.position.y - this.circuit.stand.y * this.spacer, // y
        0, // z
      );
    }

    this.bounds.forEach((bound) => {
      bound.show();
    });
    this.car.show();
    if (this.finish) this.finish.show();
    this.checkpoints.forEach((checkpoint) => {
      checkpoint.show();
    });
    if (this.ghost.length) {
      const ghostFrame = this.getGhostInTimestamp(this.lapTime);
      if (!ghostFrame || !this.p5Instance) return;
      const { x, y, a } = ghostFrame;
      if (!this.ghostColorStr) {
        const gColor = this.p5Instance.color(this.color);
        gColor.setAlpha(128);
        this.ghostColorStr = gColor.toString();
      }
      Car.show(x, y, a, this.ghostColorStr, this);
    }
    this.p5Instance?.pop();

    // HUD — skip the Intl formatting + DOM write when nothing changed, and
    // throttle the current-lap display since sub-100ms updates aren't visible.
    if (
      this.$lastLap &&
      this.lastLap !== null &&
      this.lastLap !== this.lastLapWritten
    ) {
      this.$lastLap.innerText = formatLapTime(this.lastLap);
      this.lastLapWritten = this.lastLap;
    }
    if (
      this.$bestLap &&
      this.bestLap !== null &&
      this.bestLap !== this.bestLapWritten
    ) {
      this.$bestLap.innerText = formatLapTime(this.bestLap);
      this.bestLapWritten = this.bestLap;
    }
    this.currLapThrottleAccum += this.p5Instance?.deltaTime ?? 0;
    if (this.$currLap && this.currLapThrottleAccum >= HUD_CURR_LAP_THROTTLE_MS) {
      this.currLapThrottleAccum = 0;
      this.$currLap.innerText = formatLapTime(this.lapTime);
    }
  }

  windowResized() {
    const container = document.querySelector("#app");
    // const container = document.body;
    if (container && this.p5Instance) {
      const rect = container.getBoundingClientRect();
      this.winW = rect.width;
      this.winH = rect.height;
      console.log("Window resized", this.winW, this.winH);
      this.p5Instance.resizeCanvas(this.winW, this.winH);
    }
  }

  makeSketch() {
    const self = this;
    return (sketch: p5) => {
      sketch.setup = () => {
        self.setup();
        self.windowResized();

        // since this is inside a web component, the setup function fails
        // while searching for the canvases in document to make them visible
        // https://github.com/processing/p5.js/blob/5d4fd14e57a0102448dbd0231bd031a4016b137c/src/core/main.js#L348
        if (self.canvas) {
          self.canvas.elt.style.visibility = "";
          delete self.canvas.elt.dataset.hidden;
        }
      };
      sketch.draw = () => {
        self.draw();
      };
      sketch.windowResized = () => {
        self.windowResized();
      };
    };
  }

  run() {
    this.p5Instance = new p5(this.makeSketch());
  }

  destroy() {
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );
  }
}
