# Academic Hub Web App

Nx workspace for the thesis prototype: a content-centered, feedback-driven LMS built as a React/Vite web app, Express REST API, shared TypeScript/Zod contracts package, Prisma/PostgreSQL persistence layer, local MinIO object storage, and Playwright e2e test project.

## Projects

| Project     | Path                      | Purpose                                              |
| ----------- | ------------------------- | ---------------------------------------------------- |
| `web`       | `apps/web`                | React/Vite SPA shell                                 |
| `api`       | `apps/api`                | Express REST API shell, Prisma schema, and seed data |
| `web-e2e`   | `apps/web-e2e`            | Playwright browser tests for the web app             |
| `contracts` | `packages/contracts`      | Shared TypeScript types and Zod schemas              |
| `database`  | `infrastructure/database` | Docker Compose PostgreSQL and MinIO services         |

## Prerequisites

- Node.js `22.23.2` from `.nvmrc`
- npm `10.9.8`
- Docker with Compose v2 for local PostgreSQL and MinIO
- Playwright Chromium browser for e2e tests

```bash
nvm use
npm install
npx playwright install chromium
```

Create a private local env file when you need runtime services:

```bash
cp .env.example .env
```

The example credentials are local-only placeholders. Do not commit `.env` or real secrets.

## Demo Accounts

The Prisma seed creates local-only demo users for exercising the prototype. These accounts all use the shared development password `AcademicHubDemo2026!`; never reuse it outside local development.

| Role      | Email                              |
| --------- | ---------------------------------- |
| Admin     | `admin@academic-hub.local`         |
| Professor | `professor@academic-hub.local`     |
| Student   | `maria.student@academic-hub.local` |
| Student   | `nikos.student@academic-hub.local` |

## Frontend Authentication

Open `/login` and use a demo account above. Login uses the existing API's
HttpOnly session cookie; no credentials or tokens are persisted in browser
storage. The frontend accepts the shared email/password contract, including
the local demo email domains.

`apps/web/src/auth/session.ts` owns the TanStack Query key `['auth', 'session']`.
The app checks the session on load, window focus, and reconnect. A failed lookup
shows a retry action; it is distinct from the normal guest response. Login and
logout cancel stale queries, replace session state, and remove previous-user
query and mutation caches. The API client obtains a fresh CSRF token before
each auth POST, serializes those request pairs within a tab, and retries once
only for `403 / CSRF_TOKEN_INVALID`. The configured backend header must match
the client convention `x-csrf-token` (DEC-015).

Successful login redirects to `/admin`, `/professor`, or `/student`. These
minimal screens show identity and logout; wrong-role visits redirect to the
current user's role, and guests go to `/login`. Authenticated visits to `/login`
also redirect to the user's role. `/` remains the public home/status page.
Backend authorization remains authoritative. Full dashboards/navigation belong
to task 11; registration, SSO, reset, and remember-me are not implemented here.

The responsive login follows the active Figma frames `47:5`, `47:48`, and
`47:232` and Design Notes `29:4`, inspected on 2026-09-07. It uses a single
column below 1024px, shared navy/teal tokens, and locally served Inter fonts.
Recheck the evolving Figma page before each UI task as described in `AGENTS.md`.

Unit/component tests cover transport, state transitions, redirects, failures,
and stale responses. The existing Playwright suite covers navigation and
keyboard use with an isolated guest-session fixture; full auth e2e belongs to
task 12. To type-check the web tests and Vite configs as well as application
code, run `npx tsc -p apps/web/tsconfig.json --noEmit --allowImportingTsExtensions`.

## Common Commands

Run commands from this `web-app` directory.

### Start and stop local development

The shortcuts below are defined in the `scripts` object in `package.json`. Each
script delegates to existing Nx projects, so the same targets remain available
through the Nx CLI.

| Command                                        | Purpose                                                                                                                                             |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                                  | Start PostgreSQL and MinIO, wait for healthchecks, generate the Prisma client, apply committed migrations, then serve API and frontend concurrently |
| `npm run dev:api`                              | Serve only the API; assumes infrastructure and Prisma setup are ready                                                                               |
| `npm run dev:web`                              | Serve only the frontend                                                                                                                             |
| `npm run db:start`                             | Start PostgreSQL and MinIO and wait up to 120 seconds for readiness                                                                                 |
| `npm run db:stop`                              | Stop/remove infrastructure containers and their network, preserving named data volumes                                                              |
| `npm run db:status`                            | Show infrastructure container status                                                                                                                |
| `npm run db:logs`                              | Follow PostgreSQL and MinIO logs; Ctrl+C exits the log viewer                                                                                       |
| `npm run db:setup`                             | Start infrastructure, generate Prisma client, apply migrations, and seed demo data                                                                  |
| `npm run db:migrate -- --name describe_change` | Create/apply a development migration after editing the Prisma schema                                                                                |
| `npm run db:seed`                              | Explicitly run the demo seed against a prepared database                                                                                            |

First-time setup, after installing dependencies and creating `.env`:

```bash
npm run db:setup
npm run dev
```

For subsequent sessions, run `npm run dev`. Open `http://localhost:4200`.
Check dependency readiness at `http://localhost:3000/api/readiness` or through
the frontend proxy at `http://localhost:4200/api/readiness`.

To stop the entire stack, press **Ctrl+C in the terminal running `dev`** to stop
the API and frontend, then run:

```bash
npm run db:stop
```

The infrastructure runs in the background and stays up after Ctrl+C, including
when application startup fails. `db:stop` only controls the infrastructure;
individually started API/frontend terminals also need Ctrl+C. Database records
and stored files survive this shutdown. Normal startup does not seed again;
`db:setup` and `db:seed` can update existing demo records, so use them intentionally.

The `dev` script uses `&&` to stop startup if a prerequisite fails. Prisma
`migrate deploy` applies existing migration files without creating migrations or
resetting the database. Nx `run-many` runs the two servers concurrently with
prefixed terminal output. `NX_NATIVE_COMMAND_RUNNER=false` keeps Ctrl+C under
the parent process so one interrupt stops both servers; the native Nx terminal
runner otherwise stopped only one server in local verification. This environment
assignment uses a POSIX shell (Linux/macOS/WSL); npm on Windows requires an
equivalent shell or an environment-variable wrapper.

The API target currently has no automatic restart on
source edits; restart the command after backend changes. Vite handles frontend
hot updates.

### Using Yarn as a script runner

These are standard package scripts, so a compatible Yarn installation can invoke
them as `yarn dev`, `yarn db:start`, `yarn db:stop`, and so on. For example:

```json
{
  "scripts": {
    "db:start": "nx run database:start",
    "db:stop": "nx run database:stop"
  }
}
```

This repository currently pins `npm@10.9.8` and commits `package-lock.json`.
Use npm for dependency installation. Corepack-managed Yarn may reject this
workspace because its `packageManager` is npm; the documented `npm run` commands
work with the current setup. Switching dependency management to Yarn would also
require choosing/pinning a Yarn version, generating a Yarn lockfile, and updating
installation/CI instructions together.

```bash
npm run format:check
npm run lint
npx nx show projects
```

Build projects:

```bash
npx nx build contracts
npx nx build api
npx nx build web
```

Run unit/integration tests:

```bash
npx nx test contracts
npx nx test api
npx nx test web
```

Run the web app and API during local development:

```bash
npx nx serve api
npx nx serve web
```

The default web app URL is `http://localhost:4200`; the API listens on `http://localhost:3000`. Browser API calls use relative `/api/...` URLs by default, and Vite proxies them to `API_ORIGIN` from the workspace `.env` file. Leave `VITE_API_BASE_URL` blank locally unless you intentionally need a browser-visible API override.

Backend runtime configuration is validated in `apps/api/src/config/env.ts`. Local development defaults cover PostgreSQL, MinIO/S3-compatible storage, session cookie settings, and CSRF settings. Production startup rejects placeholder or weak `SESSION_SECRET` and `CSRF_SECRET` values and requires `SESSION_COOKIE_SECURE=true`.

## Database And Object Storage

The `database` Nx project wraps Docker Compose for PostgreSQL and MinIO.

```bash
npx nx run database:config
npx nx run database:start
npx nx run database:status
npx nx run database:stop
```

Prisma commands are exposed through the `api` project:

```bash
npx nx run api:prisma-validate
npx nx run api:prisma-format
npx nx run api:prisma-generate
npx nx run api:prisma-migrate-deploy
npx nx run api:prisma-migrate-dev -- --name init
npx nx run api:prisma-seed
```

## Should the apps run in containers?

For everyday development, the current split is a practical default: PostgreSQL
and MinIO in Compose, with the API and Vite running locally under Nx. This keeps
debugging, dependency installation, and frontend hot updates straightforward.

An optional full Compose stack is useful for reproducible demos, onboarding, and
deployment checks. It would have separate API, frontend, PostgreSQL, and MinIO
services, plus a one-shot migration job. The shared `contracts` package belongs
in application builds; it is not a running service. `web-e2e` is a test runner,
not a permanent application container.

For a deployment-style stack, build the Vite frontend and serve its static files
with a web server such as Nginx, proxying `/api` to the API service. Build a runnable
API image too: the current `api:build` target only generates Prisma and typechecks;
it does not emit a deployable JavaScript bundle. Within Compose, use service names
such as `postgres:5432` and `minio:9000` for backend connections. Browser requests
must still use a browser-accessible origin or same-origin `/api` proxy. A container
development mode would additionally need source watching/sync and a dependency
volume strategy. Keep that as a separate profile or Compose override if added.

References: [Nx run-many](https://nx.dev/docs/reference/nx-commands#nx-run-many),
[Compose health waiting](https://docs.docker.com/reference/cli/docker/compose/up/),
and [Compose production overrides](https://docs.docker.com/compose/how-tos/production/).

## End-To-End Tests

List and run the Playwright smoke tests:

```bash
npx nx e2e-list web-e2e
npx nx e2e web-e2e
```

You can also run Playwright directly:

```bash
npx playwright test --config apps/web-e2e/playwright.config.ts --list
npx playwright test --config apps/web-e2e/playwright.config.ts
```

The Playwright config starts the Vite web app on `http://127.0.0.1:4200`. Override the browser test base URL when needed:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:4200 npx playwright test --config apps/web-e2e/playwright.config.ts
```

## Scaffold Verification

Use this checklist after scaffold changes:

```bash
npm install
npm run format:check
npm run lint
npx nx show projects
npx nx build contracts
npx nx build api
npx nx build web
npx nx test contracts
npx nx test api
npx nx test web
npx nx run database:status
npx playwright test --config apps/web-e2e/playwright.config.ts --list
```

With Docker and browser permissions available, also run:

```bash
npx nx run database:start
npx nx run database:status
npx nx run database:stop
npx playwright test --config apps/web-e2e/playwright.config.ts
```

In restricted/sandboxed shells, Nx plugin workers can fail to establish IPC connections. Use this environment for Nx checks in that case:

```bash
NX_ISOLATE_PLUGINS=false NX_DAEMON=false npx nx show projects
```
