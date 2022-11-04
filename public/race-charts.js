(() => {
  // ns-hugo:/Users/martinschaer/Projects/schaerweb/schaerweb2022/assets/services/ergast.ts
  var endpoint = "https://ergast.com/api/f1";
  var COLORS_BY_DRIVER_CODE = {
    VER: "blue",
    PER: "blue",
    LEC: "red",
    RUS: "turquoise",
    SAI: "red",
    HAM: "turquoise",
    NOR: "orange",
    BOT: "darkred",
    OCO: "dodgerblue",
    GAS: "white",
    ALO: "dodgerblue",
    MAG: "gray",
    RIC: "orange",
    VET: "darkgreen",
    TSU: "white",
    ALB: "skyblue",
    STR: "darkgreen",
    ZHO: "darkred",
    MSC: "gray",
    HUL: "darkgreen",
    LAT: "skyblue",
    DEV: "skyblue"
  };
  var load = async (api, { year, round, lap }) => {
    const res = await fetch(
      `${endpoint}/${year}${round !== void 0 ? `/${round}` : ""}/${api}${lap ? `/${lap}` : ""}.json`
    );
    if (!res.ok) {
      throw new Error(`HTTP error! Status: ${res.status}`);
    }
    return res.json();
  };
  var loadAllDrivers = async (params) => {
    const apiResult = await load("drivers", params);
    return apiResult.MRData.DriverTable.Drivers;
  };
  var loadRace = async (year, round) => {
    const result = await load("results", { year, round });
    return result.MRData.RaceTable.Races[0];
  };
  var getGridPosByDriverId = (race) => {
    const grid = {};
    for (let i = 0; i < race.Results.length; i += 1) {
      const raceResult = race.Results[i];
      if (raceResult) {
        grid[raceResult.Driver.driverId] = +raceResult.grid;
      }
    }
    return grid;
  };
  var getPosByDriverId = (timings) => {
    const grid = {};
    for (let i = 0; i < timings.length; i += 1) {
      const timing = timings[i];
      if (timing) {
        grid[timing.driverId] = +timing.position;
      }
    }
    return grid;
  };
  var loadLapTimes = async (race) => {
    const totalLaps = Number(race.Results[0]?.laps);
    const lapPromises = [];
    for (let lap = 1; lap <= totalLaps; lap += 1) {
      lapPromises.push(
        load("laps", { year: +race.season, round: +race.round, lap }).then(
          (result) => result.MRData.RaceTable.Races[0].Laps[0]
        )
      );
    }
    const results = await Promise.allSettled(lapPromises);
    return results.map((x) => x.status === "fulfilled" ? x.value : x.reason);
  };

  // ns-hugo:/Users/martinschaer/Projects/schaerweb/schaerweb2022/assets/lib/race-charts/template.ts
  var html = String.raw;
  var s4 = () => Math.floor((1 + Math.random()) * 65536).toString(16).substring(1);
  var template = ({ width: width2 = 1200, height: height2 = 400 }) => {
    const buttonIdLoad2 = s4();
    const groupLapChart2 = s4();
    const inputIdRound2 = s4();
    const inputIdYear2 = s4();
    const rendered = html`
    <input type="number" id="${inputIdYear2}" />
    <input type="number" id="${inputIdRound2}" />
    <button id="${buttonIdLoad2}">Load</button>
    <svg viewBox="0 0 ${width2} ${height2}" xmlns="http://www.w3.org/2000/svg">
      <g id="${groupLapChart2}"></g>
    </svg>
  `;
    return {
      buttonIdLoad: buttonIdLoad2,
      groupLapChart: groupLapChart2,
      height: height2,
      html: rendered,
      inputIdRound: inputIdRound2,
      inputIdYear: inputIdYear2,
      width: width2
    };
  };
  var template_default = template;

  // <stdin>
  var margin = {
    top: 0,
    right: 5,
    bottom: 8,
    left: 100
  };
  var $year;
  var $round;
  var $loadBtn;
  var $lapChart;
  var {
    buttonIdLoad,
    groupLapChart,
    height,
    html: html2,
    inputIdRound,
    inputIdYear,
    width
  } = template_default({});
  var driverObjects = {};
  var getColorByDriverId = (driverId) => {
    const driverCode = driverObjects[driverId]?.code;
    return driverCode && COLORS_BY_DRIVER_CODE[driverCode] || "";
  };
  var getLapPositionsByDriver = (laps, grid) => {
    const posByDriver = {};
    Object.keys(grid).forEach((driverId) => {
      const gridPos = grid[driverId] ?? 0;
      posByDriver[driverId] = laps.reduce(
        (state, lap) => {
          const pos = lap[driverId];
          return pos !== void 0 ? [...state, pos] : state;
        },
        [gridPos]
      );
    });
    return posByDriver;
  };
  var updateLapsGraph = (lapPosByDriver, x, y) => {
    if ($lapChart) {
      $lapChart.innerHTML = "";
      Object.keys(lapPosByDriver).forEach((driverId) => {
        const gridPos = lapPosByDriver[driverId]?.[0] || 0;
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", (x(0) - 12).toString());
        text.setAttribute("y", (y(gridPos) + 4).toString());
        text.setAttribute("font-size", "12");
        text.setAttribute("fill", getColorByDriverId(driverId));
        text.setAttribute("text-anchor", "end");
        text.innerHTML = driverObjects[driverId]?.givenName || "";
        $lapChart?.appendChild(text);
        const circle = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "circle"
        );
        circle.setAttribute("fill", getColorByDriverId(driverId));
        circle.setAttribute("r", "8");
        circle.setAttribute("cx", x(0).toString());
        circle.setAttribute("cy", y(gridPos).toString());
        $lapChart?.appendChild(circle);
        let d = "M";
        const path = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path"
        );
        path.setAttribute("stroke", getColorByDriverId(driverId));
        path.setAttribute("fill", "none");
        path.setAttribute("stroke-linejoin", "round");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-width", "2");
        lapPosByDriver[driverId]?.forEach((pos, lap) => {
          d += ` ${x(lap)},${y(pos)}`;
        });
        path.setAttribute("d", d);
        $lapChart?.appendChild(path);
      });
    }
  };
  var load2 = async (year = 2022, round = 1) => {
    if ($year && $round && $loadBtn) {
      $year.valueAsNumber = year;
      $year.disabled = true;
      $round.valueAsNumber = round;
      $round.disabled = true;
      $loadBtn.disabled = true;
    }
    const race = await loadRace(year, round);
    const grid = getGridPosByDriverId(race);
    const promises = [
      loadAllDrivers({ year: +race.season, round: +race.round }),
      loadLapTimes(race)
    ];
    const [driversPromise, lapTimesPromise] = await Promise.allSettled(promises);
    let lapTimes = [];
    if (driversPromise?.status === "fulfilled") {
      driversPromise.value.forEach((driver) => {
        driverObjects[driver.driverId] = driver;
      });
    }
    if (lapTimesPromise?.status === "fulfilled") {
      lapTimes = lapTimesPromise.value;
    }
    const laps = new Array(lapTimes.length);
    for (let lap = 0; lap < lapTimes.length; lap += 1) {
      const positions = getPosByDriverId(lapTimes[lap].Timings);
      laps[lap] = positions;
    }
    const lapPosByDriver = getLapPositionsByDriver(laps, grid);
    const totalDrivers = Object.keys(lapPosByDriver).length;
    const x = (lap) => margin.left + lap * ((width - margin.left - margin.right) / lapTimes.length);
    const y = (pos) => margin.top + pos * ((height - margin.top - margin.bottom) / totalDrivers);
    updateLapsGraph(lapPosByDriver, x, y);
    if ($year && $round && $loadBtn) {
      $year.disabled = false;
      $round.disabled = false;
      $loadBtn.disabled = false;
    }
  };
  var init = () => {
    const $container = document.createElement("div");
    $container.innerHTML = html2;
    const $main = document.querySelector("main.article__content");
    if ($main) {
      $main?.appendChild($container);
    }
    $year = document.getElementById(inputIdYear);
    $round = document.getElementById(inputIdRound);
    $loadBtn = document.getElementById(buttonIdLoad);
    $lapChart = document.getElementById(groupLapChart);
    load2(2022, 16);
    $loadBtn?.addEventListener("click", () => {
      load2($year?.valueAsNumber, $round?.valueAsNumber);
    });
  };
  init();
})();
