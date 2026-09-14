// The only module that knows about SurrealDB.
//
// The site is a static bundle on S3, so there is no server to proxy through:
// the browser talks to SurrealDB directly, signing in as the shared anonymous
// `guest:anon` record. That token can list scores and append new ones and
// nothing else — see db/schema.surql, where the permissions and every piece of
// validation actually live. The checks in here are for fast feedback only.

import { PROFANITY_ALLOW, PROFANITY_EXACT, PROFANITY_SUB } from "./profanity";
import { decodeGhost, encodeGhost, MAX_GHOST_SAMPLES } from "./ghost-codec";

const config = {
  url: import.meta.env.PUBLIC_SURREAL_URL,
  namespace: import.meta.env.PUBLIC_SURREAL_NS,
  database: import.meta.env.PUBLIC_SURREAL_DB,
  access: import.meta.env.PUBLIC_SURREAL_ACCESS || "player",
};

export const MAX_NAME_LENGTH = 16;
export const MIN_LAP_MS = 1001;
export const MAX_LAP_MS = 239999;
export const BOARD_LIMIT = 20;

type Config = {
  url: string;
  namespace: string;
  database: string;
  access: string;
};

// With any of these missing there is nothing to connect to, so the UI hides the
// leaderboard entirely rather than showing a panel that can only ever error.
function readConfig(): Config | null {
  const { url, namespace, database, access } = config;
  if (!url || !namespace || !database) return null;
  return { url, namespace, database, access };
}

export const isConfigured = () => readConfig() !== null;

export type ScoreRow = {
  id: string;
  name: string;
  lapMs: number;
  created: string;
};

type Surreal = import("surrealdb").Surreal;

let connection: Promise<Surreal> | null = null;

// The SDK is a few hundred KB and most visitors never open the board, so it is
// imported on first use rather than bundled into the game's entry chunk.
async function connect(): Promise<Surreal> {
  if (!connection) {
    connection = (async () => {
      const settings = readConfig();
      if (!settings) throw new Error("Leaderboard is not configured");
      const { url, namespace, database, access } = settings;
      const { Surreal: SurrealClass } = await import("surrealdb");
      const db = new SurrealClass();
      await db.connect(url);
      await db.use({ namespace, database });
      // No credentials: the access method signs everyone in as `guest:anon`.
      await db.signin({ namespace, database, access, variables: {} });
      return db;
    })().catch((error) => {
      // Don't cache a failed handshake: the next call should retry.
      connection = null;
      throw error;
    });
  }
  return connection;
}

// Mirrors fn::normalize_name in db/schema.surql. Kept in sync by hand; the
// database is the authority, this only spares the player a round trip.
const normalizeName = (name: string) =>
  name
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/@/g, "a")
    .replace(/\$/g, "s")
    .replace(/[^a-z]/g, "");

// Returns null when the name is acceptable, or a message to show the player.
export function validateName(raw: string): string | null {
  const name = raw.trim();
  if (name.length === 0) return "Enter a name";
  if (name.length > MAX_NAME_LENGTH) {
    return `At most ${MAX_NAME_LENGTH} characters`;
  }
  if (!/^[A-Za-z0-9 _-]+$/.test(name)) {
    return "Letters, numbers, space, - and _ only";
  }
  const folded = normalizeName(name);
  if (PROFANITY_ALLOW.includes(folded)) return null;
  if (PROFANITY_SUB.some((word) => folded.includes(word))) return "Pick another name";
  if (PROFANITY_EXACT.includes(folded)) return "Pick another name";
  return null;
}

export async function listScores(circuit: string): Promise<Array<ScoreRow>> {
  if (!isConfigured()) return [];
  const db = await connect();
  // Never select `ghost` here: twenty rows of track data would be megabytes.
  const [rows] = await db.query<[Array<Record<string, unknown>>]>(
    `SELECT id, name, lap_ms, created FROM score
       WHERE circuit = $circuit
       ORDER BY lap_ms ASC
       LIMIT $limit`,
    { circuit, limit: BOARD_LIMIT },
  );
  return (rows ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    lapMs: Number(row.lap_ms),
    created: String(row.created),
  }));
}

export type SubmitResult = { ok: true } | { ok: false; error: string };

export async function submitScore(entry: {
  circuit: string;
  name: string;
  lapMs: number;
  ghost: Array<IGhost>;
}): Promise<SubmitResult> {
  if (!isConfigured()) return { ok: false, error: "Leaderboard unavailable" };

  const nameError = validateName(entry.name);
  if (nameError) return { ok: false, error: nameError };

  const lapMs = Math.round(entry.lapMs);
  if (lapMs < MIN_LAP_MS || lapMs > MAX_LAP_MS) {
    return { ok: false, error: "Lap time out of range" };
  }

  const encoded = encodeGhost(entry.ghost);
  if (!encoded) {
    return {
      ok: false,
      error: entry.ghost.length > MAX_GHOST_SAMPLES ? "Lap too long" : "No ghost recorded",
    };
  }

  try {
    const db = await connect();
    await db.query(
      `CREATE score SET
         circuit = $circuit,
         name = $name,
         lap_ms = $lap_ms,
         ghost = $ghost,
         ghost_t0 = $ghost_t0`,
      {
        circuit: entry.circuit,
        name: entry.name.trim(),
        lap_ms: lapMs,
        ghost: encoded.data,
        ghost_t0: encoded.t0,
      },
    );
    return { ok: true };
  } catch (error) {
    console.warn("[leaderboard] submit failed", error);
    // Field asserts surface as a wall of SurrealQL; don't put that on screen.
    return { ok: false, error: "Could not save your score" };
  }
}

// Fetches one row's ghost blob and unpacks it. `step` is the game's fixed
// timestep, which is what the encoder dropped from every sample.
export async function loadGhost(id: string, step: number): Promise<Array<IGhost>> {
  if (!isConfigured()) return [];
  try {
    const db = await connect();
    // Rows carry their id as a RecordId, which listScores stringified to
    // "score:xyz"; StringRecordId hands that form back to the server as an id
    // rather than as a plain string.
    const { StringRecordId } = await import("surrealdb");
    const [rows] = await db.query<[Array<Record<string, unknown>>]>(
      "SELECT ghost, ghost_t0 FROM score WHERE id = $id",
      { id: new StringRecordId(id) },
    );
    const row = rows?.[0];
    if (!row?.ghost) return [];
    return decodeGhost(String(row.ghost), Number(row.ghost_t0 ?? 0), step);
  } catch (error) {
    console.warn("[leaderboard] ghost load failed", error);
    return [];
  }
}
