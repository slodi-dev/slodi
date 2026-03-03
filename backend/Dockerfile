# ── Stage: base ──────────────────────────────────────────
# Shared layer for all targets — dependencies installed here
FROM python:3.12-slim AS base

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv

COPY pyproject.toml ./
COPY alembic.ini ./

RUN uv sync --no-dev

COPY alembic ./alembic
COPY app ./app
COPY seed.py ./

# ── Stage: test ──────────────────────────────────────────
# Includes dev/test dependencies, runs pytest
FROM base AS test

RUN uv sync
# ^ installs ALL dependencies including dev/test

COPY tests ./tests

CMD ["uv", "run", "pytest", "-v", "--tb=short"]

# ── Stage: production ────────────────────────────────────
# Clean runtime image — no test deps, no test files
FROM base AS production

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl --fail http://localhost:8000/healthz || exit 1

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
