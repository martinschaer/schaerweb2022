// Replaces p5's keyIsDown(). The physics step polls held keys rather than
// reacting to events, because steering is applied once per fixed step (see
// step() in game.ts) and not once per keydown repeat.

// Stick travel below this is ignored, so a worn or off-centre stick doesn't
// make the car creep sideways on the straights.
const STICK_DEADZONE = 0.15;

// Button indices in the W3C "standard" gamepad layout (Xbox naming).
const BUTTON_A = 0;
const BUTTON_LB = 4;
const BUTTON_RB = 5;
const BUTTON_RT = 7;
const DPAD_UP = 12;
const DPAD_LEFT = 14;
const DPAD_RIGHT = 15;

export default class Input {
  private held = new Set<string>();

  // Gamepad state has no events, only snapshots, so it is sampled once per
  // frame by poll() and read by every physics step in that frame.
  private padSteer = 0;

  private padThrottle = 0;

  // Bumpers step through presets once per press, not once per frame held, so
  // each pad's previous bumper state is kept to spot the moment of the press.
  private padBumpers = new Map<number, { lb: boolean; rb: boolean }>();

  private padPresetShift = 0;

  private onKeyDown = (event: KeyboardEvent) => {
    this.held.add(event.key);
  };

  private onKeyUp = (event: KeyboardEvent) => {
    this.held.delete(event.key);
  };

  // Without this, holding an arrow key while switching tabs or windows leaves
  // it "down" forever: the keyup lands on whatever took focus, not on us.
  private onBlur = () => {
    this.held.clear();
  };

  attach() {
    document.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
  }

  detach() {
    document.removeEventListener("keydown", this.onKeyDown);
    document.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.held.clear();
    this.padSteer = 0;
    this.padThrottle = 0;
    this.padBumpers.clear();
    this.padPresetShift = 0;
  }

  isDown(key: string): boolean {
    return this.held.has(key);
  }

  // Browsers only list a pad after a button has been pressed on it while the
  // page is visible, so there is nothing to do on connect: it simply starts
  // showing up here.
  poll() {
    let steer = 0;
    let throttle = 0;
    const pads = navigator.getGamepads?.() ?? [];
    for (const pad of pads) {
      if (!pad || !pad.connected) continue;

      const x = pad.axes[0] ?? 0;
      const stick =
        Math.abs(x) < STICK_DEADZONE
          ? 0
          : (Math.sign(x) * (Math.abs(x) - STICK_DEADZONE)) /
            (1 - STICK_DEADZONE);
      const dpad =
        (pressed(pad, DPAD_RIGHT) ? 1 : 0) - (pressed(pad, DPAD_LEFT) ? 1 : 0);
      if (Math.abs(stick) > Math.abs(steer)) steer = stick;
      if (Math.abs(dpad) > Math.abs(steer)) steer = dpad;

      throttle = Math.max(
        throttle,
        pad.buttons[BUTTON_RT]?.value ?? 0,
        pressed(pad, BUTTON_A) ? 1 : 0,
        pressed(pad, DPAD_UP) ? 1 : 0,
      );

      const lb = pressed(pad, BUTTON_LB);
      const rb = pressed(pad, BUTTON_RB);
      const was = this.padBumpers.get(pad.index);
      if (lb && !was?.lb) this.padPresetShift -= 1;
      if (rb && !was?.rb) this.padPresetShift += 1;
      this.padBumpers.set(pad.index, { lb, rb });
    }
    this.padSteer = steer;
    this.padThrottle = throttle;
  }

  // How many presets to move since the last call: negative for LB, positive
  // for RB. Reading it resets it.
  takePresetShift(): number {
    const shift = this.padPresetShift;
    this.padPresetShift = 0;
    return shift;
  }

  // -1 (full left) to 1 (full right). Keys win over the pad when both are
  // used, since a held key is always full lock.
  steer(keys: boolean): number {
    if (keys) {
      const dir =
        (this.isDown("ArrowRight") ? 1 : 0) - (this.isDown("ArrowLeft") ? 1 : 0);
      if (dir !== 0) return dir;
    }
    return this.padSteer;
  }

  // 0 to 1. The trigger is analog; keys and face buttons are all-or-nothing.
  throttle(keys: boolean): number {
    if (keys && this.isDown("ArrowUp")) return 1;
    return this.padThrottle;
  }
}

function pressed(pad: Gamepad, index: number): boolean {
  return pad.buttons[index]?.pressed ?? false;
}
