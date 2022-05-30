export {}

// eslint-disable-next-line no-console
console.log('Hello F1')

type APIParams = {
  year: number
  round: number
}

type Driver = {
  code: string
}

type DriverStanding = {
  points: string
  position: string
  positionText: string
  wins: string
  Driver: Driver
}

type Round = {
  round: string
  season: string
  DriverStandings: DriverStanding[]
}

const endpoint = 'http://ergast.com/api/f1'

const load = async (api: string, { year, round }: APIParams) => {
  const res = await fetch(`${endpoint}/${year}/${round}/${api}.json`)
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
  return temp
}

const renderRound = (round: Round) => `
  <div class="mx-3">
    <p>Round: ${round.round}</p>
    ${round.DriverStandings.map(
      (x) => `<p>${x.Driver.code} - ${x.points} - ${x.position}</p>`
    ).join('')}
  </div>
`

const generate = async () => {
  const standings = await loadAllDriverStandings({ year: 2022, round: 1 })
  // eslint-disable-next-line no-console
  console.log(standings)
  // TODO: por aquí voy
  // ordenar datos por driver en vez de round, para dibujar un gráfico de líneas
  document.getElementById('f1').innerHTML = `
    <div style="display: flex; margin: 0 -18rem">
      ${standings.map(renderRound).join('')}
    </div>`
}

generate()
