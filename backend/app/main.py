# app/main.py
from __future__ import annotations

from fastapi import FastAPI
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.requests import Request
from fastapi.middleware.cors import CORSMiddleware

from app.core.logging import configure_logging
from app.routers import (
    comments_router,
    email_list_router,
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


def create_app() -> FastAPI:
    configure_logging()
    app = FastAPI(title="Backend API")
    
    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "https://slodi.is",
        ],  # Frontend origin # TODO MAKE THIS AN ENVIROMENT VARIABLE
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(email_list_router.router)
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
    async def healthz():
        return {"ok": True}

    @app.get("/docs", include_in_schema=False)
    async def custom_swagger_ui_html(req: Request):
        root_path = req.scope.get("root_path", "").rstrip("/")
        openapi_url = root_path + app.openapi_url
        return get_swagger_ui_html(
            openapi_url=openapi_url,
            title="API",
        )

    return app


app = create_app()
