# Local Database Infrastructure

This project provides local Docker Compose services for the thesis prototype:

- PostgreSQL for relational application data.
- MinIO for S3-compatible local object storage.

The credentials in `.env.example` are for local development only. Create a private `.env` file when you need to override them.

## Prerequisites

```bash
docker --version
docker compose version
```

## Commands

Run commands from the `web-app` directory.

```bash
npm run db:status
npx nx run database:config
npm run db:start
npm run db:logs
npm run db:stop
```

`db:start` waits for both healthchecks with a 120-second timeout. `db:logs` follows
logs until Ctrl+C. `db:stop` removes containers and the network while preserving
the PostgreSQL and MinIO named volumes. These scripts delegate to the `database`
Nx project. To start infrastructure, migrations, API, and frontend together, use
`npm run dev`; see the [workspace guide](../../README.md#start-and-stop-local-development).

You can also validate the Compose file directly:

```bash
docker compose -f infrastructure/database/docker-compose.yml config
```

## Default Endpoints

| Service       | URL                                                                 |
| ------------- | ------------------------------------------------------------------- |
| PostgreSQL    | `postgresql://uniwa:uniwa_dev_password@localhost:5432/uniwa_thesis` |
| MinIO API     | `http://localhost:9000`                                             |
| MinIO Console | `http://localhost:9001`                                             |

## Notes

- Docker named volumes keep local data outside the repository.
- Do not commit `.env` files or generated database/object-storage data.
- Prisma schema, migrations, and seed data live in `apps/api/prisma`; `npm run db:setup` prepares the database and demo data explicitly.
