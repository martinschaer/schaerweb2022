import 'aframe'

export {}

type APIParams = {
  year: number
  round?: number
}

type Driver = {
  driverId: string
  permanentNumber: string
  code: string
  url: string
  givenName: string
  familyName: string
  dateOfBirth: string
  nationality: string
}

type Constructors = {
  constructorId: string
  url: string
  name: string
  nationality: string
}

type DriverStanding = {
  points: string
  position: string
  positionText: string
  wins: string
  Driver: Driver
  Constructors: Constructors
}

type Round = {
  round: string
  season: string
  DriverStandings: DriverStanding[]
}

const endpoint = 'https://ergast.com/api/f1'

const COLORS_BY_DRIVER_CODE: Record<string, string> = {
  VER: 'blue',
  PER: 'blue',
  LEC: 'red',
  RUS: 'turquoise',
  SAI: 'red',
  HAM: 'turquoise',
  NOR: 'orange',
  BOT: 'darkred',
  OCO: 'dodgerblue',
  GAS: 'white',
  ALO: 'dodgerblue',
  MAG: 'gray',
  RIC: 'orange',
  VET: 'darkgreen',
  TSU: 'white',
  ALB: 'skyblue',
  STR: 'darkgreen',
  ZHO: 'darkred',
  MSC: 'gray',
  HUL: 'darkgreen',
  LAT: 'skyblue',
}

const driverPosInRound = (driverCode: string, round: Round) => {
  for (let i = 0; i < round.DriverStandings.length; i += 1) {
    if (round.DriverStandings[i].Driver.code === driverCode) {
      return +round.DriverStandings[i].position
    }
  }
  return round.DriverStandings.length + 1
}

const load = async (api: string, { year, round }: APIParams) => {
  const res = await fetch(
    `${endpoint}/${year}${round !== undefined ? `/${round}` : ''}/${api}.json`
  )
  if (!res.ok) {
    throw new Error(`HTTP error! Status: ${res.status}`)
  }
  return res.json()
}

const loadDriverStandings = async (params: APIParams) => {
  const apiResult = await load('driverStandings', params)
  return apiResult.MRData.StandingsTable.StandingsLists
}

const loadAllDriverStandings = async (params: APIParams): Promise<Round[]> => {
  const temp = await loadDriverStandings(params)
  if (temp.length) {
    return [
      temp[0],
      ...(await loadAllDriverStandings({
        year: params.year,
        round: params.round !== undefined ? params.round + 1 : 0,
      })),
    ]
  }
  return temp as Round[]
}

const loadAllDrivers = async (params: APIParams) => {
  const apiResult = await load('drivers', params)
  return apiResult.MRData.DriverTable.Drivers as Driver[]
}

const WALL_H = 3
const CHART_H = 2
const CHART_W = 4
const DISTANCE_TO_WALL = 2
const driverPosToY = (pos: number): number => WALL_H - CHART_H * pos

const renderAFrame = (driverCodes: string[], rounds: Round[]) => {
  let scene = `<a-plane position="0 0 -${
    DISTANCE_TO_WALL / 2
  }" rotation="-90 0 0" width="${CHART_W}" height="${DISTANCE_TO_WALL}" color="#1c221f"></a-plane>`

  driverCodes.forEach((driverCode) => {
    let lastX = -2
    let lastY = WALL_H
    const textScale = '0.4 0.4 0'
    const textFont = 'sourcecodepro'
    const textPosition = `${CHART_W / 2} ${driverPosToY(
      driverPosInRound(driverCode, rounds[rounds.length - 1]) /
        driverCodes.length
    )} -${DISTANCE_TO_WALL}`
    scene += `<a-text value="${driverCode}" position="${textPosition}" font="${textFont}" scale="${textScale}"></a-text>`
    rounds.forEach((round, roundIndex) => {
      const x = CHART_W / -2 + CHART_W * (roundIndex / (rounds.length - 1))
      const y = driverPosToY(
        driverPosInRound(driverCode, round) / driverCodes.length
      )
      if (roundIndex > 0)
        scene += `<a-entity line="start: ${lastX} ${lastY} -${DISTANCE_TO_WALL}; end: ${x} ${y} -${DISTANCE_TO_WALL}; color: ${COLORS_BY_DRIVER_CODE[driverCode]}"></a-entity>`
      lastX = x
      lastY = y
    })
  })

  return `<a-scene>${scene}</a-scene>`
}

const generate = async () => {
  let html = ''
  const promises = []
  const paper = document.querySelector('#app .paper')
  const loading = document.createElement('div')
  let article: HTMLElement | null
  loading.innerText = 'Loading…'
  if (paper) {
    article = paper.querySelector('.article')
    if (article) article.appendChild(loading)
  }

  // standings
  //
  promises.push(loadAllDriverStandings({ year: 2022, round: 1 }))

  // drivers
  //
  promises.push(loadAllDrivers({ year: 2022 }))

  return Promise.all(promises).then(([standings, drivers]) => {
    const driversByCode: Record<string, Driver> = (drivers as Driver[]).reduce(
      (dict: Record<string, Driver>, d: Driver) => ({ ...dict, [d.code]: d }),
      {}
    )

    const driverCodes = Object.keys(driversByCode)
    html += renderAFrame(driverCodes, standings as Round[] /* driversByCode */)

    const mountEl = document.createElement('div')
    loading.remove()
    if (paper && article) {
      article.setAttribute('style', 'position: absolute')
      paper.appendChild(mountEl)
    }
    mountEl.innerHTML = html
  })
}

generate()
