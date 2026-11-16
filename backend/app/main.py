# app/main.py
from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.logging import configure_logging
from app.routers import (
    comments_router,
    content_reports_router,
    content_router,
    email_list_router,
    email_router,
    events_router,
    game_saves_router,
    game_scores_router,
    groups_router,
    heidursordla_router,
    likes_router,
    moderation_router,
    programs_router,
    tags_router,
    tasks_router,
    units_router,
    uploads_router,
    users_router,
    workspaces_router,
)
from app.settings import settings

_log = logging.getLogger(__name__)


def create_app() -> FastAPI:
    configure_logging()
    app = FastAPI(title="Backend API")

    # Registered before CORS so CORS also wraps 500 responses
    @app.middleware("http")
    async def catch_unhandled(request: Request, call_next: Any) -> Response:
        try:
            return await call_next(request)
        except Exception:
            _log.exception("Unhandled exception for %s %s", request.method, request.url)
            return JSONResponse(status_code=500, content={"detail": "Internal server error"})

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        # Let the browser read the pagination headers
        expose_headers=["X-Total-Count", "X-Limit", "X-Offset", "Link"],
    )

    app.include_router(email_list_router.router)
    app.include_router(email_router.router)
    app.include_router(users_router.router)
    app.include_router(content_reports_router.router)
    app.include_router(moderation_router.router)
    app.include_router(groups_router.router)
    app.include_router(workspaces_router.router)
    app.include_router(programs_router.router)
    app.include_router(content_router.router)
    app.include_router(events_router.router)
    app.include_router(tasks_router.router)
    app.include_router(tags_router.router)
    app.include_router(units_router.router)
    app.include_router(comments_router.router)
    app.include_router(likes_router.router)
    if settings.heidursordla_enabled:
        app.include_router(heidursordla_router.router)
    app.include_router(game_scores_router.router)
    app.include_router(game_saves_router.router)
    app.include_router(uploads_router.router)

    _warn_if_no_escalation_recipients()

    @app.get("/healthz")
    async def healthz() -> dict[str, bool]:
        return {"ok": True}

    return app


def _warn_if_no_escalation_recipients() -> None:
    if not settings.moderation_email_list:
        _log.error(
            "MODERATION_EMAILS and ADMIN_EMAILS are both unset — an `unsafe` report "
            "will be pinned in Yfirferð but will not email anybody."
        )


app = create_app()
