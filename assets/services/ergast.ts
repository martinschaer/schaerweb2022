type APIParams = {
  year: number
  round?: number
  lap?: number
}

export type Driver = {
  driverId: string
  permanentNumber: string
  code: string
  url: string
  givenName: string
  familyName: string
  dateOfBirth: string
  nationality: string
}

type Constructor = {
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
  Constructor: Constructor
}

export type Round = {
  round: string
  season: string
  DriverStandings: DriverStanding[]
}

type Circuit = {
  circuitName: string
}

type Time = {
  millis: string
  time: string
}

type LapTiming = {
  driverId: string
  position: string
  time: string
}

type Lap = {
  number: string
  Timings: LapTiming[]
}

type FastestLap = {
  rank: string
  lap: string
  Time: { time: string }
  AverageSpeed: { units: string; speed: string }
}

type Result = {
  number: string
  position: string
  positionText: string
  points: string
  Driver: Driver
  Constructor: Constructor
  grid: string
  laps: string
  status: string
  Time: Time
  FastestLap: FastestLap
}

type Race = {
  season: string
  round: string
  raceName: string
  Circuit: Circuit
  date: string
  time: string
  Results: Result[]
}

const endpoint = 'https://ergast.com/api/f1'

export const COLORS_BY_DRIVER_CODE: Record<string, string> = {
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

export const driverPosInRound = (driverCode: string, round: Round) => {
  for (let i = 0; i < round.DriverStandings.length; i += 1) {
    if (round.DriverStandings[i]?.Driver.code === driverCode) {
      return +(round.DriverStandings[i]?.position ?? 0)
    }
  }
  return round.DriverStandings.length + 1
}

export const load = async (api: string, { year, round, lap }: APIParams) => {
  const res = await fetch(
    `${endpoint}/${year}${round !== undefined ? `/${round}` : ''}/${api}${
      lap ? `/${lap}` : ''
    }.json`
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

export const loadAllDriverStandings = async (
  params: APIParams
): Promise<Round[]> => {
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

export const loadAllDrivers = async (params: APIParams) => {
  const apiResult = await load('drivers', params)
  return apiResult.MRData.DriverTable.Drivers as Driver[]
}

export const loadRace = async (year: number, round: number) => {
  const result = await load('results', { year, round })
  return result.MRData.RaceTable.Races[0] as Race
}

export const getGridPosByDriverId = (race: Race) => {
  const grid: Record<string, string> = {}
  for (let i = 0; i < race.Results.length; i += 1) {
    const raceResult = race.Results[i]
    if (raceResult) {
      // grid[raceResult.grid] = raceResult.Driver.driverId
      grid[raceResult.Driver.driverId] = raceResult.grid
    }
  }
  return grid
}

export const getPosByDriverId = (timings: LapTiming[]) => {
  const grid: Record<string, number> = {}
  for (let i = 0; i < timings.length; i += 1) {
    const timing = timings[i]
    if (timing) {
      // grid[raceResult.grid] = raceResult.Driver.driverId
      grid[timing.driverId] = +timing.position
    }
  }
  return grid
}

export const loadLapTimes = async (race: Race) => {
  const totalLaps = Number(race.Results[0]?.laps)
  const lapPromises = []
  for (let lap = 1; lap <= totalLaps; lap += 1) {
    lapPromises.push(
      load('laps', { year: +race.season, round: +race.round, lap }).then(
        (result) => result.MRData.RaceTable.Races[0].Laps[0] as Lap
      )
    )
  }
  const results = await Promise.allSettled(lapPromises)
  return results.map((x) => (x.status === 'fulfilled' ? x.value : x.reason))
}
