from __future__ import annotations

import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from alembic import context
from app.models import (
    base,  # noqa: F401
    comment,  # noqa: F401
    content,  # noqa: F401
    email_list,  # noqa: F401
    event,  # noqa: F401
    game_score,  # noqa: F401
    group,  # noqa: F401
    like,  # noqa: F401
    program,  # noqa: F401
    tag,  # noqa: F401
    task,  # noqa: F401
    troop,  # noqa: F401
    user,  # noqa: F401
    workspace,  # noqa: F401
)
from app.models.base import Base
from app.settings import settings

# Alembic Config object
config = context.config

# Interpret .ini file for logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_url() -> str:
    return settings.db_url


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable: AsyncEngine = create_async_engine(
        get_url(),
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
