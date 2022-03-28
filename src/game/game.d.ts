export interface IPosition {
  x: number
  y: number
  a?: number
}

export interface IObstacle extends IPosition {
  x: number
  y: number
  d: number
  c?: string
}

export interface ICorner extends IPosition {
  r: number
  c?: string
}

export interface IWall {
  x1: number
  y1: number
  x2: number
  y2: number
  c?: string
}

export interface ICheckpoint extends IPosition {
  w: number
  c?: string
  label: string
}

export interface IBound {
  show: () => void
  remove: () => void
}

export interface ICircuit {
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

export interface IGhost extends IPosition {
  t: number
}
