import { PALETTE } from "./materials";
import { applyRamp, type Ramp } from "./ramp";

const CURVE_SAMPLES = 48;

// How many recent inputs are drawn behind the live dot, one per frame.
const TRAIL_LENGTH = 20;

const PADDING = 4; // CSS px, so the dot isn't clipped at full travel

// Plots a response curve with the player's live input on it. Steering is
// drawn over -1..1 on both axes so left and right are both visible; throttle
// only goes one way, so it is drawn over 0..1.
export default class RampGraph {
  private canvas: HTMLCanvasElement;

  private ctx: CanvasRenderingContext2D | null;

  private min: number;

  private trail: Array<number> = [];

  // Frames in a row with the same input. Once the whole trail has caught up
  // with the dot, and the curve and size haven't moved, a redraw would paint
  // the exact same pixels, so it is skipped.
  private stillFrames = 0;

  private drawnKey = "";

  constructor(canvas: HTMLCanvasElement, { symmetric }: { symmetric: boolean }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.min = symmetric ? -1 : 0;
  }

  draw(ramp: Ramp, input: number) {
    const { canvas, ctx } = this;
    if (!ctx) return;

    const last = this.trail[this.trail.length - 1];
    this.stillFrames = input === last ? this.stillFrames + 1 : 0;
    this.trail.push(input);
    if (this.trail.length > TRAIL_LENGTH) this.trail.shift();

    // Sized here rather than in the constructor: the graph lives in a
    // collapsed <details>, which has no layout until it is first opened.
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;

    const key = `${ramp.mode} ${ramp.exponent} ${width} ${height} ${dpr}`;
    if (key === this.drawnKey && this.stillFrames >= TRAIL_LENGTH) return;
    this.drawnKey = key;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const { min } = this;
    const px = (v: number) =>
      PADDING + ((v - min) / (1 - min)) * (width - PADDING * 2);
    const py = (v: number) =>
      height - PADDING - ((v - min) / (1 - min)) * (height - PADDING * 2);

    // Inherits the HUD's text colour, so the graph follows the site theme.
    const ink = getComputedStyle(canvas).color;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1;

    // Axes through the origin.
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(px(min), py(0));
    ctx.lineTo(px(1), py(0));
    ctx.moveTo(px(0), py(min));
    ctx.lineTo(px(0), py(1));
    ctx.stroke();

    // The linear diagonal, for reference against a bent curve.
    if (ramp.mode !== "linear") {
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(px(min), py(min));
      ctx.lineTo(px(1), py(1));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= CURVE_SAMPLES; i += 1) {
      const x = min + ((1 - min) * i) / CURVE_SAMPLES;
      const y = applyRamp(x, ramp);
      if (i === 0) ctx.moveTo(px(x), py(y));
      else ctx.lineTo(px(x), py(y));
    }
    ctx.stroke();

    // Oldest first, so the live dot ends up on top.
    ctx.fillStyle = PALETTE.green;
    this.trail.forEach((v, i) => {
      const isLive = i === this.trail.length - 1;
      ctx.globalAlpha = isLive ? 1 : ((i + 1) / this.trail.length) * 0.4;
      ctx.beginPath();
      ctx.arc(px(v), py(applyRamp(v, ramp)), isLive ? 3 : 2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
}
