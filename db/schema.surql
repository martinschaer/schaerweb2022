-- schaerweb arcade leaderboard schema
-- Apply with:  just db-apply   (see Justfile)
--
-- The website is a static S3/CloudFront bundle: the browser talks to this
-- database directly and there is no server in between. Everything that
-- protects the data therefore lives here, not in the client.

-- ---------------------------------------------------------------------------
-- Anonymous access
-- ---------------------------------------------------------------------------
-- No credentials are shipped in the JS bundle. The browser signs in as the
-- single shared `guest:anon` record and gets a short-lived token whose rights
-- are exactly the table permissions defined below.

DEFINE TABLE OVERWRITE guest SCHEMAFULL
  PERMISSIONS NONE;

DEFINE FIELD OVERWRITE created ON guest TYPE datetime
  VALUE time::now() READONLY;

-- Idempotent so the whole file can be re-applied: CREATE errors on an existing
-- record, and UPSERT would fight the READONLY `created` field.
IF !record::exists(guest:anon) { CREATE guest:anon };

DEFINE ACCESS OVERWRITE player ON DATABASE TYPE RECORD
  SIGNIN ( SELECT * FROM ONLY guest:anon )
  DURATION FOR TOKEN 1h, FOR SESSION 12h;

-- ---------------------------------------------------------------------------
-- Name sanitization
-- ---------------------------------------------------------------------------
-- Two lists. `$PROFANITY_SUB` words are unambiguous enough to match anywhere in
-- the name; `$PROFANITY_EXACT` words are short and embed innocently in real
-- names (Cassidy, Scunthorpe), so they only match the whole name.

-- $PROFANITY_SUB, $PROFANITY_EXACT and $PROFANITY_ALLOW are generated into db/profanity.surql
-- from src/game/profanity.ts (the single source of truth for both the browser's
-- pre-check and this one) and must be applied before this file.

-- Fold a display name down to the bare letters an insult would be hiding in:
-- lowercase, common leetspeak substitutions, then drop everything that is not
-- a letter. This defeats "b a d", "b-a-d" and "b4d" in one step.
DEFINE FUNCTION OVERWRITE fn::normalize_name($name: string) -> string {
  LET $s = string::lowercase($name);
  LET $s = string::replace($s, "0", "o");
  LET $s = string::replace($s, "1", "i");
  LET $s = string::replace($s, "3", "e");
  LET $s = string::replace($s, "4", "a");
  LET $s = string::replace($s, "5", "s");
  LET $s = string::replace($s, "7", "t");
  LET $s = string::replace($s, "@", "a");
  LET $s = string::replace($s, "$", "s");
  RETURN string::replace($s, /[^a-z]/, "");
};

-- Emptiness is not this function's job: the charset and length asserts on the
-- field already guarantee a non-empty name, and a name of only digits or
-- punctuation ("007", "x_1") is perfectly good arcade form.
DEFINE FUNCTION OVERWRITE fn::name_is_clean($name: string) -> bool {
  LET $n = fn::normalize_name($name);
  -- Innocent words that happen to contain a substring match, the Scunthorpe
  -- problem. Checked first so a real name always wins over the blocklist.
  IF array::any($PROFANITY_ALLOW, |$w| $n = $w) { RETURN true };
  IF array::any($PROFANITY_SUB, |$w| string::contains($n, $w)) { RETURN false };
  RETURN !array::any($PROFANITY_EXACT, |$w| $n = $w);
};

-- ---------------------------------------------------------------------------
-- Scores
-- ---------------------------------------------------------------------------
-- Anyone signed in may read the board and append a run. Nobody may change or
-- remove a run, including their own: every field is READONLY and update/delete
-- are denied outright.

DEFINE TABLE OVERWRITE score SCHEMAFULL
  PERMISSIONS
    FOR select FULL
    FOR create WHERE $auth != NONE
    FOR update, delete NONE;

DEFINE FIELD OVERWRITE circuit ON score TYPE string
  ASSERT $value INSIDE ["test", "seoul", "drift", "page5"]
  READONLY;

-- The charset assert is what makes XSS impossible: no angle bracket, ampersand
-- or quote can ever be stored. The client still renders names with textContent.
DEFINE FIELD OVERWRITE name ON score TYPE string
  VALUE string::trim($value)
  ASSERT string::len($value) >= 1
     AND string::len($value) <= 16
     AND $value = /^[A-Za-z0-9 _-]+$/
     AND fn::name_is_clean($value)
  READONLY;

-- Lap time in milliseconds of simulation time; lower is better. The ceiling is
-- set by the ghost: 240 s at 60 Hz is 14400 samples, which base64s to 115200
-- characters and so stays inside the `ghost` length cap below.
DEFINE FIELD OVERWRITE lap_ms ON score TYPE int
  ASSERT $value > 1000 AND $value < 240000
  READONLY;

-- Base64 of the quantized ghost track (see src/game/ghost-codec.ts).
DEFINE FIELD OVERWRITE ghost ON score TYPE string
  ASSERT string::len($value) > 0 AND string::len($value) <= 131072
  READONLY;

-- Timestamp of the ghost's first sample; later samples are one fixed step apart.
DEFINE FIELD OVERWRITE ghost_t0 ON score TYPE int
  DEFAULT 0
  ASSERT $value >= 0 AND $value < 1000
  READONLY;

DEFINE FIELD OVERWRITE created ON score TYPE datetime
  VALUE time::now() READONLY;

DEFINE INDEX OVERWRITE idx_board ON score FIELDS circuit, lap_ms;
