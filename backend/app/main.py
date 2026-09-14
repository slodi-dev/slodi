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
    troops_router,
    uploads_router,
    users_router,
    workspaces_router,
)
from app.settings import settings

_log = logging.getLogger(__name__)


def create_app() -> FastAPI:
    configure_logging()
    app = FastAPI(title="Backend API")

    # ── Order matters here ──────────────────────────────────────────────
    #
    # Starlette always puts `ServerErrorMiddleware` outermost, so a response
    # produced by `@app.exception_handler(Exception)` never passes back through
    # `CORSMiddleware` — it arrives at the browser with no
    # `access-control-allow-origin`, and `fetch` reports it as a network
    # failure rather than as the 500 it is. This file used to claim the
    # exception handler closed that gap. It did not, and the cost was real: a
    # 500 on every tagged item in Yfirferð presented as "Failed to fetch", with
    # no status and no body to read.
    #
    # So the catch-all is an ordinary middleware registered *before* CORS.
    # `add_middleware` prepends, so the last one added ends up outermost —
    # meaning CORS wraps this, sees a normal 500 response, and adds its headers.
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
        # Without this the browser receives the pagination headers and refuses
        # to let JavaScript read them — they are not on the CORS safelist. Every
        # paginated endpoint sends them; nothing could see them until now.
        expose_headers=["X-Total-Count", "X-Limit", "X-Offset", "Link"],
    )

    app.include_router(email_list_router.router)
    app.include_router(email_router.router)
    app.include_router(users_router.router)
    app.include_router(content_reports_router.router)
    app.include_router(moderation_router.router)
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
    app.include_router(game_saves_router.router)
    app.include_router(uploads_router.router)

    _warn_if_escalation_is_deaf()

    @app.get("/healthz")
    async def healthz() -> dict[str, bool]:
        return {"ok": True, "unsafe_escalation": bool(settings.moderation_email_list)}

    return app


def _warn_if_escalation_is_deaf() -> None:
    """Say loudly at boot when an `unsafe` report has nowhere to go.

    The release constraint is that `unsafe` is escalated rather than queued, and
    one of its measurable goals is zero unsafe reports unresolved past 24 hours.
    Both depend on `MODERATION_EMAILS` (or `ADMIN_EMAILS`, which it falls back
    to) being set in the deployed environment.

    When neither is, `ContentReportService._escalate` writes one line to the log
    per dropped escalation and returns — a failure nobody sees until they go
    looking for why the alias never heard about something. The board still pins
    unsafe reports to the top, so this is the out-of-band channel going quiet,
    not the report vanishing; that is worth knowing at boot rather than at
    incident time.
    """
    if not settings.moderation_email_list:
        _log.error(
            "MODERATION_EMAILS and ADMIN_EMAILS are both unset — an `unsafe` report "
            "will be pinned in Yfirferð but will not email anybody."
        )


app = create_app()
