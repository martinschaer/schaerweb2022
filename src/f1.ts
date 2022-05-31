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

const endpoint = 'http://ergast.com/api/f1'

const driverPosInRound = (driverCode: string, round: Round) => {
  for (let i = 0; i < round.DriverStandings.length; i += 1) {
    if (round.DriverStandings[i].Driver.code === driverCode) {
      return +round.DriverStandings[i].position
    }
  }
  return 100
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

const loadAllDriverStandings = async (params: APIParams) => {
  const temp = await loadDriverStandings(params)
  if (temp.length) {
    return [
      temp[0],
      ...(await loadAllDriverStandings({
        year: params.year,
        round: params.round + 1,
      })),
    ]
  }
  return temp as Round[]
}

const loadAllDrivers = async (params: APIParams) => {
  const apiResult = await load('drivers', params)
  return apiResult.MRData.DriverTable.Drivers as Driver[]
}

/*
const renderRound = (round: Round) => `
  <div class="mx-3">
    <p>Round: ${round.round}</p>
    ${round.DriverStandings.map(
      (x) => `<p>${x.Driver.code} - ${x.points} - ${x.position}</p>`
    ).join('')}
  </div>
`
*/

const renderDriver = (
  driver: Driver,
  rounds: Round[],
  driversCount: number
) => {
  const roundsLen = rounds.length
  const points = rounds
    .map(
      (round, i) =>
        `${i === 0 ? 'M' : 'L'} ${(i / roundsLen) * 100} ${
          (driverPosInRound(driver.code, round) / driversCount) * 100
        }`
    )
    .join(' ')
  return `
    <path d="${points}" fill="none" stroke="currentColor" />
    <text x="100" y="${
      (driverPosInRound(driver.code, rounds[roundsLen - 1]) / driversCount) *
      100
    }" font-size="4" fill="currentColor" text-anchor="end" dominant-baseline="middle">${
    driver.code
  }</text>
  `
}

const generate = async () => {
  let html = ''
  const promises = []

  // standings
  //
  promises.push(loadAllDriverStandings({ year: 2022, round: 1 }))

  /*
  const roundsLen = standings.length
  html = `<div>Rounds: ${roundsLen}</div>`
  html += `
    <div style="display: flex; margin: 0 -18rem">
      ${standings.map(renderRound).join('')}
    </div>`
  */

  // drivers
  //
  promises.push(loadAllDrivers({ year: 2022 }))

  Promise.all(promises).then(([standings, drivers]) => {
    const driversByCode = drivers.reduce(
      (dict: Record<string, Driver>, d: Driver) => ({ ...dict, [d.code]: d }),
      {}
    )

    // console.log(driversByCode)

    const driverCodes = Object.keys(driversByCode)

    html += `
  <svg width="100%" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    ${driverCodes
      .map((code) =>
        renderDriver(driversByCode[code], standings, drivers.length)
      )
      .join('')}
  </svg>
  `

    document.getElementById('f1').innerHTML = html
  })
}

generate()
