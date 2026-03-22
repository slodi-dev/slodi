"""
Integration tests for program listing filters.

Run with:
    make test-integration
or:
    PYTHONPATH=. uv run pytest tests/test_program_filters.py -q -m integration

These tests spin up a real Postgres container via testcontainers, create
programs with various attributes, and verify that query parameter filters
return the correct subsets.
"""

from __future__ import annotations

import datetime as dt
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.auth import get_current_user
from app.core.db import get_session
from app.domain.enums import ContentType, EventInterval, Permissions, Weekday
from app.main import create_app
from app.models.program import Program
from app.models.user import User
from app.models.workspace import Workspace
from app.schemas.user import UserOut
from app.utils import get_current_datetime

# ── Helpers ───────────────────────────────────────────────────────────────────

_ADMIN_ID = uuid4()
_ADMIN_USER = UserOut(
    id=_ADMIN_ID,
    auth0_id="auth0|filter_admin",
    email="filter_admin@test.com",
    name="Filter Admin",
    pronouns=None,
    permissions=Permissions.admin,
    preferences=None,
)


def _make_client(db_session) -> TestClient:
    """Build a TestClient that injects *db_session* as the DB dependency."""
    app = create_app()

    async def override_get_session():
        yield db_session

    async def override_get_current_user():
        return _ADMIN_USER

    app.dependency_overrides[get_session] = override_get_session
    app.dependency_overrides[get_current_user] = override_get_current_user
    return TestClient(app)


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
def http(db):
    """HTTP test client wired to the per-test real DB session."""
    return _make_client(db)


@pytest.fixture
async def seed_data(db):
    """Create a workspace with several programs for filter testing."""
    # User
    user = User(
        id=_ADMIN_ID,
        name="Filter Admin",
        auth0_id="auth0|filter_admin",
        email="filter_admin@test.com",
    )
    db.add(user)

    # Second author for author_id filter
    other_user = User(
        name="Other Author",
        auth0_id="auth0|other_author",
        email="other@test.com",
    )
    db.add(other_user)

    # Workspace
    ws = Workspace(
        name="Filter Test WS",
        default_meeting_weekday=Weekday.monday,
        default_start_time=dt.time(20, 0),
        default_end_time=dt.time(21, 0),
        default_interval=EventInterval.weekly,
        season_start=dt.date.today(),
        settings=None,
        group_id=None,
    )
    db.add(ws)
    await db.flush()

    now = get_current_datetime()

    # Program 1: outdoor, short, free, for young scouts
    p1 = Program(
        name="Outdoor Adventure",
        description="A fun outdoor activity for everyone",
        created_at=now - dt.timedelta(days=5),
        author_id=user.id,
        workspace_id=ws.id,
        content_type=ContentType.program,
        duration_min=30,
        duration_max=60,
        prep_time_min=5,
        prep_time_max=10,
        count_min=5,
        count_max=20,
        price=0,
        location="Heidmork",
        equipment=["rope", "compass"],
        age=["Hrefnuskátar", "Drekaskátar"],
    )

    # Program 2: indoor, long, expensive, for older scouts
    p2 = Program(
        name="Indoor Workshop",
        description="Learn crafting skills indoors",
        created_at=now - dt.timedelta(days=3),
        author_id=user.id,
        workspace_id=ws.id,
        content_type=ContentType.program,
        duration_min=120,
        duration_max=180,
        prep_time_min=30,
        prep_time_max=60,
        count_min=10,
        count_max=30,
        price=5000,
        location="Skatabudin",
        equipment=["scissors", "glue", "paper"],
        age=["Fálkaskátar", "Dróttskátar"],
    )

    # Program 3: mixed, medium, cheap, by other author
    p3 = Program(
        name="Cooking Challenge",
        description="A test of culinary skills",
        created_at=now - dt.timedelta(days=1),
        author_id=other_user.id,
        workspace_id=ws.id,
        content_type=ContentType.program,
        duration_min=60,
        duration_max=90,
        prep_time_min=15,
        prep_time_max=20,
        count_min=3,
        count_max=10,
        price=1500,
        location="Reykjavik Community Center",
        equipment=["pots", "stove"],
        age=["Drekaskátar", "Fálkaskátar"],
    )

    # Program 4: minimal data (tests null handling)
    p4 = Program(
        name="Simple Game",
        description=None,
        created_at=now,
        author_id=user.id,
        workspace_id=ws.id,
        content_type=ContentType.program,
        price=None,
    )

    db.add_all([p1, p2, p3, p4])
    await db.commit()

    return {
        "workspace_id": ws.id,
        "user_id": user.id,
        "other_user_id": other_user.id,
        "programs": {"outdoor": p1, "indoor": p2, "cooking": p3, "simple": p4},
    }


# ── Tests ─────────────────────────────────────────────────────────────────────


@pytest.mark.integration
@pytest.mark.asyncio
class TestProgramFilters:
    """Integration tests for GET /workspaces/{id}/programs with filter params."""

    async def test_no_params_returns_all(self, http, seed_data):
        """No filter params returns all programs (backwards compatibility)."""
        sd = seed_data
        resp = http.get(f"/workspaces/{sd['workspace_id']}/programs")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 4

    async def test_search_by_name(self, http, seed_data):
        """search=outdoor matches program with 'Outdoor' in name."""
        sd = seed_data
        resp = http.get(
            f"/workspaces/{sd['workspace_id']}/programs",
            params={"search": "outdoor"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "Outdoor Adventure"

    async def test_search_by_description(self, http, seed_data):
        """search=test matches programs with 'test' in description."""
        sd = seed_data
        resp = http.get(
            f"/workspaces/{sd['workspace_id']}/programs",
            params={"search": "test"},
        )
        assert resp.status_code == 200
        names = {p["name"] for p in resp.json()}
        # "A test of culinary skills" in cooking description
        assert "Cooking Challenge" in names

    async def test_search_case_insensitive(self, http, seed_data):
        """Search is case-insensitive."""
        sd = seed_data
        resp = http.get(
            f"/workspaces/{sd['workspace_id']}/programs",
            params={"search": "WORKSHOP"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "Indoor Workshop"

    async def test_age_filter_single(self, http, seed_data):
        """age=hrefnuskatar returns only programs for that age group."""
        sd = seed_data
        resp = http.get(
            f"/workspaces/{sd['workspace_id']}/programs",
            params={"age": "Hrefnuskátar"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "Outdoor Adventure"

    async def test_age_filter_multiple_or(self, http, seed_data):
        """Multiple age params use OR logic."""
        sd = seed_data
        resp = http.get(
            f"/workspaces/{sd['workspace_id']}/programs",
            params={"age": ["Hrefnuskátar", "Fálkaskátar"]},
        )
        assert resp.status_code == 200
        names = {p["name"] for p in resp.json()}
        # outdoor has Hrefnuskátar, indoor has Fálkaskátar, cooking has both Drekaskátar+Fálkaskátar
        assert "Outdoor Adventure" in names
        assert "Indoor Workshop" in names
        assert "Cooking Challenge" in names

    async def test_duration_min_filter(self, http, seed_data):
        """duration_min=61 excludes programs whose duration_max < 61 (no overlap)."""
        sd = seed_data
        resp = http.get(
            f"/workspaces/{sd['workspace_id']}/programs",
            params={"duration_min": 61},
        )
        assert resp.status_code == 200
        names = {p["name"] for p in resp.json()}
        assert "Outdoor Adventure" not in names  # duration_max=60 < 61
        assert "Cooking Challenge" in names  # duration_max=90 >= 61
        assert "Indoor Workshop" in names  # duration_max=180 >= 61

    async def test_duration_max_filter(self, http, seed_data):
        """duration_max=90 excludes programs with duration_max > 90."""
        sd = seed_data
        resp = http.get(
            f"/workspaces/{sd['workspace_id']}/programs",
            params={"duration_max": 90},
        )
        assert resp.status_code == 200
        names = {p["name"] for p in resp.json()}
        assert "Outdoor Adventure" in names  # duration_max=60
        assert "Cooking Challenge" in names  # duration_max=90
        assert "Indoor Workshop" not in names  # duration_max=180

    async def test_price_max_zero_free_only(self, http, seed_data):
        """price_max=0 returns only free programs (price=0 or price=null)."""
        sd = seed_data
        resp = http.get(
            f"/workspaces/{sd['workspace_id']}/programs",
            params={"price_max": 0},
        )
        assert resp.status_code == 200
        names = {p["name"] for p in resp.json()}
        assert "Outdoor Adventure" in names  # price=0
        assert "Simple Game" in names  # price=None (treated as free)
        assert "Indoor Workshop" not in names  # price=5000
        assert "Cooking Challenge" not in names  # price=1500

    async def test_price_max_nonzero(self, http, seed_data):
        """price_max=1500 includes programs with price <= 1500."""
        sd = seed_data
        resp = http.get(
            f"/workspaces/{sd['workspace_id']}/programs",
            params={"price_max": 1500},
        )
        assert resp.status_code == 200
        names = {p["name"] for p in resp.json()}
        assert "Outdoor Adventure" in names  # price=0
        assert "Cooking Challenge" in names  # price=1500
        assert "Indoor Workshop" not in names  # price=5000

    async def test_location_partial_match(self, http, seed_data):
        """location=reykjavik matches partial location strings case-insensitively."""
        sd = seed_data
        resp = http.get(
            f"/workspaces/{sd['workspace_id']}/programs",
            params={"location": "reykjavik"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "Cooking Challenge"

    async def test_location_partial_match_broader(self, http, seed_data):
        """location=Skata matches 'Skatabudin'."""
        sd = seed_data
        resp = http.get(
            f"/workspaces/{sd['workspace_id']}/programs",
            params={"location": "Skata"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "Indoor Workshop"

    async def test_equipment_filter(self, http, seed_data):
        """equipment=rope matches programs containing 'rope' in equipment."""
        sd = seed_data
        resp = http.get(
            f"/workspaces/{sd['workspace_id']}/programs",
            params={"equipment": "rope"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "Outdoor Adventure"

    async def test_equipment_filter_or_logic(self, http, seed_data):
        """Multiple equipment values use OR logic."""
        sd = seed_data
        resp = http.get(
            f"/workspaces/{sd['workspace_id']}/programs",
            params={"equipment": ["rope", "pots"]},
        )
        assert resp.status_code == 200
        names = {p["name"] for p in resp.json()}
        assert "Outdoor Adventure" in names
        assert "Cooking Challenge" in names
        assert len(names) == 2

    async def test_author_id_filter(self, http, seed_data):
        """author_id filters to a specific author."""
        sd = seed_data
        resp = http.get(
            f"/workspaces/{sd['workspace_id']}/programs",
            params={"author_id": str(sd["other_user_id"])},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "Cooking Challenge"

    async def test_count_min_filter(self, http, seed_data):
        """count_min=11 excludes programs whose count_max < 11 (no overlap)."""
        sd = seed_data
        resp = http.get(
            f"/workspaces/{sd['workspace_id']}/programs",
            params={"count_min": 11},
        )
        assert resp.status_code == 200
        names = {p["name"] for p in resp.json()}
        assert "Indoor Workshop" in names  # count_max=30 >= 11
        assert "Outdoor Adventure" in names  # count_max=20 >= 11
        assert "Cooking Challenge" not in names  # count_max=10 < 11

    async def test_count_max_filter(self, http, seed_data):
        """count_max=9 excludes programs whose count_min > 9 (no overlap)."""
        sd = seed_data
        resp = http.get(
            f"/workspaces/{sd['workspace_id']}/programs",
            params={"count_max": 9},
        )
        assert resp.status_code == 200
        names = {p["name"] for p in resp.json()}
        assert "Outdoor Adventure" in names  # count_min=5 <= 9
        assert "Cooking Challenge" in names  # count_min=3 <= 9
        assert "Indoor Workshop" not in names  # count_min=10 > 9

    async def test_prep_time_min_filter(self, http, seed_data):
        """prep_time_min=30 returns only programs with prep_time_min >= 30."""
        sd = seed_data
        resp = http.get(
            f"/workspaces/{sd['workspace_id']}/programs",
            params={"prep_time_min": 30},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "Indoor Workshop"

    async def test_sort_by_oldest(self, http, seed_data):
        """sort_by=oldest returns programs ordered by created_at ASC."""
        sd = seed_data
        resp = http.get(
            f"/workspaces/{sd['workspace_id']}/programs",
            params={"sort_by": "oldest"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 4
        # Oldest first: outdoor (5d ago), indoor (3d ago), cooking (1d ago), simple (now)
        assert data[0]["name"] == "Outdoor Adventure"
        assert data[-1]["name"] == "Simple Game"

    async def test_sort_by_newest(self, http, seed_data):
        """sort_by=newest returns programs ordered by created_at DESC."""
        sd = seed_data
        resp = http.get(
            f"/workspaces/{sd['workspace_id']}/programs",
            params={"sort_by": "newest"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data[0]["name"] == "Simple Game"
        assert data[-1]["name"] == "Outdoor Adventure"

    async def test_sort_by_alpha(self, http, seed_data):
        """sort_by=alpha returns programs ordered alphabetically by name."""
        sd = seed_data
        resp = http.get(
            f"/workspaces/{sd['workspace_id']}/programs",
            params={"sort_by": "alpha"},
        )
        assert resp.status_code == 200
        data = resp.json()
        names = [p["name"] for p in data]
        assert names == sorted(names)

    async def test_combined_filters_intersection(self, http, seed_data):
        """Combining two filters returns the intersection."""
        sd = seed_data
        resp = http.get(
            f"/workspaces/{sd['workspace_id']}/programs",
            params={"duration_min": 30, "price_max": 1500},
        )
        assert resp.status_code == 200
        names = {p["name"] for p in resp.json()}
        # duration_min >= 30: outdoor(30), indoor(120), cooking(60)
        # price <= 1500: outdoor(0), cooking(1500)
        # intersection: outdoor, cooking
        assert names == {"Outdoor Adventure", "Cooking Challenge"}

    async def test_combined_search_and_age(self, http, seed_data):
        """Combining search and age filter returns intersection."""
        sd = seed_data
        resp = http.get(
            f"/workspaces/{sd['workspace_id']}/programs",
            params={"search": "challenge", "age": "Drekaskátar"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "Cooking Challenge"

    async def test_no_matches_returns_empty(self, http, seed_data):
        """Filters that match nothing return an empty list."""
        sd = seed_data
        resp = http.get(
            f"/workspaces/{sd['workspace_id']}/programs",
            params={"search": "nonexistent_xyz"},
        )
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_pagination_with_filters(self, http, seed_data):
        """Pagination works correctly with filters applied."""
        sd = seed_data
        # Get first page with limit=1 and sort_by=oldest
        resp = http.get(
            f"/workspaces/{sd['workspace_id']}/programs",
            params={"sort_by": "oldest", "limit": 1, "offset": 0},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "Outdoor Adventure"
        # Total count header should reflect filtered total
        assert resp.headers["X-Total-Count"] == "4"

    async def test_pagination_headers_with_filters(self, http, seed_data):
        """X-Total-Count reflects filtered count, not total."""
        sd = seed_data
        resp = http.get(
            f"/workspaces/{sd['workspace_id']}/programs",
            params={"search": "outdoor"},
        )
        assert resp.status_code == 200
        assert resp.headers["X-Total-Count"] == "1"
