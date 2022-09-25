// const css = String.raw
const html = String.raw

const s4 = () =>
  Math.floor((1 + Math.random()) * 0x10000)
    .toString(16)
    .substring(1)

const template = ({ width = 1200, height = 400 }) => {
  const buttonIdLoad = s4()
  const groupLapChart = s4()
  const inputIdRound = s4()
  const inputIdYear = s4()

  const rendered = html`
    <input type="number" id="${inputIdYear}" />
    <input type="number" id="${inputIdRound}" />
    <button id="${buttonIdLoad}">Load</button>
    <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <g id="${groupLapChart}"></g>
    </svg>
  `
  return {
    buttonIdLoad,
    groupLapChart,
    height,
    html: rendered,
    inputIdRound,
    inputIdYear,
    width,
  }
}

export default template
