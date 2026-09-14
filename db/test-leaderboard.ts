/// <reference types="bun" />
// Integration test for the leaderboard schema. Run against a throwaway
// in-memory server:  just db-test
//
// It exercises the schema as the browser will: signed in through the anonymous
// `player` record access, with no root credentials anywhere.

import { RecordId, Surreal } from "surrealdb";
import { decodeGhost, encodeGhost } from "../src/game/ghost-codec";

const ENDPOINT = process.env.SURREAL_WS ?? "ws://127.0.0.1:8123/rpc";
const NS = process.env.SURREAL_NS ?? "schaerweb";
const DB = process.env.SURREAL_DB ?? "arcade";
const FIXED_DT = 1000 / 60;

let failures = 0;
let checks = 0;

function check(label: string, condition: boolean, detail = "") {
  checks += 1;
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function rejects(label: string, run: () => Promise<unknown>) {
  try {
    await run();
    check(label, false, "expected a rejection, got success");
  } catch {
    check(label, true);
  }
}

const player = new Surreal();
await player.connect(ENDPOINT);
await player.use({ namespace: NS, database: DB });

console.log("\nanonymous record access");
const token = await player.signin({
  namespace: NS,
  database: DB,
  access: "player",
  variables: {},
});
check("signin with no credentials yields a token", Boolean(token));

// Every assertion below is about rows this run created, so a database carrying
// leftovers from a previous run would produce meaningless passes and failures.
const [existing] = await player.query<[Array<{ count: number }>]>(
  "SELECT count() FROM score GROUP ALL",
);
if ((existing[0]?.count ?? 0) > 0) {
  console.error("\nRefusing to run: the score table is not empty. Use `just db-test`,");
  console.error("which starts a throwaway in-memory server.");
  process.exit(1);
}

// A believable ghost: a car looping around a circuit, one sample per step.
const sampleGhost: Array<IGhost> = Array.from({ length: 600 }, (_, i) => ({
  t: FIXED_DT + i * FIXED_DT,
  x: 1000 + Math.cos(i / 40) * 800,
  y: 1000 + Math.sin(i / 40) * 600,
  a: Math.sin(i / 40) * Math.PI,
}));
const encoded = encodeGhost(sampleGhost)!;

const create = async (fields: Record<string, unknown>): Promise<RecordId> => {
  const [created] = await player.query<[Array<{ id: RecordId }>]>(
    `CREATE score SET circuit = $circuit, name = $name, lap_ms = $lap_ms,
       ghost = $ghost, ghost_t0 = $ghost_t0`,
    {
      circuit: "test",
      name: "Tester",
      lap_ms: 30000,
      ghost: encoded.data,
      ghost_t0: encoded.t0,
      ...fields,
    },
  );
  return created[0].id;
};

console.log("\nsubmitting scores");
const fastest = await create({ name: "Martin", lap_ms: 21500 });
await create({ name: "Slow Coach", lap_ms: 45000 });
await create({ name: "Mid Field", lap_ms: 30250 });
// A faster run on a different circuit: it must not show up on this board.
await create({ name: "Other Track", lap_ms: 9000, circuit: "drift" });

const [board] = await player.query<[Array<Record<string, unknown>>]>(
  `SELECT id, name, lap_ms, created FROM score
     WHERE circuit = $circuit ORDER BY lap_ms ASC LIMIT 20`,
  { circuit: "test" },
);
check("board is ordered fastest first", board[0].name === "Martin", JSON.stringify(board.map((r) => r.name)));
check("board excludes the ghost blob", !("ghost" in board[0]));
check(
  "board is scoped to the circuit",
  board.length === 3 && !board.some((r) => r.name === "Other Track"),
  JSON.stringify(board.map((r) => r.name)),
);

console.log("\nname rejection");
await rejects("longer than 16 characters", () => create({ name: "x".repeat(17) }));
await rejects("empty after trimming", () => create({ name: "   " }));
await rejects("markup", () => create({ name: "<script>alert(1)</script>" }));
await rejects("quotes and ampersands", () => create({ name: 'a"b&c' }));
await rejects("profanity", () => create({ name: "fuckwit" }));
await rejects("spaced-out profanity", () => create({ name: "s h i t" }));
await rejects("leetspeak profanity", () => create({ name: "sh1t" }));
await rejects("punctuated profanity", () => create({ name: "c-u-n-t" }));
await rejects("a name that is only a short slur", () => create({ name: "ass" }));
await rejects("profanity at the end of a name", () => create({ name: "Mr Bastard" }));

console.log("\nnames that must still work");
for (const name of ["Cassidy", "Dickson", "Scunthorpe", "Analyst", "Martin S", "x_1", "A-1", "007"]) {
  try {
    await create({ name, circuit: "seoul" });
    check(`accepts ${JSON.stringify(name)}`, true);
  } catch (error) {
    check(`accepts ${JSON.stringify(name)}`, false, String(error).slice(0, 120));
  }
}

console.log("\nfield bounds");
await rejects("unknown circuit", () => create({ circuit: "nope" }));
await rejects("lap time below the floor", () => create({ lap_ms: 500 }));
await rejects("lap time above the ceiling", () => create({ lap_ms: 240001 }));
await rejects("empty ghost", () => create({ ghost: "" }));
await rejects("oversized ghost", () => create({ ghost: "A".repeat(131073) }));

console.log("\nimmutability");
const target = fastest;
await player.query("UPDATE $id SET name = 'Hacked'", { id: target });
await player.query("UPDATE $id SET lap_ms = 1", { id: target });
await player.query("DELETE $id", { id: target });
const [after] = await player.query<[Array<Record<string, unknown>>]>(
  "SELECT id, name, lap_ms FROM score WHERE id = $id",
  { id: target },
);
check("the row survives UPDATE and DELETE", after.length === 1);
check("its name is unchanged", after[0]?.name === "Martin", String(after[0]?.name));
check("its lap time is unchanged", Number(after[0]?.lap_ms) === 21500);

console.log("\nunauthenticated access");
const anon = new Surreal();
await anon.connect(ENDPOINT);
await anon.use({ namespace: NS, database: DB });
await rejects("cannot read the board", () => anon.query("SELECT * FROM score"));
await rejects("cannot submit", () =>
  anon.query("CREATE score SET circuit='test', name='Nope', lap_ms=5000, ghost='AA'"));
await rejects("cannot read the guest record", () => anon.query("SELECT * FROM guest"));
await anon.close();

console.log("\nghost round trip");
const [ghostRows] = await player.query<[Array<Record<string, unknown>>]>(
  "SELECT ghost, ghost_t0 FROM score WHERE id = $id",
  { id: target },
);
const restored = decodeGhost(String(ghostRows[0].ghost), Number(ghostRows[0].ghost_t0), FIXED_DT);
check("sample count survives", restored.length === sampleGhost.length, `${restored.length}`);

let maxPos = 0;
let maxAng = 0;
let maxTime = 0;
sampleGhost.forEach((original, i) => {
  maxPos = Math.max(maxPos, Math.abs(original.x - restored[i].x), Math.abs(original.y - restored[i].y));
  maxAng = Math.max(maxAng, Math.abs(original.a - restored[i].a));
  maxTime = Math.max(maxTime, Math.abs(original.t - restored[i].t));
});
// The car is 30x40 world units, so a tenth of a unit is invisible.
check("position error is under 0.1 world units", maxPos < 0.1, maxPos.toFixed(4));
check("angle error is under 0.001 rad", maxAng < 0.001, maxAng.toFixed(6));
check("timestamps are reconstructed", maxTime < 1, maxTime.toFixed(4));

const packedBytes = encoded.data.length;
check("a 10 s lap packs under 8 KB", packedBytes < 8192, `${packedBytes} chars`);
console.log(`  info 600 samples -> ${packedBytes} base64 chars`);

await player.close();

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) process.exit(1);
