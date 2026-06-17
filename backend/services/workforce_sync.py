"""Workforce / QuickBooks sync worker.

`run_workforce_sync(db)` is the single entry point used by BOTH the
weekly cron (`scripts/run_workforce_sync.py`) and the manual "Sync Now"
button (`POST /api/admin/workforce/sync`). Same code path, same
guarantees — only the trigger differs.

Window
======
Both triggers sync the **previous Mon-Fri only** (no backfill). The
weekly cron is configured to run Saturday morning UTC; manual triggers
pick the same prior-week window so an admin re-running the sync after a
correction gets identical behavior.

If the cron is delayed and runs on Sunday or even Monday, the window
still resolves to the Mon-Fri of the most recently completed work week
(see `previous_work_week`).

Concurrency
===========
Postgres advisory lock keyed on a hardcoded int. Two simultaneous
syncs (cron + manual click) won't both push the same TimeEntry. The
lock is released automatically when the session closes or the
transaction commits.

Idempotency
===========
Even if the lock fails (e.g. SQLite in tests), the sync is still
idempotent because the eligibility filter requires
`time_entries.workforce_entry_id IS NULL`. A TimeEntry that's already
synced has the QB id set and falls out of the queue.

Errors
======
- Rate-limit (429) from Intuit → stop the run gracefully. The
  partial progress is committed; next run picks up the rest.
- Per-entry API errors → log + count, continue with the next entry.
- Missing service item → fail the run cleanly with a clear message
  instead of pushing entries to QB with a null Item ref.
"""

from __future__ import annotations

import contextlib
import logging
from datetime import date, datetime, time, timedelta
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session, selectinload

from models.developer import Developer
from models.project import Project
from models.time_entry import TimeEntry
from models.work_item import WorkItem
from models.workforce_integration import WorkforceIntegration
from services.workforce_clients import refresh_quietly as refresh_clients_quietly
from services.workforce_oauth import WorkforceOAuthError
from services.workforce_qb_client import (
    QBApiError,
    QBRateLimitError,
    fetch_qb_employees,
    post_time_activity,
    resolve_service_item,
)

logger = logging.getLogger(__name__)


# Fixed int key for Postgres `pg_try_advisory_lock`. Arbitrary but
# stable so two backend instances pick the same slot. The high bit is
# clear so it stays a positive 32-bit int (Postgres accepts negative
# but mixing signs across versions has bitten people in the wild).
ADVISORY_LOCK_KEY = 0x57464F52  # ASCII 'WFOR'

# Hard cap on how many TimeEntries one run can push. Protects against a
# pathologically large queue exhausting the run / hitting Intuit's per-
# day limits. Configurable so ops can raise it for an unusual catch-up.
DEFAULT_BATCH_CAP = 500


# ── Window resolution ────────────────────────────────────────────────────


def current_work_week_window(today: date | None = None) -> tuple[date, date]:
    """Return (monday, friday) of the calendar week containing `today`.

    Calendar weeks here are Mon-Sun. The rule is uniform across
    every trigger day — both the Saturday cron and any manual click
    sync the Mon-Fri of the same calendar week as the trigger:

      today = Sat 2024-01-13  → (Mon 2024-01-08, Fri 2024-01-12)
      today = Sun 2024-01-14  → (Mon 2024-01-08, Fri 2024-01-12)
      today = Mon 2024-01-15  → (Mon 2024-01-15, Fri 2024-01-19)
      today = Wed 2024-01-17  → (Mon 2024-01-15, Fri 2024-01-19)
      today = Fri 2024-01-19  → (Mon 2024-01-15, Fri 2024-01-19)

    On Mon-Fri clicks the window naturally includes only the days
    already elapsed — Thu/Fri entries simply don't exist yet, so the
    eligibility query returns the partial set. The next click (or the
    Saturday cron) sweeps up the remainder.
    """
    if today is None:
        today = date.today()
    monday = today - timedelta(days=today.weekday())
    friday = monday + timedelta(days=4)
    return monday, friday


# ── Lock helper ──────────────────────────────────────────────────────────


def _try_advisory_lock(db: Session) -> bool:
    """Acquire the workforce-sync advisory lock if available.

    Returns True on Postgres if we got it, False if someone else holds
    it. On non-Postgres backends (sqlite in tests) returns True without
    a lock — the idempotency guarantee from `workforce_entry_id IS NULL`
    still holds.
    """
    bind = db.get_bind()
    if bind.dialect.name != "postgresql":
        return True
    got = db.execute(
        text("SELECT pg_try_advisory_lock(:k)"),
        {"k": ADVISORY_LOCK_KEY},
    ).scalar()
    return bool(got)


def _release_advisory_lock(db: Session) -> None:
    """Release the advisory lock. No-op on non-Postgres.

    Two important behaviors here:

    1. We `.scalar()` the result. Without it, SQLAlchemy may defer
       cursor execution / not flush the call before the session is
       closed, leaving the lock held on the pooled connection. The
       next request picks up that connection and `pg_try_advisory_lock`
       returns false — surfacing to the user as a spurious "another
       sync is already running."
    2. We then explicitly commit. Advisory locks are session-level
       (not transactional), but committing closes the implicit
       transaction SQLAlchemy opens for the SELECT and lets the
       connection return cleanly to the pool.
    """
    bind = db.get_bind()
    if bind.dialect.name != "postgresql":
        return
    try:
        db.execute(
            text("SELECT pg_advisory_unlock(:k)"),
            {"k": ADVISORY_LOCK_KEY},
        ).scalar()
        db.commit()
    except Exception:
        # Lock auto-releases when the underlying TCP session ends, so
        # at worst the lock lingers until the connection cycles out of
        # the pool. Don't propagate cleanup failures.
        with contextlib.suppress(Exception):
            db.rollback()


# ── Description builder ──────────────────────────────────────────────────


def build_description(entry: TimeEntry) -> str:
    """Format the QB TimeActivity Description.

    Shape: `[PROJ-123] Title — optional user description`. Keeps the
    work-item identifier first so it's scannable in QB's TimeActivity
    list view, then the title, then the developer-typed note. Caps at
    1000 chars; QB allows up to 4000 but anything that long is almost
    certainly a paste-mistake on the Arsenal side.
    """
    item = entry.work_item
    parts: list[str] = []
    if item is not None:
        key = getattr(item, "key", None) or f"WI-{item.id}"
        title = getattr(item, "title", None) or ""
        if title:
            parts.append(f"[{key}] {title}")
        else:
            parts.append(f"[{key}]")
    if entry.description:
        parts.append(entry.description.strip())
    out = " — ".join(parts) if parts else ""
    return out[:1000]


# ── Main entry point ─────────────────────────────────────────────────────


def run_workforce_sync(
    db: Session,
    *,
    triggered_by: str = "cron",
    batch_cap: int = DEFAULT_BATCH_CAP,
    today: date | None = None,
) -> dict[str, Any]:
    """Push eligible TimeEntries from the previous Mon-Fri to QuickBooks.

    Returns a dict suitable for both API response and log lines:

        {
          "status": "ok" | "partial" | "error" | "not_connected" | "locked" | "no_eligible",
          "synced": int,
          "failed": int,
          "skipped": int,
          "window_start": "YYYY-MM-DD",
          "window_end": "YYYY-MM-DD",
          "reason": str (only on non-ok statuses),
        }

    `triggered_by` is logged but not gated — both `cron` and `manual`
    take the exact same code path. The argument exists only so log lines
    distinguish them.

    No exception is raised for normal "nothing to do" or "rate-limited"
    outcomes — they're communicated via the `status` field. Hard errors
    (missing integration, OAuth refresh failure) raise once they've
    been recorded on `integration.last_sync_*` so the API can return
    them as 5xx without losing the audit trail.
    """
    window_start, window_end = current_work_week_window(today)
    base_result = {
        "synced": 0,
        "failed": 0,
        "skipped": 0,
        "window_start": window_start.isoformat(),
        "window_end": window_end.isoformat(),
    }

    integration = db.query(WorkforceIntegration).first()
    if not integration:
        logger.info("[workforce_sync] %s: integration not connected", triggered_by)
        return {**base_result, "status": "not_connected", "reason": "integration_not_connected"}

    if not _try_advisory_lock(db):
        logger.info("[workforce_sync] %s: another sync is already running", triggered_by)
        return {**base_result, "status": "locked", "reason": "another_sync_running"}

    try:
        return _run_inside_lock(
            db,
            integration,
            window_start=window_start,
            window_end=window_end,
            batch_cap=batch_cap,
            triggered_by=triggered_by,
            base_result=base_result,
        )
    finally:
        _release_advisory_lock(db)


def _run_inside_lock(
    db: Session,
    integration: WorkforceIntegration,
    *,
    window_start: date,
    window_end: date,
    batch_cap: int,
    triggered_by: str,
    base_result: dict[str, Any],
) -> dict[str, Any]:
    """Body of the sync after we hold the advisory lock.

    Separated so the lock's `try/finally` stays small and obvious in
    the caller — every code path in here is wrapped by lock release.
    """
    # 1) Resolve / re-resolve service item. If the admin renamed
    #    "Hours" in QB the cached id might be stale; bail early with a
    #    clear error rather than push entries against a wrong item.
    service_item_id = integration.service_item_id
    if not service_item_id:
        try:
            item = resolve_service_item(db, integration)
        except QBApiError as e:
            return _finalize(
                db,
                integration,
                base_result,
                status="error",
                reason=f"could_not_resolve_service_item: {e}",
                triggered_by=triggered_by,
            )
        if not item:
            return _finalize(
                db,
                integration,
                base_result,
                status="error",
                reason="'Hours' service item not found in QuickBooks. Create it in QB then retry.",
                triggered_by=triggered_by,
            )
        integration.service_item_id = item["id"]
        integration.service_item_name = item["name"]
        db.commit()
        service_item_id = item["id"]

    # 2) Build the email -> QB employee id map once per run.
    try:
        employee_map = fetch_qb_employees(db, integration)
    except (QBApiError, WorkforceOAuthError) as e:
        return _finalize(
            db,
            integration,
            base_result,
            status="error",
            reason=f"could_not_fetch_employees: {e}",
            triggered_by=triggered_by,
        )

    # 2.5) Refresh the cached QB Customer list. Best-effort — a refresh
    # failure doesn't block the sync since the customer list is used by
    # the picker, not by the push itself (the push uses
    # `project.workforce_client_id` which is already on the project row).
    refresh_clients_quietly(db, integration)

    # 3) Pull eligible TimeEntries. Mirrors the Time Entries admin
    #    tab's JOIN shape (Project → WorkItem → TimeEntry → Developer)
    #    so what gets pushed matches what an admin sees there.
    window_start_dt = datetime.combine(window_start, time.min)
    window_end_dt = datetime.combine(window_end + timedelta(days=1), time.min)
    entries: list[TimeEntry] = (
        db.query(TimeEntry)
        .join(WorkItem, TimeEntry.work_item_id == WorkItem.id)
        .join(Project, WorkItem.project_id == Project.id)
        .join(Developer, TimeEntry.developer_id == Developer.id)
        .filter(
            Project.workforce_client_id.isnot(None),
            TimeEntry.workforce_entry_id.is_(None),
            TimeEntry.logged_at >= window_start_dt,
            TimeEntry.logged_at < window_end_dt,
        )
        .options(
            selectinload(TimeEntry.work_item).selectinload(WorkItem.project),
            selectinload(TimeEntry.developer),
        )
        .order_by(TimeEntry.logged_at.asc(), TimeEntry.id.asc())
        .limit(batch_cap)
        .all()
    )

    if not entries:
        return _finalize(
            db,
            integration,
            base_result,
            status="no_eligible",
            reason="no_eligible_entries",
            triggered_by=triggered_by,
        )

    synced = failed = skipped = 0
    skip_summary: dict[str, int] = {}
    fail_summary: list[str] = []
    rate_limited = False

    for entry in entries:
        if rate_limited:
            break
        email = (entry.developer.email or "").lower().strip() if entry.developer else ""
        if not email or email not in employee_map:
            key = email or "<no-email>"
            skip_summary[key] = skip_summary.get(key, 0) + 1
            skipped += 1
            continue

        project = entry.work_item.project if entry.work_item else None
        customer_qb_id = project.workforce_client_id if project else None
        if not customer_qb_id:
            # Project must have been unlinked between query time and now,
            # or the row was inserted between query plan and execute.
            # Treat as skip (will retry next run if re-linked).
            skip_summary["<project-unlinked>"] = skip_summary.get("<project-unlinked>", 0) + 1
            skipped += 1
            continue

        try:
            qb_id = post_time_activity(
                db,
                integration,
                employee_qb_id=employee_map[email],
                customer_qb_id=customer_qb_id,
                service_item_id=service_item_id,
                hours=int(entry.hours),
                txn_date=entry.logged_at.date(),
                description=build_description(entry),
            )
            entry.workforce_entry_id = qb_id
            synced += 1
            # Commit every entry so a mid-run rate-limit doesn't lose
            # work already pushed to QB. The flip side is more commits;
            # acceptable since this runs once a week with bounded N.
            db.commit()
        except QBRateLimitError as e:
            logger.warning("[workforce_sync] hit rate limit: %s", e)
            fail_summary.append(f"rate_limited: {e}")
            rate_limited = True
            # Don't count the unattempted remainder as failures —
            # they're untried, and the next run will pick them up.
            break
        except QBApiError as e:
            failed += 1
            fail_summary.append(f"entry {entry.id}: {e}")
            logger.warning("[workforce_sync] entry id=%s failed: %s", entry.id, e)
        except WorkforceOAuthError as e:
            # OAuth refresh failed mid-run — the integration is
            # effectively disconnected. Stop the run cleanly.
            logger.error("[workforce_sync] OAuth failure mid-run: %s", e)
            fail_summary.append(f"oauth_failed: {e}")
            return _finalize(
                db,
                integration,
                {**base_result, "synced": synced, "failed": failed, "skipped": skipped},
                status="error",
                reason=str(e),
                triggered_by=triggered_by,
            )

    status_str: str
    reason_parts: list[str] = []
    if rate_limited:
        status_str = "partial"
        reason_parts.append("rate_limited; resumes next run")
    elif failed == 0 and skipped == 0:
        status_str = "ok"
    elif synced == 0 and failed == 0:
        # synced=0 / failed=0 / skipped>0 is still a "partial" outcome —
        # we touched the queue, decided each entry was ineligible, but
        # did not push anything. Routing through "partial" keeps the
        # status set documented in WorkforceIntegration.last_sync_status
        # and lets the email/UI badge styling for partial apply.
        status_str = "no_eligible" if not skipped else "partial"
    else:
        status_str = "partial"
    if skipped:
        reason_parts.append(
            "skipped: " + ", ".join(f"{k}={v}" for k, v in sorted(skip_summary.items()))
        )
    if fail_summary:
        # Cap fail_summary serialization so a flurry of per-entry errors
        # doesn't balloon the persisted last_sync_error column.
        reason_parts.append("failures: " + "; ".join(fail_summary[:10]))
    reason = " | ".join(reason_parts) if reason_parts else None

    return _finalize(
        db,
        integration,
        {**base_result, "synced": synced, "failed": failed, "skipped": skipped},
        status=status_str,
        reason=reason,
        triggered_by=triggered_by,
    )


def _finalize(
    db: Session,
    integration: WorkforceIntegration,
    result: dict[str, Any],
    *,
    status: str,
    reason: str | None,
    triggered_by: str,
) -> dict[str, Any]:
    """Persist observability fields on the integration row and return result.

    Centralizing this means every exit path (success, partial, error,
    locked, no-eligible) updates the same fields in the same way; the
    admin UI never sees stale or inconsistent last-sync state.
    """
    integration.last_sync_at = datetime.utcnow()
    integration.last_sync_status = status
    integration.last_sync_error = (reason or None) if status != "ok" else None
    integration.last_synced_count = int(result.get("synced", 0))
    integration.last_failed_count = int(result.get("failed", 0))
    db.commit()
    logger.info(
        "[workforce_sync] %s done status=%s synced=%s failed=%s skipped=%s window=%s..%s",
        triggered_by,
        status,
        result.get("synced"),
        result.get("failed"),
        result.get("skipped"),
        result.get("window_start"),
        result.get("window_end"),
    )
    out = {**result, "status": status}
    if reason:
        out["reason"] = reason
    return out
