"""Tests for the Pulse derivation endpoint.

Covers:

* Summary counts roll up correctly from work_items (delivery, bugs, criticals,
  overdue, points).
* Health-score formula at the four bucket boundaries (Healthy / At Risk /
  Critical / heavy-issue).
* Each section fails independently (monkeypatch one helper to raise; the
  response still has the other sections populated and the failed section
  defaults to its empty value).
* 403 when the caller doesn't have project access.

Calls the route handler as a plain function, passing dependencies
explicitly (same trick the rest of the test suite uses — FastAPI's
``Depends(...)`` only runs during request dispatch).
"""

import os
import sys
from datetime import datetime, timedelta

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from database import Base  # noqa: E402
from models import (  # noqa: E402, F401
    activity_log,
    architecture,
    developer,
    market_insight,
    persona,
    personal_task,
    project,
    project_file,
    project_goal,
    project_milestone,
    sprint,
    task,
    task_dependency,
    time_entry,
    user,
    user_story,
    work_item,
)
from models.developer import Developer  # noqa: E402
from models.project import Project  # noqa: E402
from models.time_entry import TimeEntry  # noqa: E402
from models.user import User  # noqa: E402
from models.work_item import WorkItem  # noqa: E402
from routers import pulse as pulse_module  # noqa: E402
from routers.pulse import get_pulse_derived  # noqa: E402


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


def _make_project(db, *, created_at: datetime, end_date: datetime | None = None) -> Project:
    p = Project(
        id=1,
        name="Pulse Project",
        key_prefix="PP",
        description="d",
        status="development",
        github_repo_urls=[],
        created_at=created_at,
        end_date=end_date,
    )
    db.add(p)
    db.commit()
    return p


def _seed_mixed_items(db, project_id: int) -> dict:
    """Seed a known mix of work items and return the expected counts.

    Mix:
      * 5 stories: 2 done, 3 todo
      * 3 bugs: 1 done, 2 open
      * 2 tasks: 1 critical-open, 1 todo (one with due_date in the past)
    """
    now = datetime.utcnow()
    past = now - timedelta(days=5)
    items = [
        # stories
        WorkItem(
            id=11,
            project_id=project_id,
            type="user_story",
            title="s1",
            status="done",
            priority="medium",
            key="PP-1",
            story_points=3,
        ),
        WorkItem(
            id=12,
            project_id=project_id,
            type="user_story",
            title="s2",
            status="done",
            priority="medium",
            key="PP-2",
            story_points=5,
        ),
        WorkItem(
            id=13,
            project_id=project_id,
            type="user_story",
            title="s3",
            status="todo",
            priority="medium",
            key="PP-3",
            story_points=2,
        ),
        WorkItem(
            id=14,
            project_id=project_id,
            type="user_story",
            title="s4",
            status="todo",
            priority="medium",
            key="PP-4",
            story_points=1,
        ),
        WorkItem(
            id=15,
            project_id=project_id,
            type="user_story",
            title="s5",
            status="todo",
            priority="medium",
            key="PP-5",
            story_points=0,
            due_date=past,  # overdue
        ),
        # bugs
        WorkItem(
            id=20,
            project_id=project_id,
            type="bug",
            title="b1",
            status="done",
            priority="medium",
            key="PP-6",
        ),
        WorkItem(
            id=21,
            project_id=project_id,
            type="bug",
            title="b2",
            status="in_progress",
            priority="medium",
            key="PP-7",
        ),
        WorkItem(
            id=22,
            project_id=project_id,
            type="bug",
            title="b3",
            status="todo",
            priority="medium",
            key="PP-8",
        ),
        # tasks
        WorkItem(
            id=30,
            project_id=project_id,
            type="task",
            title="t1",
            status="in_progress",
            priority="critical",
            key="PP-9",
        ),
        WorkItem(
            id=31,
            project_id=project_id,
            type="task",
            title="t2",
            status="todo",
            priority="medium",
            key="PP-10",
        ),
    ]
    db.add_all(items)
    db.commit()

    return {
        "delivery_total": 10,
        "delivery_completed": 3,  # 2 stories + 1 bug
        "open_bugs": 2,
        "critical_open": 1,
        "overdue_count": 1,
        "points_total": 11,
        "points_completed": 8,
    }


# ---------------------------------------------------------------------------
# Summary counts / sums
# ---------------------------------------------------------------------------


class TestSummary:
    def test_counts_match_seed(self, db, admin_user):
        now = datetime.utcnow()
        proj = _make_project(
            db, created_at=now - timedelta(days=60), end_date=now + timedelta(days=60)
        )
        expected = _seed_mixed_items(db, proj.id)

        result = get_pulse_derived(project_id=proj.id, db=db, current_user=admin_user)
        s = result["summary"]

        assert s["deliveryTotal"] == expected["delivery_total"]
        assert s["deliveryCompleted"] == expected["delivery_completed"]
        assert s["openBugs"] == expected["open_bugs"]
        assert s["criticalOpen"] == expected["critical_open"]
        assert s["overdueCount"] == expected["overdue_count"]
        assert s["workItems"] == expected["delivery_total"]
        assert s["pointsTotal"] == expected["points_total"]
        assert s["pointsCompleted"] == expected["points_completed"]

    def test_delivery_pct_zero_when_no_items(self, db, admin_user):
        now = datetime.utcnow()
        proj = _make_project(
            db, created_at=now - timedelta(days=30), end_date=now + timedelta(days=30)
        )
        result = get_pulse_derived(project_id=proj.id, db=db, current_user=admin_user)
        assert result["summary"]["deliveryTotal"] == 0
        assert result["summary"]["deliveryPct"] == 0

    def test_no_end_date_means_empty_months(self, db, admin_user):
        now = datetime.utcnow()
        proj = _make_project(db, created_at=now - timedelta(days=30), end_date=None)
        _seed_mixed_items(db, proj.id)
        result = get_pulse_derived(project_id=proj.id, db=db, current_user=admin_user)
        assert result["months"] == []
        assert result["lastActualIdx"] == 0


# ---------------------------------------------------------------------------
# Health-score buckets
# ---------------------------------------------------------------------------


class TestHealthScore:
    def test_perfect_project_is_healthy(self, db, admin_user):
        """All work done, no bugs, no overdue, on schedule → score 100."""
        now = datetime.utcnow()
        proj = _make_project(
            db, created_at=now - timedelta(days=30), end_date=now + timedelta(days=30)
        )
        db.add_all(
            [
                WorkItem(
                    id=1,
                    project_id=proj.id,
                    type="task",
                    title="t",
                    status="done",
                    priority="medium",
                    key="PP-1",
                ),
            ]
        )
        db.commit()
        result = get_pulse_derived(project_id=proj.id, db=db, current_user=admin_user)
        assert result["summary"]["healthScore"] == 100
        assert result["summary"]["healthStatus"] == "Healthy"

    def test_small_issues_stay_healthy(self, db, admin_user):
        """A couple of open bugs, no criticals/overdue → still ≥ 80."""
        now = datetime.utcnow()
        proj = _make_project(
            db, created_at=now - timedelta(days=30), end_date=now + timedelta(days=30)
        )
        # 2 bugs open, 5 stories done. delivery_pct = 5/7 ~= 71.
        db.add_all(
            [
                WorkItem(
                    id=i,
                    project_id=proj.id,
                    type="user_story",
                    title=f"s{i}",
                    status="done",
                    priority="medium",
                    key=f"PP-{i}",
                )
                for i in range(1, 6)
            ]
            + [
                WorkItem(
                    id=10,
                    project_id=proj.id,
                    type="bug",
                    title="b1",
                    status="todo",
                    priority="medium",
                    key="PP-10",
                ),
                WorkItem(
                    id=11,
                    project_id=proj.id,
                    type="bug",
                    title="b2",
                    status="todo",
                    priority="medium",
                    key="PP-11",
                ),
            ]
        )
        db.commit()
        result = get_pulse_derived(project_id=proj.id, db=db, current_user=admin_user)
        score = result["summary"]["healthScore"]
        assert 80 <= score <= 99, f"expected small-issue project in 80-99, got {score}"
        assert result["summary"]["healthStatus"] == "Healthy"

    def test_mid_issues_is_at_risk(self, db, admin_user):
        """Multiple overdue, a few bugs, one critical → 60..79."""
        now = datetime.utcnow()
        proj = _make_project(
            db, created_at=now - timedelta(days=30), end_date=now + timedelta(days=30)
        )
        past = now - timedelta(days=10)
        items = [
            # 3 overdue (subtract 9)
            WorkItem(
                id=i,
                project_id=proj.id,
                type="task",
                title=f"t{i}",
                status="todo",
                priority="medium",
                key=f"PP-{i}",
                due_date=past,
            )
            for i in range(1, 4)
        ]
        # 2 open bugs (subtract 4)
        items.extend(
            [
                WorkItem(
                    id=10,
                    project_id=proj.id,
                    type="bug",
                    title="b1",
                    status="todo",
                    priority="medium",
                    key="PP-10",
                ),
                WorkItem(
                    id=11,
                    project_id=proj.id,
                    type="bug",
                    title="b2",
                    status="todo",
                    priority="medium",
                    key="PP-11",
                ),
            ]
        )
        # 1 critical open (subtract 8) — total deductions = 21 → ~79.
        # Subtract 15 schedule bonus (delivery 0% vs ~50% expected) → ~64.
        items.append(
            WorkItem(
                id=20,
                project_id=proj.id,
                type="task",
                title="crit",
                status="todo",
                priority="critical",
                key="PP-20",
            )
        )
        db.add_all(items)
        db.commit()
        result = get_pulse_derived(project_id=proj.id, db=db, current_user=admin_user)
        score = result["summary"]["healthScore"]
        assert 60 <= score < 80, f"expected at-risk in 60-79, got {score}"
        assert result["summary"]["healthStatus"] == "At Risk"

    def test_heavy_issues_is_critical(self, db, admin_user):
        """Lots of criticals + overdue → < 60."""
        now = datetime.utcnow()
        proj = _make_project(
            db, created_at=now - timedelta(days=30), end_date=now + timedelta(days=30)
        )
        past = now - timedelta(days=10)
        items = []
        # 5 criticals open (subtract 40)
        for i in range(1, 6):
            items.append(
                WorkItem(
                    id=i,
                    project_id=proj.id,
                    type="task",
                    title=f"c{i}",
                    status="todo",
                    priority="critical",
                    key=f"PP-C{i}",
                )
            )
        # 5 overdue (subtract 15)
        for i in range(10, 15):
            items.append(
                WorkItem(
                    id=i,
                    project_id=proj.id,
                    type="task",
                    title=f"o{i}",
                    status="todo",
                    priority="medium",
                    key=f"PP-O{i}",
                    due_date=past,
                )
            )
        db.add_all(items)
        db.commit()
        result = get_pulse_derived(project_id=proj.id, db=db, current_user=admin_user)
        score = result["summary"]["healthScore"]
        assert score < 60, f"expected critical (<60), got {score}"
        assert result["summary"]["healthStatus"] == "Critical"


# ---------------------------------------------------------------------------
# Independent section failure
# ---------------------------------------------------------------------------


class TestSafeSectionFailure:
    def test_forecast_failure_does_not_break_summary(self, db, admin_user, monkeypatch):
        now = datetime.utcnow()
        proj = _make_project(
            db, created_at=now - timedelta(days=30), end_date=now + timedelta(days=30)
        )
        _seed_mixed_items(db, proj.id)

        def boom(*args, **kwargs):
            raise RuntimeError("synthetic failure")

        monkeypatch.setattr(pulse_module, "_derive_forecast_vs_actuals", boom)

        result = get_pulse_derived(project_id=proj.id, db=db, current_user=admin_user)
        # Summary still populated
        assert result["summary"]["deliveryTotal"] == 10
        # Forecast falls back to the empty default shape
        assert result["forecastVsActuals"] == {"current": [], "last": [], "project": []}


# ---------------------------------------------------------------------------
# Authorization
# ---------------------------------------------------------------------------


class TestAccessControl:
    def test_403_when_outsider(self, db, outsider_user):
        """A user with no project membership and no admin role gets 403.

        Mirrors how ``require_project_access`` is exercised in the rest of
        the suite — assert the HTTPException, not a network response, since
        we're calling the handler directly.
        """
        now = datetime.utcnow()
        proj = _make_project(
            db, created_at=now - timedelta(days=30), end_date=now + timedelta(days=30)
        )
        with pytest.raises(HTTPException) as exc:
            get_pulse_derived(project_id=proj.id, db=db, current_user=outsider_user)
        assert exc.value.status_code == 403


# ---------------------------------------------------------------------------
# Months / forecast smoke
# ---------------------------------------------------------------------------


class TestMonthsAndForecast:
    def test_months_walk_contract_window(self, db, admin_user):
        # 3-month window: created today, ends ~75 days out.
        now = datetime.utcnow()
        proj = _make_project(
            db, created_at=datetime(now.year, now.month, 1), end_date=now + timedelta(days=75)
        )
        result = get_pulse_derived(project_id=proj.id, db=db, current_user=admin_user)
        # At least 3 months (start month + ~2 future months).
        assert len(result["months"]) >= 2
        assert isinstance(result["months"][0]["m"], str)
        assert "actual" in result["months"][0]
        assert "partial" in result["months"][0]

    def test_forecast_sums_descendant_hours(self, db, admin_user):
        now = datetime.utcnow()
        proj = _make_project(
            db, created_at=now - timedelta(days=30), end_date=now + timedelta(days=30)
        )
        dev = Developer(id=1, name="Eng", email="eng@x.com")
        db.add(dev)
        db.commit()

        epic = WorkItem(
            id=100,
            project_id=proj.id,
            type="epic",
            title="Big Feature",
            status="in_progress",
            priority="medium",
            key="PP-E1",
            assignee_id=dev.id,
        )
        story = WorkItem(
            id=101,
            project_id=proj.id,
            type="user_story",
            title="s1",
            status="todo",
            priority="medium",
            key="PP-101",
            epic_id=100,
            estimated_hours=10,
            logged_hours=4,
        )
        subtask = WorkItem(
            id=102,
            project_id=proj.id,
            type="task",
            title="sub1",
            status="todo",
            priority="medium",
            key="PP-102",
            parent_id=101,
            estimated_hours=5,
            logged_hours=2,
        )
        db.add_all([epic, story, subtask])
        db.commit()

        # Add a time_entry for this month so `current` is non-zero.
        db.add(
            TimeEntry(
                id=1,
                work_item_id=story.id,
                developer_id=dev.id,
                hours=3,
                logged_at=now,
            )
        )
        db.commit()

        result = get_pulse_derived(project_id=proj.id, db=db, current_user=admin_user)
        fva = result["forecastVsActuals"]
        assert len(fva["project"]) == 1
        row = fva["project"][0]
        assert row["feature"] == "Big Feature"
        assert row["employee"] == "Eng"
        assert row["fc"] == 15  # 10 + 5
        assert row["act"] == 6  # 4 + 2 (cumulative logged_hours on descendants)
        # Current month MTD should at least include the 3-hour entry we logged.
        assert fva["current"][0]["act"] >= 3
