#!/usr/bin/env bash
# Apply a .surql file to a SurrealDB instance via the HTTP /sql endpoint.
#
# `surreal import` refuses anything but `OPTION IMPORT;` scripts (which skip
# field processing), and the `surreal sql` REPL parses stdin line by line, so
# neither handles a multi-line schema. The /sql endpoint does.
#
# Usage: db/apply.sh db/schema.surql
# Env:   SURREAL_ENDPOINT SURREAL_USER SURREAL_PASS SURREAL_NS SURREAL_DB
#        SURREAL_TOKEN     (bearer token; used instead of user/pass if set)
#        APPLY_DEBUG=1     (print the request and the raw response)
set -euo pipefail

FILE="${1:?usage: db/apply.sh <file.surql>}"
ENDPOINT="${SURREAL_ENDPOINT:-http://127.0.0.1:8123}"
USER="${SURREAL_USER:-root}"
PASS="${SURREAL_PASS:-root}"
NS="${SURREAL_NS:-schaerweb}"
DB="${SURREAL_DB:-arcade}"

[ -f "$FILE" ] || { echo "no such file: $FILE" >&2; exit 1; }

# Surreal Cloud speaks HTTPS; a wss:// or ws:// endpoint is the SDK's URL, not
# this one. Convert rather than failing with an unhelpful curl error.
case "$ENDPOINT" in
  wss://*) ENDPOINT="https://${ENDPOINT#wss://}" ;;
  ws://*)  ENDPOINT="http://${ENDPOINT#ws://}" ;;
esac
ENDPOINT="${ENDPOINT%/}"
ENDPOINT="${ENDPOINT%/rpc}"

# How the credentials get authenticated:
#
#   root      HTTP Basic. This is the ONLY level Basic auth resolves — a
#             namespace or database user with the right password still fails
#             it with "There was a problem with authentication".
#   namespace
#   database  Exchanged for a token at /signin first, then sent as a bearer.
#
# Defaults to root; set SURREAL_AUTH_LEVEL for a scoped user. SURREAL_TOKEN
# skips all of this and is used as-is.
LEVEL="${SURREAL_AUTH_LEVEL:-root}"
TOKEN="${SURREAL_TOKEN:-}"

if [ -z "$TOKEN" ] && [ "$LEVEL" != "root" ]; then
  case "$LEVEL" in
    namespace) SCOPE="\"ns\":\"$NS\"" ;;
    database)  SCOPE="\"ns\":\"$NS\",\"db\":\"$DB\"" ;;
    *) echo "SURREAL_AUTH_LEVEL must be root, namespace or database (got '$LEVEL')" >&2; exit 1 ;;
  esac
  SIGNIN=$(curl -sS -X POST "$ENDPOINT/signin" \
    --header "Accept: application/json" \
    --data "{$SCOPE,\"user\":\"$USER\",\"pass\":\"$PASS\"}") || {
      echo "FAILED: could not reach $ENDPOINT/signin" >&2
      exit 1
    }
  TOKEN=$(printf '%s' "$SIGNIN" | python3 -c '
import json, sys
try:
    print(json.load(sys.stdin).get("token", ""))
except ValueError:
    print("")
')
  if [ -z "$TOKEN" ]; then
    echo "  signin as $LEVEL user '$USER' failed: $(printf '%s' "$SIGNIN" | head -c 500)" >&2
    echo "FAILED: $FILE" >&2
    exit 1
  fi
fi

if [ -n "$TOKEN" ]; then
  AUTH=(--header "Authorization: Bearer $TOKEN")
  DESCRIBED="token${SURREAL_TOKEN:+ (SURREAL_TOKEN)}"
else
  AUTH=(--user "$USER:$PASS")
  DESCRIBED="basic, root user '$USER'"
fi

if [ -n "${APPLY_DEBUG:-}" ]; then
  echo "POST $ENDPOINT/sql  (ns=$NS db=$DB auth=$DESCRIBED)" >&2
fi

# Keep the status line out of the body by asking for it separately, so a
# non-JSON error page can still be shown verbatim.
RESPONSE=$(curl -sS -X POST "$ENDPOINT/sql" \
  "${AUTH[@]}" \
  --header "Accept: application/json" \
  --header "surreal-ns: $NS" \
  --header "surreal-db: $DB" \
  --data-binary "@$FILE" \
  --write-out $'\n%{http_code}') || {
    echo "FAILED: could not reach $ENDPOINT" >&2
    exit 1
  }

STATUS="${RESPONSE##*$'\n'}"
BODY="${RESPONSE%$'\n'*}"

if [ -n "${APPLY_DEBUG:-}" ]; then
  echo "HTTP $STATUS" >&2
  echo "$BODY" >&2
fi

# The endpoint answers 200 with a per-statement status array, so failures have
# to be dug out of the body rather than the status code alone.
if ! STATUS="$STATUS" python3 -c '
import json, os, sys

status = os.environ["STATUS"]
body = sys.stdin.read()

def bail(message):
    print(f"  HTTP {status}: {message}", file=sys.stderr)
    sys.exit(1)

try:
    statements = json.loads(body)
except ValueError:
    # Not JSON at all: an auth failure, a proxy error page, or an empty body.
    # Show it, since that text is the whole diagnosis.
    bail(body.strip()[:2000] or "(empty response body)")

# An error response is an object; a successful one is a list of statements.
if isinstance(statements, dict):
    bail(statements.get("information") or statements.get("description") or json.dumps(statements)[:2000])

failed = [(i, s.get("result")) for i, s in enumerate(statements) if s.get("status") == "ERR"]
for i, result in failed:
    print(f"  statement {i}: {result}", file=sys.stderr)
sys.exit(1 if failed else 0)
' <<<"$BODY"; then
  echo "FAILED: $FILE" >&2
  exit 1
fi
echo "applied: $FILE"
