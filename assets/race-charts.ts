import {
  COLORS_BY_DRIVER_CODE,
  Driver,
  getGridPosByDriverId,
  getPosByDriverId,
  loadAllDrivers,
  loadLapTimes,
  loadRace,
} from './services/ergast'

type DriverObject = {
  circle: SVGCircleElement
  driver: Driver
}

const s4 = () =>
  Math.floor((1 + Math.random()) * 0x10000)
    .toString(16)
    .substring(1)

// const css = String.raw
const html = String.raw

const inputIdYear = s4()
const inputIdRound = s4()
const buttonIdLoad = s4()
const groupIdDrivers = s4()

let $year: HTMLInputElement | null
let $round: HTMLInputElement | null
let $loadBtn: HTMLButtonElement | null
let $drivers: SVGGElement | null

const driverObjects: Record<string, DriverObject> = {}

const template = html`
  <input type="number" id="${inputIdYear}" />
  <input type="number" id="${inputIdRound}" />
  <button id="${buttonIdLoad}">Load</button>
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <g id="${groupIdDrivers}"></g>
  </svg>
`

const addDriverCircle = (
  driverId: string,
  lap: number,
  positions: Record<string, number>
) => {
  const driverCode = driverObjects[driverId]?.driver.code
  if (driverCode) {
    const circle = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'circle'
    )
    circle.setAttribute('fill', COLORS_BY_DRIVER_CODE[driverCode] || '')
    circle.setAttribute('r', '0.5')
    circle.setAttribute('cx', ((lap + 1) * 1 + 3).toString())
    circle.setAttribute('cy', ((positions[driverId] ?? 0) * 4).toString())
    if ($drivers) $drivers.appendChild(circle)
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
  const promises = [
    loadAllDrivers({ year: +race.season, round: +race.round }),
    loadLapTimes(race),
  ]
  const [driversPromise, lapTimesPromise] = await Promise.allSettled(promises)
  let lapTimes = []

  Array.from($drivers?.children || []).forEach((child: Element) => {
    child.remove()
  })

  if (driversPromise?.status === 'fulfilled') {
    ;(driversPromise.value as Driver[]).forEach((driver) => {
      const circle = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'circle'
      )
      circle.setAttribute('fill', COLORS_BY_DRIVER_CODE[driver.code] || '')
      circle.setAttribute('r', '1')
      driverObjects[driver.driverId] = {
        circle,
        driver,
      }
      $drivers?.appendChild(circle)
    })
    // eslint-disable-next-line no-console
    console.log('Drivers', driverObjects)
  }
  if (lapTimesPromise?.status === 'fulfilled') {
    lapTimes = lapTimesPromise.value
    // eslint-disable-next-line no-console
    console.log('LapTimes', lapTimes)
  }
  // eslint-disable-next-line no-console
  console.log('Race', race)

  // grid positions
  //
  const grid = getGridPosByDriverId(race)
  Object.keys(driverObjects).forEach((driverId) => {
    const circle = driverObjects[driverId]?.circle
    if (circle) {
      circle.setAttribute('cy', (+(grid[driverId] ?? 0) * 4).toString())
      circle.setAttribute('cx', '2')
    }
  })

  // lap positions
  //
  for (let lap = 0; lap < lapTimes.length; lap += 1) {
    const positions = getPosByDriverId(lapTimes[lap].Timings)
    // eslint-disable-next-line no-console
    console.log(positions)
    Object.keys(driverObjects).forEach((id) =>
      addDriverCircle(id, lap, positions)
    )
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
  $container.innerHTML = template
  const $main = document.querySelector('main.article__content')
  if ($main) {
    $main?.appendChild($container)
  }

  $year = document.getElementById(inputIdYear) as HTMLInputElement | null
  $round = document.getElementById(inputIdRound) as HTMLInputElement | null
  $loadBtn = document.getElementById(buttonIdLoad) as HTMLButtonElement | null
  $drivers = document.getElementById(groupIdDrivers) as SVGGElement | null

  // Load
  load(2022, 16)

  // Events
  //
  $loadBtn?.addEventListener('click', () => {
    load($year?.valueAsNumber, $round?.valueAsNumber)
  })
}

init()
