# app/main.py
from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.logging import configure_logging
from app.routers import (
    comments_router,
    email_list_router,
    email_router,
    events_router,
    game_scores_router,
    groups_router,
    heidursordla_router,
    likes_router,
    programs_router,
    tags_router,
    tasks_router,
    troops_router,
    users_router,
    workspaces_router,
)
from app.settings import settings

_log = logging.getLogger(__name__)


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

    # Starlette's CORSMiddleware does not reliably add CORS headers when an
    # unhandled Python exception propagates out of a route handler (the
    # response is never "started", so the middleware's send-wrapper never
    # fires).  Registering an explicit handler here converts every such
    # exception into a proper JSONResponse *before* it reaches the CORS
    # layer, guaranteeing the browser always gets the expected header and can
    # read the error body — rather than seeing a misleading CORS failure that
    # hides the real problem.
    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        _log.exception("Unhandled exception for %s %s", request.method, request.url)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
        )

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
    app.include_router(heidursordla_router.router)
    app.include_router(game_scores_router.router)

    @app.get("/healthz")
    async def healthz() -> dict[str, bool]:
        return {"ok": True}

    return app


app = create_app()
