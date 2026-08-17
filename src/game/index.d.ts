interface IPosition {
  x: number
  y: number
  a: number
}

interface IObstacle extends IPosition {
  x: number
  y: number
  d: number
  c?: string
}

interface ICorner extends IPosition {
  r: number
  c?: string
}

interface IWall {
  x1: number
  y1: number
  x2: number
  y2: number
  c?: string
}

interface ICheckpoint extends IPosition {
  w: number
  c?: string
  label: string
}

// Barriers are retained-mode meshes now: they build themselves once and are
// only ever torn down, so there is nothing left to call per frame.
interface IBound {
  remove: () => void
}

interface ICircuit {
  key: string
  name: string
  car: IPosition
  stand: IPosition
  obstacles: Array<IObstacle>
  corners: Array<ICorner>
  walls: Array<IWall>
  checkpoints: Array<ICheckpoint>
  finish: ICheckpoint
}

interface IGhost extends IPosition {
  t: number
}
