import Matter from "matter-js";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

// The default circuit is imported eagerly since the constructor needs its
// data synchronously to place the car before any async setup runs. The rest
// are loaded on demand via dynamic import() when selected, so users who never
// switch circuits don't pay to parse/hold the other three in memory. Names
// are duplicated here (must match each JSON's "name" field) so the selector
// can be populated without importing every circuit upfront.
import testCircuit from "./circuits/test.json";
import Checkpoint from "./Checkpoint";
import Car, { prepareCarGeometry } from "./Car";
import Corner from "./Corner";
import Obstacle from "./Obstacle";
import Wall from "./Wall";
import Input from "./input";
import View from "./view";
import { SPACER } from "./constants";
import { PALETTE, disposeMaterials } from "./materials";
import { getItem, storeItem } from "./storage";
import {
  buildVenue,
  getCircuitBounds,
  type IBounds,
  type IVenue,
} from "./lighting";

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

// The camera hangs at a fixed height and only ever changes what it looks at.
const CAMERA_HEIGHT = SPACER * 4;

// Handling presets, switchable with the 1-3 keys. Seeded with the tunings that
// used to live as commented-out blocks in Car.ts; the player can overwrite any
// of them with the Handling controls.
type Preset = { turnFactor: number; accFactor: number };

const PRESET_COUNT = 3;

const DEFAULT_PRESETS: Array<Preset> = [
  { turnFactor: 0.021, accFactor: 0.0033 }, // 1 Original
  { turnFactor: 0.023, accFactor: 0.0036 }, // 2 Balanced
  { turnFactor: 0.025, accFactor: 0.004 }, // 3 Fast
];

const formatLapTime = (ms: number) =>
  (Math.round(ms) / 1000).toLocaleString("en-US", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// OBJLoader hands back a Group of Meshes; car.obj is a single object, so the
// first mesh it contains is the whole car.
async function loadCarGeometry(): Promise<THREE.BufferGeometry | null> {
  const group = await new OBJLoader().loadAsync(carModelURL);
  let geometry: THREE.BufferGeometry | null = null;
  group.traverse((object) => {
    if (!geometry && object instanceof THREE.Mesh) geometry = object.geometry;
  });
  return geometry;
}

export default class Game {
  // The web component's shadow root. Typed concretely rather than as
  // HTMLElement so activeElement is reachable without a cast — the HUD's
  // focus check depends on it, and the light DOM's activeElement would only
  // ever report the host element.
  $el: ShadowRoot;

  $circuit: HTMLSelectElement;

  $lastLap: HTMLElement | null;

  $bestLap: HTMLElement | null;

  $currLap: HTMLElement | null;

  $turnFactor: HTMLInputElement | null;

  $accFactor: HTMLInputElement | null;

  $presets: HTMLElement | null;

  presets: Array<Preset> = DEFAULT_PRESETS.map((p) => ({ ...p }));

  activePreset: number = 0;

  // Derived from circuit geometry in createElements(), since no circuit JSON
  // declares its own extent.
  circuitBounds: IBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };

  view?: View;

  // Circuit space. Created here rather than in View so the entity classes have
  // something to attach to from the moment the Game exists.
  world: THREE.Group;

  venue: IVenue | null = null;

  carGeometry: THREE.BufferGeometry | null = null;

  ghostMesh: THREE.Mesh | null = null;

  input = new Input();

  color: string;

  car: Car;

  finish?: Checkpoint;

  checkpoints: Array<Checkpoint>;

  ghost: Array<IGhost>;

  tempGhost: Array<IGhost>;

  engine: Matter.Engine;

  bounds: Array<IBound>;

  circuit: ICircuit;

  circuits: { [key: string]: ICircuit };

  checks: number;

  lastLap: number | null;

  bestLap: number | null;

  lapStart: number | null = null;

  accumulator: number = 0;

  spacer: number;

  winW: number;

  winH: number;

  audio: HTMLAudioElement | null = null;

  private frameHandle: number | null = null;

  private lastFrameTime: number = 0;

  // HUD dedup/throttle state — avoids redundant Intl formatting and DOM writes.
  lastLapWritten: number | null = null;

  bestLapWritten: number | null = null;

  currLapThrottleAccum: number = 0;

  constructor(el: ShadowRoot) {
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
    this.circuit = testCircuit as ICircuit;
    this.checks = 0;
    this.lastLap = null;
    this.spacer = SPACER;
    this.color = PALETTE.green;
    this.ghost = [];
    this.bestLap = null;
    this.world = new THREE.Group();

    this.$circuit = this.$el.querySelector("#circuit") as HTMLSelectElement;
    this.$lastLap = this.$el.querySelector("#last-lap");
    this.$bestLap = this.$el.querySelector("#best-lap");
    this.$currLap = this.$el.querySelector("#curr-lap");
    this.$turnFactor = this.$el.querySelector("#turn-factor");
    this.$accFactor = this.$el.querySelector("#acc-factor");
    this.$presets = this.$el.querySelector("#presets");

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
    this.bestLap = getItem<number>(`lr-${this.circuit.key}`);
    this.ghost = getItem<Array<IGhost>>(`lrg-${this.circuit.key}`) || [];
  }

  // Presets describe the car, not the track, so unlike loadData() this runs
  // once at setup rather than on every circuit change.
  loadPresets() {
    // A stored array from an older build with a different slot count is simply
    // ignored, falling back to DEFAULT_PRESETS.
    const stored = getItem<Array<Preset>>("presets");
    if (Array.isArray(stored) && stored.length === PRESET_COUNT) {
      this.presets = stored;
    }
    const active = getItem<number>("preset");
    if (typeof active === "number" && active >= 0 && active < PRESET_COUNT) {
      this.activePreset = active;
    }
  }

  applyPreset(index: number) {
    if (index < 0 || index >= PRESET_COUNT) return;
    this.activePreset = index;
    this.car.turnFactor = this.presets[index].turnFactor;
    this.car.accFactor = this.presets[index].accFactor;
    storeItem("preset", this.activePreset);
    this.syncHandlingUI();
  }

  // Auto-save: the active preset always mirrors the live car values.
  savePreset() {
    this.presets[this.activePreset] = {
      turnFactor: this.car.turnFactor,
      accFactor: this.car.accFactor,
    };
    storeItem("presets", this.presets);
    this.syncHandlingUI();
  }

  // True while any Handling control has focus, so typing a number doesn't also
  // switch presets or drive the car. A ShadowRoot reports activeElement for its
  // own tree.
  isHudFocused(): boolean {
    const focused = this.$el.activeElement;
    return !!focused && focused.tagName !== "BODY";
  }

  // Wires a number field to a car property. Applies on every valid keystroke so
  // the car responds live, then persists once the edit is committed (blur,
  // Enter, or a stepper click) rather than on every keystroke.
  bindHandlingInput(
    input: HTMLInputElement | null,
    apply: (value: number) => void,
  ) {
    if (!input) return;
    input.addEventListener("input", () => {
      const value = input.valueAsNumber;
      if (!Number.isFinite(value)) return; // empty or mid-edit
      apply(Math.min(Math.max(value, Number(input.min)), Number(input.max)));
    });
    input.addEventListener("change", () => this.savePreset());
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") input.blur();
    });
  }

  syncHandlingUI() {
    if (this.$turnFactor) this.$turnFactor.value = String(this.car.turnFactor);
    if (this.$accFactor) this.$accFactor.value = String(this.car.accFactor);

    this.presets.forEach((_, i) => {
      const radio = this.$presets?.querySelector<HTMLInputElement>(
        `input[value="${i}"]`,
      );
      if (radio) radio.checked = i === this.activePreset;
    });
  }

  createElements() {
    // Runs on init and on every circuit change, so it's where the venue gets
    // rebuilt around the new circuit's extent.
    this.circuitBounds = getCircuitBounds(this.circuit, this.spacer);
    // Y is mirrored here rather than at every call site. The game authors its
    // circuits, its matter bodies and its car handling in screen coordinates
    // (+y down); three renders +y up, and the camera cannot compensate because
    // its up vector has to keep height pointing up the screen (see view.ts).
    // One negative scale on the group reconciles the two, and it also restores
    // the steering direction: matter's angles increase clockwise in a Y-down
    // frame, and the mirror turns them back into clockwise on screen.
    //
    // three flips triangle winding for a negative-determinant world matrix and
    // derives normals from the inverse transpose, so lighting and culling are
    // unaffected.
    this.world.scale.set(1, -1, 1);
    // Mirrored along with everything else: a child at local y renders at
    // world.position.y - y, and the wanted result is -(y - stand), so this
    // component goes in positive.
    this.world.position.set(
      -this.circuit.stand.x * this.spacer,
      this.circuit.stand.y * this.spacer,
      0,
    );

    if (this.venue) {
      this.world.remove(this.venue.group);
      this.venue.dispose();
    }
    this.venue = buildVenue(this.circuitBounds);
    this.world.add(this.venue.group);

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
              storeItem(`lrg-${this.circuit.key}`, this.ghost);
              storeItem(`lr-${this.circuit.key}`, this.bestLap);
              if (beatenRecord) this.audio?.play();
            }
          }
        }
        this.resetLap(now);
      }
    });
  }

  handleKeyDown = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (this.isHudFocused()) return;
    const slot = Number(event.key);
    if (Number.isInteger(slot) && slot >= 1 && slot <= PRESET_COUNT) {
      this.applyPreset(slot - 1);
    }
  };

  // Stop physics stepping and rendering entirely while the tab isn't visible,
  // instead of letting requestAnimationFrame keep ticking in the background.
  handleVisibilityChange = () => {
    if (document.hidden) {
      this.stopLoop();
    } else {
      this.startLoop();
    }
  };

  handleResize = () => {
    const container = document.querySelector("#app");
    if (!container || !this.view) return;
    const rect = container.getBoundingClientRect();
    this.winW = rect.width;
    this.winH = rect.height;
    this.view.resize(this.winW, this.winH);
  };

  async setup() {
    this.view = new View(this.$el, this.winW, this.winH, this.world);
    this.view.setCameraHeight(CAMERA_HEIGHT);

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

    this.audio = new Audio(newRecordAudioURL);

    // handling presets
    this.loadPresets();
    for (let i = 0; i < PRESET_COUNT; i += 1) {
      const label = document.createElement("label");
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "preset";
      radio.value = String(i);
      label.appendChild(radio);
      label.appendChild(document.createTextNode(String(i + 1)));
      this.$presets?.appendChild(label);
    }
    this.$presets?.addEventListener("change", (event) => {
      const radio = event.target as HTMLInputElement;
      this.applyPreset(Number(radio.value));
      radio.blur();
    });

    this.bindHandlingInput(this.$turnFactor, (value) => {
      this.car.turnFactor = value;
    });
    this.bindHandlingInput(this.$accFactor, (value) => {
      this.car.accFactor = value;
    });

    this.applyPreset(this.activePreset);

    this.input.attach();
    document.addEventListener("keydown", this.handleKeyDown);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    window.addEventListener("resize", this.handleResize);

    this.createElements();
    this.handleResize();

    // events
    Matter.Events.on(this.engine, "collisionStart", (event) =>
      this.onCollisionStart(event),
    );

    // Last, and deliberately not fatal: the circuit is playable without the
    // model, and the alternative is a black canvas if /car.obj ever 404s.
    try {
      const geometry = await loadCarGeometry();
      if (geometry) {
        this.carGeometry = prepareCarGeometry(geometry);
        this.car.attach(this.world, this.carGeometry);
        this.ghostMesh = Car.createGhost(
          this.world,
          this.carGeometry,
          this.color,
        );
      }
    } catch (error) {
      console.warn("Car model unavailable, continuing without it", error);
    }
  }

  // One physics step. Always advances the simulation by exactly FIXED_DT, so
  // handling and lap times are identical on every machine.
  step() {
    Matter.Engine.update(this.engine, FIXED_DT);

    // Key state is global, so without this a focused number field would step
    // its value and drive the car at the same time.
    const driving = !this.isHudFocused();

    if (driving && this.input.isDown("ArrowLeft")) {
      this.car.turn(-1);
    }

    if (driving && this.input.isDown("ArrowRight")) {
      this.car.turn(1);
    }

    if (driving && this.input.isDown("ArrowUp")) {
      this.car.accelerate();
    }

    // Ghost
    this.tempGhost.push({
      t: this.lapTime,
      x: this.car.body.position.x,
      y: this.car.body.position.y,
      a: this.car.body.angle,
    });
  }

  draw(delta: number) {
    // Run as many fixed steps as the real elapsed time calls for. The clamp
    // covers the first frame, a tab returning from the background, and machines
    // too slow to keep up (those degrade to slow motion instead of tunnelling
    // the car through walls).
    this.accumulator += Math.min(delta, FIXED_DT * MAX_STEPS_PER_FRAME);
    while (this.accumulator >= FIXED_DT) {
      this.accumulator -= FIXED_DT;
      this.step();
    }

    if (!this.view) return;

    // The only transforms that change between frames: everything else on the
    // circuit is a static body positioned once when it was built.
    this.car.sync();
    this.syncGhost();

    // The camera hangs off the scene, not off the mirrored world group, so the
    // target has to be mirrored by hand to match.
    this.view.lookAt(
      this.car.body.position.x - this.circuit.stand.x * this.spacer,
      -(this.car.body.position.y - this.circuit.stand.y * this.spacer),
    );
    this.view.render();

    this.updateHud(delta);
  }

  private syncGhost() {
    if (!this.ghostMesh) return;
    const frame = this.ghost.length
      ? this.getGhostInTimestamp(this.lapTime)
      : null;
    if (!frame) {
      this.ghostMesh.visible = false;
      return;
    }
    this.ghostMesh.position.set(frame.x, frame.y, 0);
    this.ghostMesh.rotation.z = frame.a;
    this.ghostMesh.visible = true;
  }

  // Skip the Intl formatting + DOM write when nothing changed, and throttle the
  // current-lap display since sub-100ms updates aren't visible.
  private updateHud(delta: number) {
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
    this.currLapThrottleAccum += delta;
    if (this.$currLap && this.currLapThrottleAccum >= HUD_CURR_LAP_THROTTLE_MS) {
      this.currLapThrottleAccum = 0;
      this.$currLap.innerText = formatLapTime(this.lapTime);
    }
  }

  private tick = () => {
    this.frameHandle = requestAnimationFrame(this.tick);
    const now = performance.now();
    const delta = now - this.lastFrameTime;
    this.lastFrameTime = now;
    this.draw(delta);
  };

  private startLoop() {
    if (this.frameHandle !== null) return;
    // Drop any time that accumulated while paused, so resuming doesn't trigger
    // a burst of catch-up physics steps.
    this.accumulator = 0;
    this.lastFrameTime = performance.now();
    this.frameHandle = requestAnimationFrame(this.tick);
  }

  private stopLoop() {
    if (this.frameHandle === null) return;
    cancelAnimationFrame(this.frameHandle);
    this.frameHandle = null;
  }

  run() {
    this.setup().then(
      () => this.startLoop(),
      (error) => console.error("Game setup failed", error),
    );
  }

  destroy() {
    this.stopLoop();
    document.removeEventListener("keydown", this.handleKeyDown);
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );
    window.removeEventListener("resize", this.handleResize);
    this.input.detach();

    this.bounds.forEach((bound) => bound.remove());
    this.bounds = [];
    this.checkpoints.forEach((checkpoint) => checkpoint.remove());
    this.checkpoints = [];
    this.finish?.remove();
    this.car.remove();
    this.ghostMesh?.removeFromParent();

    if (this.venue) {
      this.world.remove(this.venue.group);
      this.venue.dispose();
      this.venue = null;
    }

    this.carGeometry?.dispose();
    disposeMaterials();
    this.view?.dispose();
  }
}
