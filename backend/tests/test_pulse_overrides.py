"""Tests for the Pulse overrides endpoints.

Covers:

* GET on a project with no override row returns empty defaults.
* PUT then GET round-trip — blob comes back identical.
* PUT twice — second wins (upsert) and ``updated_at`` advances.
* PUT records ``updated_by_user_id`` of the calling user.
* 403 when the caller doesn't have project access.

Calls the route handlers as plain functions, passing dependencies
explicitly (same trick the rest of the test suite uses — FastAPI's
``Depends(...)`` only runs during request dispatch).
"""

import os
import sys
import time
from datetime import datetime, timedelta

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from database import Base  # noqa: E402
from models import (  # noqa: E402, F401
    activity_log,
    developer,
    market_insight,
    persona,
    personal_task,
    project,
    project_file,
    project_goal,
    project_milestone,
    project_pulse_override,
    sprint,
    task,
    task_dependency,
    time_entry,
    user,
    user_story,
    work_item,
)
from models.project import Project  # noqa: E402
from models.project_pulse_override import ProjectPulseOverride  # noqa: E402
from models.user import User  # noqa: E402
from routers.pulse import (  # noqa: E402
    PulseOverridePayload,
    get_pulse_overrides,
    put_pulse_overrides,
)


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, expire_on_commit=False)
    session = Session()
    yield session
    session.close()


@pytest.fixture
def admin_user(db):
    """A system-admin user — bypasses per-project membership checks."""
    u = User(
        id=1,
        email="admin@x.com",
        name="Admin",
        role="admin",
        is_active=True,
        is_first_login=False,
    )
    db.add(u)
    db.commit()
    return u


@pytest.fixture
def other_admin(db):
    """Second admin to verify ``updated_by_user_id`` flips on a later PUT."""
    u = User(
        id=3,
        email="admin2@x.com",
        name="Admin Two",
        role="admin",
        is_active=True,
        is_first_login=False,
    )
    db.add(u)
    db.commit()
    return u


@pytest.fixture
def outsider_user(db):
    """A developer user with no project membership — used for 403 tests."""
    u = User(
        id=2,
        email="outsider@x.com",
        name="Outsider",
        role="developer",
        is_active=True,
        is_first_login=False,
    )
    db.add(u)
    db.commit()
    return u


def _make_project(db) -> Project:
    now = datetime.utcnow()
    p = Project(
        id=1,
        name="Pulse Project",
        key_prefix="PP",
        description="d",
        status="development",
        github_repo_urls=[],
        created_at=now - timedelta(days=30),
        end_date=now + timedelta(days=30),
    )
    db.add(p)
    db.commit()
    return p


# ---------------------------------------------------------------------------
# GET — first-time / empty state
# ---------------------------------------------------------------------------


class TestGetEmpty:
    def test_get_returns_empty_when_no_row(self, db, admin_user):
        proj = _make_project(db)
        result = get_pulse_overrides(project_id=proj.id, db=db, current_user=admin_user)
        assert result == {
            "data": {},
            "updated_at": None,
            "updated_by": None,
        }


# ---------------------------------------------------------------------------
# PUT / round-trip
# ---------------------------------------------------------------------------


class TestPutRoundTrip:
    def test_put_then_get_returns_identical_blob(self, db, admin_user):
        proj = _make_project(db)
        blob = {
            "narrative": "Q2 looking strong",
            "ledger": [
                {"name": "Phase 1", "amount": 50000},
                {"name": "Phase 2", "amount": 75000},
            ],
            "risks": [{"id": "r1", "severity": "high", "text": "vendor delay"}],
            "months": [{"m": "April 2026", "dev": 12000, "gtm": 3000}],
            "milestoneBudgets": {"ms-1": {"budget": 40000, "spent": 18000}},
        }

        put_result = put_pulse_overrides(
            project_id=proj.id,
            payload=PulseOverridePayload(data=blob),
            db=db,
            current_user=admin_user,
        )
        assert put_result["data"] == blob
        assert put_result["updated_at"] is not None
        assert put_result["updated_by"] == {
            "id": admin_user.id,
            "name": admin_user.name,
            "email": admin_user.email,
        }

        get_result = get_pulse_overrides(project_id=proj.id, db=db, current_user=admin_user)
        assert get_result["data"] == blob
        assert get_result["updated_by"]["id"] == admin_user.id

    def test_put_records_updated_by_user(self, db, admin_user):
        proj = _make_project(db)
        put_pulse_overrides(
            project_id=proj.id,
            payload=PulseOverridePayload(data={"narrative": "hi"}),
            db=db,
            current_user=admin_user,
        )
        row = (
            db.query(ProjectPulseOverride)
            .filter(ProjectPulseOverride.project_id == proj.id)
            .first()
        )
        assert row is not None
        assert row.updated_by_user_id == admin_user.id


# ---------------------------------------------------------------------------
# Upsert behavior
# ---------------------------------------------------------------------------


class TestUpsert:
    def test_second_put_wins_and_updated_at_advances(self, db, admin_user, other_admin):
        proj = _make_project(db)

        first = put_pulse_overrides(
            project_id=proj.id,
            payload=PulseOverridePayload(data={"narrative": "v1"}),
            db=db,
            current_user=admin_user,
        )
        first_ts = first["updated_at"]
        assert first["updated_by"]["id"] == admin_user.id

        # Sleep just long enough that the isoformat string is guaranteed
        # to differ (datetime.utcnow has microsecond resolution, but be
        # defensive against truncation on some drivers).
        time.sleep(0.01)

        second = put_pulse_overrides(
            project_id=proj.id,
            payload=PulseOverridePayload(
                data={"narrative": "v2", "ledger": [{"name": "x", "amount": 1}]}
            ),
            db=db,
            current_user=other_admin,
        )

        # Second blob wins entirely (we replace, not merge).
        assert second["data"] == {
            "narrative": "v2",
            "ledger": [{"name": "x", "amount": 1}],
        }
        # updated_by flipped to the new caller.
        assert second["updated_by"]["id"] == other_admin.id
        # updated_at strictly advanced.
        assert second["updated_at"] > first_ts

        # Still exactly one row — upsert, not insert.
        row_count = (
            db.query(ProjectPulseOverride)
            .filter(ProjectPulseOverride.project_id == proj.id)
            .count()
        )
        assert row_count == 1


# ---------------------------------------------------------------------------
# Authorization
# ---------------------------------------------------------------------------


class TestAccessControl:
    def test_get_403_when_outsider(self, db, outsider_user):
        proj = _make_project(db)
        with pytest.raises(HTTPException) as exc:
            get_pulse_overrides(project_id=proj.id, db=db, current_user=outsider_user)
        assert exc.value.status_code == 403

    def test_put_403_when_outsider(self, db, outsider_user):
        proj = _make_project(db)
        with pytest.raises(HTTPException) as exc:
            put_pulse_overrides(
                project_id=proj.id,
                payload=PulseOverridePayload(data={"narrative": "nope"}),
                db=db,
                current_user=outsider_user,
            )
        assert exc.value.status_code == 403
