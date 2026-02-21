# app/main.py
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.logging import configure_logging
from app.routers import (
    comments_router,
    config_router,
    email_list_router,
    email_router,
    events_router,
    groups_router,
    likes_router,
    programs_router,
    tags_router,
    tasks_router,
    troops_router,
    users_router,
    workspaces_router,
)
from app.settings import settings


def create_app() -> FastAPI:
    configure_logging()
    app = FastAPI(title="Backend API")

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(config_router.router)
    app.include_router(email_list_router.router)
    app.include_router(email_router.router)
    app.include_router(users_router.router)
    app.include_router(groups_router.router)
    app.include_router(workspaces_router.router)
    app.include_router(troops_router.router)
    app.include_router(programs_router.router)
    app.include_router(events_router.router)
    app.include_router(tasks_router.router)
    app.include_router(tags_router.router)
    app.include_router(comments_router.router)
    app.include_router(likes_router.router)

    @app.get("/healthz")
    async def healthz() -> dict[str, bool]:
        return {"ok": True}

    return app


app = create_app()
