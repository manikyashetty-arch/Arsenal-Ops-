"""Tests for ``services.hierarchy.validate_hierarchy``.

Mirrors the rules encoded on the frontend in
``app/src/lib/hierarchy/validateReparent.ts`` plus the depth-1 cap.
"""

import os
import sys
from datetime import datetime

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
from models.project import Project  # noqa: E402
from models.work_item import WorkItem  # noqa: E402
from services.hierarchy import validate_hierarchy  # noqa: E402


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, expire_on_commit=False)
    session = Session()
    yield session
    session.close()


def _add_item(db, *, id_, project_id, type_, parent_id=None, epic_id=None):
    item = WorkItem(
        id=id_,
        project_id=project_id,
        key=f"P{project_id}-{id_}",
        type=type_,
        title=f"item-{id_}",
        status="todo",
        priority="medium",
        parent_id=parent_id,
        epic_id=epic_id,
        created_at=datetime(2026, 1, 1),
        updated_at=datetime(2026, 1, 1),
    )
    db.add(item)
    return item


@pytest.fixture
def seed(db):
    """Two projects, an epic + story + task + bug in P1, an epic in P2."""
    db.add(
        Project(
            id=1,
            name="Alpha",
            description="",
            status="active",
            github_repo_urls=[],
            created_at=datetime(2026, 1, 1),
        )
    )
    db.add(
        Project(
            id=2,
            name="Beta",
            description="",
            status="active",
            github_repo_urls=[],
            created_at=datetime(2026, 1, 1),
        )
    )
    _add_item(db, id_=10, project_id=1, type_="epic")
    _add_item(db, id_=11, project_id=1, type_="user_story")
    _add_item(db, id_=12, project_id=1, type_="task")
    _add_item(db, id_=13, project_id=1, type_="bug")
    _add_item(db, id_=20, project_id=2, type_="epic")
    db.commit()


# ---------- Happy paths ----------


def test_create_standalone_task_passes(db, seed):
    validate_hierarchy(db, item_type="task", project_id=1, parent_id=None, epic_id=None)


def test_create_story_under_epic_passes(db, seed):
    validate_hierarchy(db, item_type="user_story", project_id=1, parent_id=None, epic_id=10)


def test_create_task_under_story_passes(db, seed):
    validate_hierarchy(db, item_type="task", project_id=1, parent_id=11, epic_id=None)


def test_create_task_under_task_passes(db, seed):
    validate_hierarchy(db, item_type="task", project_id=1, parent_id=12, epic_id=None)


def test_create_bug_under_epic_passes(db, seed):
    validate_hierarchy(db, item_type="bug", project_id=1, parent_id=None, epic_id=10)


def test_create_epic_standalone_passes(db, seed):
    validate_hierarchy(db, item_type="epic", project_id=1, parent_id=None, epic_id=None)


# ---------- Type rules: epic_id ----------


def test_epic_cannot_have_epic_id(db, seed):
    with pytest.raises(HTTPException) as exc:
        validate_hierarchy(db, item_type="epic", project_id=1, parent_id=None, epic_id=10)
    assert exc.value.status_code == 422
    assert exc.value.detail["field"] == "epic_id"
    assert exc.value.detail["code"] == "type_disallowed"


def test_story_epic_id_must_point_to_epic(db, seed):
    with pytest.raises(HTTPException) as exc:
        validate_hierarchy(db, item_type="user_story", project_id=1, parent_id=None, epic_id=11)
    assert exc.value.detail["code"] == "parent_type_invalid"


# ---------- Type rules: parent_id ----------


def test_epic_cannot_have_parent_id(db, seed):
    with pytest.raises(HTTPException) as exc:
        validate_hierarchy(db, item_type="epic", project_id=1, parent_id=11, epic_id=None)
    assert exc.value.detail["field"] == "parent_id"
    assert exc.value.detail["code"] == "type_disallowed"


def test_story_cannot_have_parent_id(db, seed):
    with pytest.raises(HTTPException) as exc:
        validate_hierarchy(db, item_type="user_story", project_id=1, parent_id=11, epic_id=None)
    assert exc.value.detail["code"] == "type_disallowed"


def test_bug_cannot_have_parent_id(db, seed):
    """Bug is leaf-only per the canonical model."""
    with pytest.raises(HTTPException) as exc:
        validate_hierarchy(db, item_type="bug", project_id=1, parent_id=11, epic_id=None)
    assert exc.value.detail["code"] == "type_disallowed"


def test_task_parent_must_be_task_or_story(db, seed):
    with pytest.raises(HTTPException) as exc:
        validate_hierarchy(db, item_type="task", project_id=1, parent_id=13, epic_id=None)
    assert exc.value.detail["code"] == "parent_type_invalid"


def test_task_parent_cannot_be_epic(db, seed):
    with pytest.raises(HTTPException) as exc:
        validate_hierarchy(db, item_type="task", project_id=1, parent_id=10, epic_id=None)
    assert exc.value.detail["code"] == "parent_type_invalid"


# ---------- Cross-cutting rules ----------


def test_parent_must_exist(db, seed):
    with pytest.raises(HTTPException) as exc:
        validate_hierarchy(db, item_type="task", project_id=1, parent_id=9999, epic_id=None)
    assert exc.value.detail["code"] == "parent_not_found"


def test_parent_must_be_same_project(db, seed):
    _add_item(db, id_=21, project_id=2, type_="user_story")
    db.commit()
    with pytest.raises(HTTPException) as exc:
        validate_hierarchy(db, item_type="task", project_id=1, parent_id=21, epic_id=None)
    assert exc.value.detail["code"] == "cross_project"


def test_epic_id_must_be_same_project(db, seed):
    with pytest.raises(HTTPException) as exc:
        validate_hierarchy(db, item_type="user_story", project_id=1, parent_id=None, epic_id=20)
    assert exc.value.detail["code"] == "cross_project"


def test_self_parent_rejected(db, seed):
    with pytest.raises(HTTPException) as exc:
        validate_hierarchy(
            db,
            item_type="task",
            project_id=1,
            parent_id=12,
            epic_id=None,
            item_id=12,
        )
    assert exc.value.detail["code"] == "self_parent"


# ---------- Depth-1 cap ----------


def test_depth_exceeded_when_parent_already_has_parent(db, seed):
    # Task 14 is a child of Task 12 (which is itself standalone -> depth 1 OK).
    _add_item(db, id_=14, project_id=1, type_="task", parent_id=12)
    db.commit()
    # Now creating Task 15 under Task 14 would be depth 2 -> reject.
    with pytest.raises(HTTPException) as exc:
        validate_hierarchy(db, item_type="task", project_id=1, parent_id=14, epic_id=None)
    assert exc.value.detail["code"] == "depth_exceeded"


def test_cannot_reparent_item_that_already_has_children(db, seed):
    # Task 14 is a child of Task 12. So Task 12 has a child.
    _add_item(db, id_=14, project_id=1, type_="task", parent_id=12)
    db.commit()
    # Trying to give Task 12 itself a parent would push 14 to depth 2.
    with pytest.raises(HTTPException) as exc:
        validate_hierarchy(
            db,
            item_type="task",
            project_id=1,
            parent_id=11,
            epic_id=None,
            item_id=12,
        )
    assert exc.value.detail["code"] == "has_children"


# ---------- Clearing parents ----------


def test_clearing_parent_id_passes(db, seed):
    validate_hierarchy(
        db,
        item_type="task",
        project_id=1,
        parent_id=None,
        epic_id=None,
        item_id=12,
    )


def test_clearing_epic_id_passes(db, seed):
    validate_hierarchy(
        db,
        item_type="user_story",
        project_id=1,
        parent_id=None,
        epic_id=None,
        item_id=11,
    )
