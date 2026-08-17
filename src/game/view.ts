import * as THREE from "three";

import { PALETTE, configureTextures } from "./materials";

// Renderer, scene and camera. Everything here replaces p5's createCanvas() +
// createCamera() + the two shader hooks lighting.ts used to inject exponential
// fog by hand — three has exp2 fog as a scene property and computes exactly the
// same 1 - exp(-density^2 * depth^2) the hook did.

// The canvas composites over the page, whose background is PALETTE.dark. Fog of
// exactly that colour means geometry and the far edge of the floor dissolve
// into what is already showing through the transparent canvas, so the venue has
// no visible boundary by construction rather than by being pushed far away.
const FOG_DENSITY = 0.0007;

// Radians, matching p5's camera.perspective(0.66). three takes degrees.
const CAMERA_FOV = THREE.MathUtils.radToDeg(0.66);
// Nothing survives the fog past ~4000 units, and the near plane only has to
// clear the lamp shades the camera can pass under.
const CAMERA_NEAR = 10;
const CAMERA_FAR = 6000;

export default class View {
  renderer: THREE.WebGLRenderer;

  scene: THREE.Scene;

  camera: THREE.PerspectiveCamera;

  constructor(
    container: HTMLElement | ShadowRoot,
    width: number,
    height: number,
    // Circuit space, owned by Game. Carries the -stand offset that used to be a
    // translate() at the top of draw(), and every barrier, lamp, light and the
    // car hangs off it. Because lights are scene-graph nodes in three, this
    // deletes the whole originX/originY dance p5 forced on lighting.ts: p5
    // stored raw light positions and transformed them by the view matrix alone,
    // so a translate() moved the lamp posts but left their light behind.
    world: THREE.Group,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    // Transparent clear, so the page background shows wherever the venue does
    // not reach. The floor plane is opaque and covers everything inside the
    // fog, so in practice this only matters above the horizon.
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    // PCFSoftShadowMap is deprecated as of r185 and silently falls back to this
    // anyway. Softness comes from each light's shadow.radius instead — see
    // SHADOW_RADIUS in lighting.ts.
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);

    configureTextures(this.renderer.capabilities.getMaxAnisotropy());

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(PALETTE.dark, FOG_DENSITY);

    this.camera = new THREE.PerspectiveCamera(
      CAMERA_FOV,
      width / height,
      CAMERA_NEAR,
      CAMERA_FAR,
    );
    // Z-up, and note the sign: p5's camera was configured with upZ = -1, but
    // that is NOT the same setting in three. p5's WEBGL projection matrix
    // negates Y (it is how p5 makes +y point down the screen to match its 2D
    // mode), so p5 supplied a vertical flip that three does not. Porting
    // upZ = -1 across renders the scene mirrored top-to-bottom: walls and lamp
    // posts project *downward* from their bases.
    //
    // Height has to project upward, and screen-up is `up` projected
    // perpendicular to the view axis, so up.z must be positive — there is no
    // other value that works. The game's Y-down world is then reconciled by
    // mirroring the world group in Y instead; see Game.createElements().
    this.camera.up.set(0, 0, 1);
    this.scene.add(this.camera);
    this.scene.add(world);
  }

  // Camera height above the track. Fixed; only the look-at target moves.
  setCameraHeight(z: number) {
    this.camera.position.set(0, 0, z);
  }

  lookAt(x: number, y: number) {
    this.camera.lookAt(x, y, 0);
  }

  resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
