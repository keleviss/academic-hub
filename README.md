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

## Common Commands

Run commands from this `web-app` directory.

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
npx nx run api:prisma-migrate-dev -- --name init
npx nx run api:prisma-seed
```

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
