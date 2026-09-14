# Martin Schaer website

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `bun install`             | Installs dependencies                            |
| `bun dev`             | Starts local dev server at `localhost:4321`      |
| `bun build`           | Build your production site to `./dist/`          |
| `bun preview`         | Preview your build locally, before deploying     |
| `bun astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `bun astro -- --help` | Get help using the Astro CLI                     |

## Leaderboard

Lap times and their ghost recordings go to a public SurrealDB instance. The site
is static, so the browser talks to the database directly: it signs in through the
`player` record access as a shared anonymous guest, which can list scores and
append new ones and nothing else. Name sanitization, the ghost size cap and the
ban on editing or deleting entries are all enforced by the schema — see
`db/schema.surql`, which is the only thing standing between the open internet and
the table.

| Command      | Action                                                            |
| :----------- | :---------------------------------------------------------------- |
| `just db-test` | Throwaway in-memory server, schema applied, integration test run |
| `just db-dev`  | Local instance on `127.0.0.1:8123` for poking at by hand         |
| `just db-apply`| Apply the schema to whatever `SURREAL_*` points at               |
| `just db-gen`  | Regenerate `db/profanity.surql` from `src/game/profanity.ts`     |

To point the site at an instance, copy `.env.example` to `.env` and fill it in.
With those unset the site builds and plays exactly as before, with the
leaderboard hidden and the SurrealDB bundle never loaded.

Applying the schema to Surreal Cloud:

```sh
SURREAL_ENDPOINT=https://your-instance.surreal.cloud \
SURREAL_USER=... SURREAL_PASS=... \
SURREAL_NS=schaerweb SURREAL_DB=arcade \
just db-apply
```

`SURREAL_ENDPOINT` is the HTTPS endpoint, not the `wss://…/rpc` URL the browser
uses in `.env` (the script converts one to the other if you mix them up).

Credentials must be a **root** user, because HTTP Basic auth only resolves root
users — a namespace or database user fails even with the right password. For a
scoped user set `SURREAL_AUTH_LEVEL=namespace` or `=database` and the script
exchanges the password for a token at `/signin` first. `SURREAL_TOKEN` skips
password auth entirely.

The schema needs permission to define tables, so whichever user you use needs
OWNER on the target database. Two auth errors are worth telling apart:

| Error | Meaning |
| :---- | :------ |
| `The password did not verify` | That root user exists; the password is wrong |
| `There was a problem with authentication` | No user found at that level — wrong name, wrong namespace/database, or a scoped user without `SURREAL_AUTH_LEVEL` |

`APPLY_DEBUG=1 just db-apply` prints the URL, scope, auth method and raw response.
