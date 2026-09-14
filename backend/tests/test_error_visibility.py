"""A 500 has to reach the browser as a 500, not as a network failure.

Starlette puts `ServerErrorMiddleware` outermost, so a response from
`@app.exception_handler(Exception)` never passes back through `CORSMiddleware`
and arrives with no `access-control-allow-origin`. `fetch` then reports
`TypeError: Failed to fetch` with no status and no body.

That is not cosmetic. It is what turned a one-line validation bug into a long
hunt: every tagged item in Yfirferð 500'd, and the frontend could only tell
that *something* had gone wrong on the network.
"""

from fastapi.testclient import TestClient

from app.main import create_app


def _app_with_a_broken_route():
    app = create_app()

    @app.get("/__boom")
    async def boom() -> dict[str, str]:
        raise RuntimeError("kaboom")

    return app


def test_a_500_still_carries_cors_headers():
    client = TestClient(_app_with_a_broken_route(), raise_server_exceptions=False)

    res = client.get("/__boom", headers={"Origin": "http://localhost:3000"})

    assert res.status_code == 500
    assert res.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert res.json()["detail"] == "Internal server error"


def test_a_normal_response_still_carries_them_too():
    client = TestClient(create_app())

    res = client.get("/healthz", headers={"Origin": "http://localhost:3000"})

    assert res.status_code == 200
    assert res.headers.get("access-control-allow-origin") == "http://localhost:3000"
