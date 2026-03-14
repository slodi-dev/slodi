# Slóði Backend

FastAPI + SQLAlchemy + Pydantic backend with PostgreSQL, Alembic migrations, Auth0 authentication, and a full test suite.

## Tech Stack

- **Python** ≥ 3.10
- **FastAPI** 0.117.1+ — API framework
- **SQLAlchemy 2.0** — async ORM (psycopg3 driver)
- **Pydantic v2** — schema validation
- **PostgreSQL 16** — database
- **Alembic** — database migrations
- **Auth0** — authentication (JWT, RS256)
- **aiocache** — in-process TTL caching
- **pytest + pytest-asyncio + Testcontainers** — testing
- **uv** — dependency and environment manager
- **Ruff** — linting and formatting
- **mypy** — type checking

## Project Layout

```
backend/
├── app/
│   ├── core/          # DB engine, settings, auth, logging, pagination
│   ├── domain/        # Business constraints
│   ├── models/        # SQLAlchemy ORM models
│   ├── repositories/  # Data access layer
│   ├── routers/       # FastAPI route handlers
│   ├── schemas/       # Pydantic v2 DTOs
│   ├── services/      # Business logic
│   ├── main.py        # FastAPI app factory
│   ├── settings.py    # Environment config (Pydantic BaseSettings)
│   └── utils.py       # Shared utilities
│
├── tests/             # pytest tests (unit + integration)
├── alembic/           # migrations (env.py, versions/)
├── alembic.ini
├── pyproject.toml
└── Makefile
```

## Setup

1. **Install dependencies:**

   ```bash
   uv sync --group dev
   ```

2. **Set up environment variables:**

   Copy `.env.example` to `.env` and configure the database connection, Auth0 domain, audience, and algorithms.

## Running

```bash
# Dev server (hot reload, port 8000)
make run

# Full stack via Docker Compose (PostgreSQL on :5454, API on :8000)
make docker-run
```

## Database Migrations

```bash
make makemigration m="your message"   # autogenerate migration
make migrate                          # apply migrations
make downgrade                        # roll back one step
```

All schema changes must go through Alembic — never write raw DDL.

## Testing

Unit tests run without external dependencies; integration tests require Docker.

```bash
make test-unit         # unit tests only (no Docker needed)
make test-integration  # integration tests (requires Docker daemon)
make test              # both
```

## Lint, Format & Type Check

```bash
make lint       # ruff check
make fmt        # ruff format
make typecheck  # mypy
```

## Docker Commands

```bash
make docker-run       # build and start containers
make docker-stop      # stop containers
make docker-clean     # stop and remove volumes + image
make docker-logs      # tail backend logs
make docker-shell     # shell into backend container
make docker-db-shell  # psql into postgres container
```

## Architecture

The codebase follows a strict layered architecture:

```
Routers → Services → Repositories → Models
```

- **Routers** (`app/routers/`): FastAPI route handlers, auth via `get_current_user()` and `require_permission()` dependency injection
- **Services** (`app/services/`): Business logic
- **Repositories** (`app/repositories/`): Data access layer
- **Models** (`app/models/`): SQLAlchemy 2.0 ORM; polymorphic inheritance `Content → Program | Event | Task`
- **Schemas** (`app/schemas/`): Pydantic v2 DTOs; business defaults and validation live here, not in models
- **Domain** (`app/domain/`): Business constraints
- **Core** (`app/core/`): DB engine, auth middleware, logging, pagination helpers

## Conventions

- Full type hints required (`mypy disallow_untyped_defs = true`)
- SQLAlchemy 2.0 mapped columns and relationships
- Business logic defaults belong in schemas, not models
- Auth0 is the sole authentication provider — do not add local auth
