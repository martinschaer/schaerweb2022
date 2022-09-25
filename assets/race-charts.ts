import {
  COLORS_BY_DRIVER_CODE,
  Driver,
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
  laps: Record<Driver["driverId"], number>[],
  grid: Record<Driver["driverId"], number>
) => {
  const posByDriver: Record<Driver["driverId"], number[]> = {}
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
  lapPosByDriver: Record<Driver["driverId"], number[]>,
  x: (lap: number) => number,
  y: (pos: number) => number,
) => {
  if ($lapChart) {
    // remove existing lines
    $lapChart.innerHTML = ''

    // go by driver…
    Object.keys(lapPosByDriver).forEach((driverId) => {
      const gridPos = lapPosByDriver[driverId]?.[0] || 0
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
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

const load = async (year = 2022, round = 1) => {
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
    (driversPromise.value as Driver[]).forEach((driver) => {
      driverObjects[driver.driverId] = driver
    })
  }
  if (lapTimesPromise?.status === 'fulfilled') {
    lapTimes = lapTimesPromise.value
  }

  const laps = new Array(lapTimes.length)
  for (let lap = 0; lap < lapTimes.length; lap += 1) {
    const positions = getPosByDriverId(lapTimes[lap].Timings)
    laps[lap] = positions
  }
  const lapPosByDriver = getLapPositionsByDriver(laps, grid)
  const totalDrivers = Object.keys(lapPosByDriver).length
  const x = (lap: number) =>
    margin.left + lap * ((width - margin.left - margin.right) / lapTimes.length)
  const y = (pos: number) =>
    margin.top + pos * ((height - margin.top - margin.bottom) / totalDrivers)

  updateLapsGraph(lapPosByDriver, x, y)

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
