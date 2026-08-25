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
npx nx run database:status
npx nx run database:config
npx nx run database:start
npx nx run database:status
npx nx run database:stop
```

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
- Prisma schema and seed data belong to the later database schema task.
