"""Audit existing work_items rows against the canonical hierarchy rules.

Prints any rows that would be rejected by ``services.hierarchy.validate_hierarchy``
if they were created today. Read-only — does not modify the database.

Run from the backend dir:

    python -m scripts.audit_hierarchy
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi import HTTPException  # noqa: E402
from sqlalchemy import text  # noqa: E402

from database import SessionLocal  # noqa: E402

# Eagerly import every model module so the WorkItem mapper (which validate_
# hierarchy queries) and its relationship() string references resolve.
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
from services.hierarchy import validate_hierarchy  # noqa: E402


def main() -> int:
    db = SessionLocal()
    try:
        # Read raw columns directly — avoids depending on the full ORM column
        # set so this still runs against partially-migrated local DBs.
        rows = db.execute(
            text("SELECT id, key, type, project_id, parent_id, epic_id FROM work_items")
        ).all()

        violations: list[tuple[dict, dict]] = []
        for row in rows:
            item = {
                "id": row.id,
                "key": row.key,
                "type": row.type,
                "project_id": row.project_id,
                "parent_id": row.parent_id,
                "epic_id": row.epic_id,
            }
            try:
                validate_hierarchy(
                    db,
                    item_type=item["type"],
                    project_id=item["project_id"],
                    parent_id=item["parent_id"],
                    epic_id=item["epic_id"],
                    item_id=item["id"],
                )
            except HTTPException as exc:
                violations.append((item, exc.detail))

        if not violations:
            print(f"OK: scanned {len(rows)} work items, 0 hierarchy violations.")
            return 0

        print(f"FOUND {len(violations)} hierarchy violation(s) across {len(rows)} work items:\n")
        for item, detail in violations:
            print(
                f"  - {item['key']} (id={item['id']}, type={item['type']}, "
                f"project_id={item['project_id']}, parent_id={item['parent_id']}, "
                f"epic_id={item['epic_id']})"
            )
            print(f"      -> {detail['field']} / {detail['code']}: {detail['message']}")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
