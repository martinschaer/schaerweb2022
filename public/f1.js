(() => {
  // <stdin>
  var endpoint = "https://ergast.com/api/f1";
  var driverPosInRound = (driverCode, round) => {
    for (let i = 0; i < round.DriverStandings.length; i += 1) {
      if (round.DriverStandings[i].Driver.code === driverCode) {
        return +round.DriverStandings[i].position;
      }
    }
    return 100;
  };
  var load = async (api, { year, round }) => {
    const res = await fetch(`${endpoint}/${year}${round !== void 0 ? `/${round}` : ""}/${api}.json`);
    if (!res.ok) {
      throw new Error(`HTTP error! Status: ${res.status}`);
    }
    return res.json();
  };
  var loadDriverStandings = async (params) => {
    const apiResult = await load("driverStandings", params);
    return apiResult.MRData.StandingsTable.StandingsLists;
  };
  var loadAllDriverStandings = async (params) => {
    const temp = await loadDriverStandings(params);
    if (temp.length) {
      return [
        temp[0],
        ...await loadAllDriverStandings({
          year: params.year,
          round: params.round + 1
        })
      ];
    }
    return temp;
  };
  var loadAllDrivers = async (params) => {
    const apiResult = await load("drivers", params);
    return apiResult.MRData.DriverTable.Drivers;
  };
  var renderDriver = (driver, rounds, driversCount) => {
    const roundsLen = rounds.length;
    const points = rounds.map((round, i) => `${i === 0 ? "M" : "L"} ${i / roundsLen * 100} ${driverPosInRound(driver.code, round) / driversCount * 100}`).join(" ");
    return `
    <path d="${points}" fill="none" stroke="currentColor" />
    <text x="100" y="${driverPosInRound(driver.code, rounds[roundsLen - 1]) / driversCount * 100}" font-size="4" fill="currentColor" text-anchor="end" dominant-baseline="middle">${driver.code}</text>
  `;
  };
  var generate = async () => {
    let html = "";
    const promises = [];
    promises.push(loadAllDriverStandings({ year: 2022, round: 1 }));
    promises.push(loadAllDrivers({ year: 2022 }));
    Promise.all(promises).then(([standings, drivers]) => {
      const driversByCode = drivers.reduce((dict, d) => ({ ...dict, [d.code]: d }), {});
      const driverCodes = Object.keys(driversByCode);
      html += `
  <svg width="100%" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    ${driverCodes.map((code) => renderDriver(driversByCode[code], standings, drivers.length)).join("")}
  </svg>
  `;
      const mountEl = document.createElement("div");
      document.querySelector("#app .paper").appendChild(mountEl);
      mountEl.style = "padding: calc(var(--spacer) * 2);";
      mountEl.innerHTML = html;
    });
  };
  generate();
})();
