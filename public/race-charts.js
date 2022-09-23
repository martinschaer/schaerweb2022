(() => {
  // ns-hugo:/Users/m.corrales.schaer/Proyectos/schaerweb2022/assets/services/ergast.ts
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
    LAT: "skyblue"
  };
  var load = async (api, { year, round, lap }) => {
    const res = await fetch(`${endpoint}/${year}${round !== void 0 ? `/${round}` : ""}/${api}${lap ? `/${lap}` : ""}.json`);
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
        grid[raceResult.Driver.driverId] = raceResult.grid;
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
      lapPromises.push(load("laps", { year: +race.season, round: +race.round, lap }).then((result) => result.MRData.RaceTable.Races[0].Laps[0]));
    }
    const results = await Promise.allSettled(lapPromises);
    return results.map((x) => x.status === "fulfilled" ? x.value : x.reason);
  };

  // <stdin>
  var s4 = () => Math.floor((1 + Math.random()) * 65536).toString(16).substring(1);
  var html = String.raw;
  var inputIdYear = s4();
  var inputIdRound = s4();
  var buttonIdLoad = s4();
  var groupIdDrivers = s4();
  var $year;
  var $round;
  var $loadBtn;
  var $drivers;
  var driverObjects = {};
  var template = html`
  <input type="number" id="${inputIdYear}" />
  <input type="number" id="${inputIdRound}" />
  <button id="${buttonIdLoad}">Load</button>
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <g id="${groupIdDrivers}"></g>
  </svg>
`;
  var addDriverCircle = (driverId, lap, positions) => {
    const driverCode = driverObjects[driverId]?.driver.code;
    if (driverCode) {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("fill", COLORS_BY_DRIVER_CODE[driverCode] || "");
      circle.setAttribute("r", "0.5");
      circle.setAttribute("cx", ((lap + 1) * 1 + 3).toString());
      circle.setAttribute("cy", ((positions[driverId] ?? 0) * 4).toString());
      if ($drivers)
        $drivers.appendChild(circle);
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
    const promises = [
      loadAllDrivers({ year: +race.season, round: +race.round }),
      loadLapTimes(race)
    ];
    const [driversPromise, lapTimesPromise] = await Promise.allSettled(promises);
    let lapTimes = [];
    Array.from($drivers?.children || []).forEach((child) => {
      child.remove();
    });
    if (driversPromise?.status === "fulfilled") {
      ;
      driversPromise.value.forEach((driver) => {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("fill", COLORS_BY_DRIVER_CODE[driver.code] || "");
        circle.setAttribute("r", "1");
        driverObjects[driver.driverId] = {
          circle,
          driver
        };
        $drivers?.appendChild(circle);
      });
      console.log("Drivers", driverObjects);
    }
    if (lapTimesPromise?.status === "fulfilled") {
      lapTimes = lapTimesPromise.value;
      console.log("LapTimes", lapTimes);
    }
    console.log("Race", race);
    const grid = getGridPosByDriverId(race);
    Object.keys(driverObjects).forEach((driverId) => {
      const circle = driverObjects[driverId]?.circle;
      if (circle) {
        circle.setAttribute("cy", (+(grid[driverId] ?? 0) * 4).toString());
        circle.setAttribute("cx", "2");
      }
    });
    for (let lap = 0; lap < lapTimes.length; lap += 1) {
      const positions = getPosByDriverId(lapTimes[lap].Timings);
      console.log(positions);
      Object.keys(driverObjects).forEach((id) => addDriverCircle(id, lap, positions));
    }
    if ($year && $round && $loadBtn) {
      $year.disabled = false;
      $round.disabled = false;
      $loadBtn.disabled = false;
    }
  };
  var init = () => {
    const $container = document.createElement("div");
    $container.innerHTML = template;
    const $main = document.querySelector("main.article__content");
    if ($main) {
      $main?.appendChild($container);
    }
    $year = document.getElementById(inputIdYear);
    $round = document.getElementById(inputIdRound);
    $loadBtn = document.getElementById(buttonIdLoad);
    $drivers = document.getElementById(groupIdDrivers);
    load2(2022, 16);
    $loadBtn?.addEventListener("click", () => {
      load2($year?.valueAsNumber, $round?.valueAsNumber);
    });
  };
  init();
})();
