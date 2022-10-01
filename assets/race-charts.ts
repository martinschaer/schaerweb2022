import {
  COLORS_BY_DRIVER_CODE,
  Driver,
  Lap,
  LapTiming,
  getGridPosByDriverId,
  getPosByDriverId,
  loadAllDrivers,
  loadLapTimes,
  loadRace,
} from './services/ergast'

import template from './lib/race-charts/template'

const margin = {
  top: 0,
  right: 5,
  bottom: 8,
  left: 100,
}

let $year: HTMLInputElement | null
let $round: HTMLInputElement | null
let $loadBtn: HTMLButtonElement | null
let $lapChart: SVGGElement | null

const {
  buttonIdLoad,
  groupLapChart,
  height,
  html,
  inputIdRound,
  inputIdYear,
  width,
} = template({})

const driverObjects: Record<string, Driver> = {}

const getColorByDriverId = (driverId: string) => {
  const driverCode = driverObjects[driverId]?.code
  return (driverCode && COLORS_BY_DRIVER_CODE[driverCode]) || ''
}

const getLapPositionsByDriver = (
  laps: Record<Driver['driverId'], number>[],
  grid: Record<Driver['driverId'], number>
) => {
  const posByDriver: Record<Driver['driverId'], number[]> = {}
  Object.keys(grid).forEach((driverId) => {
    const gridPos = grid[driverId] ?? 0
    posByDriver[driverId] = laps.reduce<number[]>(
      (state, lap) => {
        const pos = lap[driverId]
        return pos !== undefined ? [...state, pos] : state
      },
      [gridPos]
    )
  })
  return posByDriver
}

const updateLapsGraph = (
  lapPosByDriver: Record<Driver['driverId'], number[]>,
  x: (lap: number) => number,
  y: (pos: number) => number
) => {
  if ($lapChart) {
    // remove existing lines
    $lapChart.innerHTML = ''

    // go by driver…
    Object.keys(lapPosByDriver).forEach((driverId) => {
      const gridPos = lapPosByDriver[driverId]?.[0] || 0
      const text = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'text'
      )
      text.setAttribute('x', (x(0) - 12).toString())
      text.setAttribute('y', (y(gridPos) + 4).toString())
      text.setAttribute('font-size', '12')
      text.setAttribute('fill', getColorByDriverId(driverId))
      text.setAttribute('text-anchor', 'end')
      text.innerHTML = driverObjects[driverId]?.givenName || ''
      $lapChart?.appendChild(text)

      const circle = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'circle'
      )
      circle.setAttribute('fill', getColorByDriverId(driverId))
      circle.setAttribute('r', '8')
      circle.setAttribute('cx', x(0).toString())
      circle.setAttribute('cy', y(gridPos).toString())
      $lapChart?.appendChild(circle)

      let d = 'M'
      const path = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      )
      path.setAttribute('stroke', getColorByDriverId(driverId))
      path.setAttribute('fill', 'none')
      path.setAttribute('stroke-linejoin', 'round')
      path.setAttribute('stroke-linecap', 'round')
      path.setAttribute('stroke-width', '2')
      lapPosByDriver[driverId]?.forEach((pos, lap) => {
        d += ` ${x(lap)},${y(pos)}`
      })
      path.setAttribute('d', d)
      $lapChart?.appendChild(path)
    })
  }
}

const plotByOrder = (
  lapTimes: Lap[],
  grid: Record<Driver['driverId'], number>
) => {
  const laps = new Array(lapTimes.length)
  for (let lap = 0; lap < lapTimes.length; lap += 1) {
    const positions = getPosByDriverId(lapTimes[lap]?.Timings || [])
    laps[lap] = positions
  }
  const lapPosByDriver = getLapPositionsByDriver(laps, grid)
  const totalDrivers = Object.keys(lapPosByDriver).length
  const x = (lap: number) =>
    margin.left + lap * ((width - margin.left - margin.right) / lapTimes.length)
  const y = (pos: number) =>
    margin.top + pos * ((height - margin.top - margin.bottom) / totalDrivers)

  updateLapsGraph(lapPosByDriver, x, y)
}

const timeStrToNumber = (timeStr: string) => {
  const [mins, seconds] = timeStr.split(':')
  return parseInt(mins ?? '0', 10) * 60 + parseInt(seconds ?? '0', 10)
}

const getCumLapTime = (lapTimes: LapTiming[], lapN: number) => {
  let time = 0
  for (let i = lapN; i >= 0; i -= 1) {
    time += timeStrToNumber(lapTimes[i]?.time ?? '0')
  }
  return time
}

const getDistanceByDriver = (
  lapTimes: Lap[],
  referenceLapTimes: LapTiming[]
) => {
  const distanceByDriver: Record<Driver['driverId'], number[]> = {}
  const driverIds = lapTimes[0]?.Timings.map((x) => x.driverId) ?? []
  driverIds.forEach((driverId) => {
    let last = 0
    let lastRef = 0
    distanceByDriver[driverId] = lapTimes.map((lap, i) => {
      const t = timeStrToNumber(
        lap.Timings.find((x) => x.driverId === driverId)?.time ?? '0'
      )
      const tRef = timeStrToNumber(referenceLapTimes[i]?.time ?? '0')
      last += t
      lastRef += tRef
      // return (last * i) / lastRef
      return i + (lastRef - last)
    })
  })
  return distanceByDriver
}

const plotByDistance = (
  lapTimes: Lap[],
  totalDistance: number,
  referenceLapTimes: LapTiming[]
) => {
  const distanceByDriver: Record<Driver['driverId'], number[]> =
    getDistanceByDriver(lapTimes, referenceLapTimes)
  const chartW = width - margin.left - margin.right
  const chartH = height - margin.top - margin.bottom
  const totalTime = referenceLapTimes.reduce<number>(
    (acc, cur: LapTiming) => acc + timeStrToNumber(cur.time),
    0
  )
  const x = (lap: number) =>
    margin.left + getCumLapTime(referenceLapTimes, lap) * (chartW / totalTime)
  const y = (d: number) => margin.top + chartH * (1 - d / totalDistance)
  updateLapsGraph(distanceByDriver, x, y)
}

const load = async (year = 2022, round = 1) => {
  // TODO: make this toggleable by the user
  const mode: string | 'ordinal' | 'distance' = 'ordinal'
  // set loading
  if ($year && $round && $loadBtn) {
    $year.valueAsNumber = year
    $year.disabled = true
    $round.valueAsNumber = round
    $round.disabled = true
    $loadBtn.disabled = true
  }

  const race = await loadRace(year, round)
  const grid = getGridPosByDriverId(race)
  const promises = [
    loadAllDrivers({ year: +race.season, round: +race.round }),
    loadLapTimes(race),
  ]
  const [driversPromise, lapTimesPromise] = await Promise.allSettled(promises)
  let lapTimes = []

  if (driversPromise?.status === 'fulfilled') {
    ;(driversPromise.value as Driver[]).forEach((driver) => {
      driverObjects[driver.driverId] = driver
    })
  }
  if (lapTimesPromise?.status === 'fulfilled') {
    lapTimes = lapTimesPromise.value
  }

  const winner = race.Results[0]?.Driver.driverId ?? ''
  const referenceLapTimes: LapTiming[] = lapTimes.map((lap: Lap) =>
    lap.Timings.find((lt) => lt.driverId === winner)
  ) as LapTiming[]
  switch (mode) {
    case 'distance':
      plotByDistance(lapTimes, lapTimes.length, referenceLapTimes)
      break
    case 'ordinal':
    default:
      plotByOrder(lapTimes, grid)
      break
  }

  // update UI
  if ($year && $round && $loadBtn) {
    $year.disabled = false
    $round.disabled = false
    $loadBtn.disabled = false
  }
}

const init = () => {
  const $container = document.createElement('div')
  $container.innerHTML = html
  const $main = document.querySelector('main.article__content')
  if ($main) {
    $main?.appendChild($container)
  }

  $year = document.getElementById(inputIdYear) as HTMLInputElement | null
  $round = document.getElementById(inputIdRound) as HTMLInputElement | null
  $loadBtn = document.getElementById(buttonIdLoad) as HTMLButtonElement | null
  $lapChart = document.getElementById(groupLapChart) as SVGGElement | null

  // Load
  load(2022, 16)

  // Events
  //
  $loadBtn?.addEventListener('click', () => {
    load($year?.valueAsNumber, $round?.valueAsNumber)
  })
}

init()
