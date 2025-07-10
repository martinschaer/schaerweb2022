import {
  Color,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  sRGBEncoding,
  // DirectionalLight,
  AmbientLight,
  Fog,
} from 'three'

/* eslint-disable import/extensions */
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
/* eslint-enable import/extensions */

const css = String.raw

const BG_COLOR = 0xd6eeff

let camera: PerspectiveCamera
let container: HTMLDivElement | null
let controls: PointerLockControls
let gltf: GLTF
let renderer: WebGLRenderer
let scene: Scene

let height = 100
let width = 100

let canJump = false
let moveBackward = false
let moveForward = false
let moveLeft = false
let moveRight = false

let prevTime = performance.now()
const velocity = new Vector3()
const direction = new Vector3()

const loadGLTF = (cb: (gltf: GLTF) => void): void => {
  const loader = new GLTFLoader()

  loader.load('/hangar.glb', cb, undefined, (error) => {
    // eslint-disable-next-line no-console
    console.error(error)
  })
}

const onResize = () => {
  if (!container) return
  const boundingRect = container.getBoundingClientRect()
  width = boundingRect.width || 100
  height = boundingRect.height || 100
  if (renderer) {
    renderer.setSize(width, height)
  }
  if (camera) {
    camera.updateProjectionMatrix()
    camera.aspect = width / height
  }
}

const loop = () => {
  requestAnimationFrame(loop)

  const time = performance.now()

  // https://threejs.org/examples/misc_controls_pointerlock.html
  if (controls.isLocked === true) {
    // raycaster.ray.origin.copy(controls.getObject().position)
    // raycaster.ray.origin.y -= 10
    //
    // const intersections = raycaster.intersectObjects(gltf.scene.children, false)

    // const onObject = intersections.length > 0

    const delta = (time - prevTime) / 1000

    velocity.x -= velocity.x * 10.0 * delta
    velocity.z -= velocity.z * 10.0 * delta

    // velocity.y -= 9.8 * 100.0 * delta // 100.0 = mass

    direction.z = Number(moveForward) - Number(moveBackward)
    direction.x = Number(moveRight) - Number(moveLeft)
    direction.normalize() // this ensures consistent movements in all directions

    if (moveForward || moveBackward) velocity.z -= direction.z * 30.0 * delta
    if (moveLeft || moveRight) velocity.x -= direction.x * 30.0 * delta
    // if (onObject === true) {
    //   velocity.y = Math.max(0, velocity.y)
    //   canJump = true
    // }

    controls.moveRight(-velocity.x * delta)
    controls.moveForward(-velocity.z * delta)

    // controls.getObject().position.y += velocity.y * delta // new behavior

    // if (controls.getObject().position.y < 10) {
    //   velocity.y = 0
    //   controls.getObject().position.y = 10
    //
    //   canJump = true
    // }
  }

  prevTime = time
  // renderer.physicallyCorrectLights = true
  renderer.render(scene, camera)
  // camera.updateProjectionMatrix();
}

const onKeyDown = function onKeyDown(event: KeyboardEvent) {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      moveForward = true
      break

    case 'ArrowLeft':
    case 'KeyA':
      moveLeft = true
      break

    case 'ArrowDown':
    case 'KeyS':
      moveBackward = true
      break

    case 'ArrowRight':
    case 'KeyD':
      moveRight = true
      break

    case 'Space':
      if (canJump === true) velocity.y += 350
      canJump = false
      break

    default:
      break
  }
}

const onKeyUp = function onKeyUp(event: KeyboardEvent) {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      moveForward = false
      break

    case 'ArrowLeft':
    case 'KeyA':
      moveLeft = false
      break

    case 'ArrowDown':
    case 'KeyS':
      moveBackward = false
      break

    case 'ArrowRight':
    case 'KeyD':
      moveRight = false
      break

    default:
      break
  }
}

const init = () => {
  const mount = document.querySelector('#app .paper')
  container = document.createElement('div')
  container.setAttribute(
    'style',
    css`
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    `
  )
  mount?.appendChild(container)

  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('keyup', onKeyUp)

  const resizeObserver = new window.ResizeObserver(onResize)
  if (container) resizeObserver.observe(container)

  if (container && !renderer) {
    scene = new Scene()
    scene.background = new Color(BG_COLOR)

    camera = new PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      1,
      5000
    )
    camera.position.set(6, 1.6, 6)
    camera.rotation.set(0, Math.PI * 0.25, 0)

    renderer = new WebGLRenderer({
      antialias: true,
      alpha: true,
    })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.physicallyCorrectLights = true
    onResize()
    renderer.setSize(width, height)
    container.appendChild(renderer.domElement)
    renderer.outputEncoding = sRGBEncoding
    renderer.shadowMap.enabled = true

    scene.fog = new Fog(0x000000, -40, 40);
    const amlight = new AmbientLight(0xffffff, 1)
    scene.add(amlight)
    // const light = new DirectionalLight(0xffffff, 1)
    // light.castShadow = true
    // light.position.y = 2
    // scene.add(light)

    loadGLTF((g) => {
      gltf = g
      scene?.add(gltf.scene)
      // console.log(gltf.scene.children, gltf.cameras)

      if (container) {
        controls = new PointerLockControls(camera, container)
        container.addEventListener('click', () => {
          controls.lock()
        })
      }
      scene.add(controls.getObject())

      gltf.scene.children.forEach((obj) => {
        // eslint-disable-next-line no-param-reassign
        obj.castShadow = true
        // eslint-disable-next-line no-param-reassign
        // obj.receiveShadow = true
      })
      const hangar = gltf.scene.getObjectByName("Hangar")
      if (hangar) {
        hangar.castShadow = false
        hangar.receiveShadow = true
      }

      loop()
    })
  }

  onResize()
}

init()
