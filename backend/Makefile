# Defaults — can be overridden on the `make` command line, e.g.
# `make run HOST=0.0.0.0` or `make run ARGS="--host 0.0.0.0 --port 8000"`
HOST ?= 127.0.0.1
PORT ?= 8000
ARGS ?=
.PHONY: test test-unit test-integration lint fmt migrate makemigration downgrade run seed docker-build docker-run docker-stop docker-clean docker-logs docker-shell docker-db-shell

test:
	PYTHONPATH=. uv run pytest -q -m "not integration"

test-unit:
	PYTHONPATH=. uv run pytest -q -m "not integration"

test-integration:
	PYTHONPATH=. uv run pytest -q -m integration

lint:
	uv run ruff check .

fmt:
	uv run ruff format .

makemigration:
	uv run alembic revision --autogenerate -m "$(m)"

migrate:
	uv run alembic upgrade head

downgrade:
	uv run alembic downgrade -1

run:
	PYTHONPATH=. uv run uvicorn app.main:app --reload

seed:
	PYTHONPATH=. uv run python seed.py

# Docker commands
docker-build:
	docker build -t slodi-backend:latest -f Dockerfile .

docker-run:
	docker compose up --build

docker-stop:
	docker compose down

docker-clean:
	docker compose down -v
	docker rmi slodi-backend:latest || true

docker-logs:
	docker compose logs -f backend

docker-shell:
	docker exec -it slodi-backend /bin/bash

docker-db-shell:
	docker exec -it slodi-postgres psql -U slodi -d slodi


# Example usage:
# make makemigration m="add new field to user"
# make migrate
# make docker-run          # Start everything with docker compose
# make docker-logs         # Watch logs
# make docker-shell        # Access backend container
# make docker-db-shell     # Access postgres directly
