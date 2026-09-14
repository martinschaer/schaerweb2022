// Lap times are shown as seconds with two decimals, everywhere.
export const formatLapTime = (ms: number) =>
  (Math.round(ms) / 1000).toLocaleString("en-US", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
