import 'aframe'
import {
  COLORS_BY_DRIVER_CODE,
  Driver,
  Round,
  driverPosInRound,
  loadAllDriverStandings,
  loadAllDrivers,
} from './services/ergast'

const WALL_H = 4
const CHART_H = 2.5
const CHART_W = 6
const FLOOR_W = 10
const DISTANCE_TO_CENTER = 5
const driverPosToY = (pos: number): number => WALL_H - CHART_H * pos

const carAnimation =
  'property: rotation; to: 0 360 0; loop: true; dur: 40000; easing: linear;'

const renderAFrame = (driverCodes: string[], rounds: Round[]) => {
  let scene = `
<a-assets>
  <a-asset-item id="carModel" src="/f1.gltf"></a-asset-item>
</a-assets>
<a-entity light="type: ambient; color: #FFF; intensity: 0.5"></a-entity>
<a-entity light="type: directional; color: #FFF; intensity: 0.2" position="0 1 0"></a-entity>
<a-plane position="0 0 -${DISTANCE_TO_CENTER}" rotation="-90 0 0" width="${FLOOR_W}" height="${FLOOR_W}" color="#1c221f"></a-plane>
<a-cylinder position="0 0.1 -${DISTANCE_TO_CENTER}" color="#0e110f" height="0.1" radius="3"></a-cylinder>
<a-entity id="car" position="0 0.1 -${DISTANCE_TO_CENTER}" rotation="0 0 0" gltf-model="#carModel" animation="${carAnimation}"></a-entity>
`

  driverCodes.forEach((driverCode) => {
    let lastX = -2
    let lastY = WALL_H
    const lastRound = rounds[rounds.length - 1]
    if (!lastRound) return
    const textScale = '0.4 0.4 0'
    const textFont = 'sourcecodepro'
    const textPosition = `${CHART_W / 2 - 0.15} ${driverPosToY(
      driverPosInRound(driverCode, lastRound) / driverCodes.length
    )} -${DISTANCE_TO_CENTER}`
    scene += `<a-text value="${driverCode}" position="${textPosition}" font="${textFont}" scale="${textScale}"></a-text>`
    rounds.forEach((round, roundIndex) => {
      const w = CHART_W - 0.3
      const x = w / -2 + w * (roundIndex / (rounds.length - 1))
      const y = driverPosToY(
        driverPosInRound(driverCode, round) / driverCodes.length
      )
      if (roundIndex > 0)
        scene += `<a-entity line="start: ${lastX} ${lastY} -${DISTANCE_TO_CENTER}; end: ${x} ${y} -${DISTANCE_TO_CENTER}; color: ${COLORS_BY_DRIVER_CODE[driverCode]}"></a-entity>`
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
