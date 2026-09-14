default:
    @just --list

dev:
    bun run dev

build:
    bun run build

deploy: build
    aws s3 sync dist/ s3://schaerweb

invalidate-cache DIST_ID +PATHS:
    aws cloudfront create-invalidation --distribution-id {{DIST_ID}} --paths "{{PATHS}}"

# --- database -------------------------------------------------------------
# Schema lives in db/. Point SURREAL_* at Surreal Cloud to apply it there; the
# defaults in db/apply.sh target a local instance.

surreal_port := "8123"

# Regenerate db/profanity.surql from src/game/profanity.ts
db-gen:
    bun run db/gen-profanity.ts

# Apply the schema to the instance in SURREAL_* (defaults to localhost:8123)
db-apply: db-gen
    ./db/apply.sh db/profanity.surql
    ./db/apply.sh db/schema.surql

# Run a throwaway in-memory server, apply the schema, run the integration test
db-test: db-gen
    #!/usr/bin/env bash
    set -euo pipefail
    surreal start --user root --pass root --bind "127.0.0.1:{{surreal_port}}" memory &
    SERVER=$!
    trap 'kill $SERVER 2>/dev/null || true' EXIT
    until surreal isready --endpoint "http://127.0.0.1:{{surreal_port}}" >/dev/null 2>&1; do sleep 0.2; done
    export SURREAL_ENDPOINT="http://127.0.0.1:{{surreal_port}}"
    ./db/apply.sh db/profanity.surql
    ./db/apply.sh db/schema.surql
    SURREAL_WS="ws://127.0.0.1:{{surreal_port}}/rpc" bun run db/test-leaderboard.ts

# Start a local instance for manual poking (Ctrl-C to stop)
db-dev:
    surreal start --user root --pass root --bind "127.0.0.1:{{surreal_port}}" memory
