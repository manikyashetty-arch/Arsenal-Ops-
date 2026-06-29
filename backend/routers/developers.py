"""
Developers Router - CRUD operations for developers
"""

import sys
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

sys.path.append("..")
from database import get_db
from models.developer import Developer
from models.user import User
from routers.auth import get_current_user

router = APIRouter(prefix="/api/developers", tags=["Developers"])


class DeveloperCreate(BaseModel):
    name: str
    email: str
    github_username: str | None = None
    avatar_url: str | None = None


class DeveloperUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    github_username: str | None = None
    avatar_url: str | None = None


class DeveloperResponse(BaseModel):
    id: int
    name: str
    email: str
    github_username: str | None
    avatar_url: str | None
    created_at: datetime

    class Config:
        from_attributes = True


@router.post("/", response_model=DeveloperResponse)
def create_developer(
    developer: DeveloperCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new developer (requires auth)"""
    # Check if email already exists
    existing = db.query(Developer).filter(Developer.email == developer.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Developer with this email already exists")

    new_developer = Developer(
        name=developer.name,
        email=developer.email,
        github_username=developer.github_username,
        avatar_url=developer.avatar_url,
    )
    db.add(new_developer)
    db.commit()
    db.refresh(new_developer)
    return new_developer


@router.get("/", response_model=list[DeveloperResponse])
def list_developers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """List all developers (requires auth)"""
    developers = db.query(Developer).all()
    return developers


@router.get("/me/capacity")
def get_my_capacity(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Weekly capacity for the currently-logged-in developer (cross-project,
    Saturday → Friday UTC). Same shape as a single row from
    /api/admin/developers/capacity. Returns 404 if the user has no Developer
    record yet (e.g., admin-only user)."""
    from services.capacity_service import compute_capacity_breakdown, week_boundaries

    dev = db.query(Developer).filter(Developer.email == current_user.email).first()
    if not dev:
        raise HTTPException(status_code=404, detail="No developer profile for this user")

    week_start, week_end = week_boundaries()
    breakdown = compute_capacity_breakdown(
        dev.assigned_work_items or [],
        week_start,
        db=db,
        developer_id=dev.id,
    )
    return {
        "developer_id": dev.id,
        "developer_name": dev.name,
        "developer_email": dev.email,
        "avatar_url": dev.avatar_url,
        "project_count": len(dev.projects) if dev.projects else 0,
        "specialization": getattr(dev, "specialization", None),
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        **breakdown,
    }


class TimesheetEntryResponse(BaseModel):
    id: int
    logged_at: str | None
    hours: int
    description: str | None
    work_item_title: str | None
    submitted_at: str | None
    synced: bool


class TimesheetProjectResponse(BaseModel):
    project_id: int
    project_name: str
    subtotal_hours: int
    entries: list[TimesheetEntryResponse]


class TimesheetClientResponse(BaseModel):
    qb_customer_id: str
    client_name: str
    subtotal_hours: int
    projects: list[TimesheetProjectResponse]


class MyTimesheetResponse(BaseModel):
    week_start: str
    week_end: str
    total_hours: int
    syncable_unsubmitted_count: int
    clients: list[TimesheetClientResponse]
    unlinked_projects: list[TimesheetProjectResponse]


class SubmitTimesheetFailure(BaseModel):
    entry_id: int
    error: str


class SubmitTimesheetResponse(BaseModel):
    """Outcome of POST /me/timesheet/submit.

    `status` mirrors the admin sync vocabulary so logs are coherent:
      - "ok"      → every picked entry landed in QB
      - "partial" → some entries failed (see `failed[]`); successes
                    are already committed
    """

    status: str
    submitted_count: int
    synced_count: int
    failed: list[SubmitTimesheetFailure]
    week_start: str
    week_end: str
    reason: str | None = None


@router.get("/me/timesheet", response_model=MyTimesheetResponse)
def get_my_timesheet(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Current Mon–Fri timesheet for the logged-in developer.

    Read-only data shape for the Review-and-Submit modal: hours grouped
    by QB Customer → Project, plus a separate `unlinked_projects`
    bucket for hours on projects without a QuickBooks customer link.
    Returns 404 if the user has no Developer record (admin-only user).
    """
    from services.timesheet_service import get_my_timesheet as _get_my_timesheet

    dev = db.query(Developer).filter(Developer.email == current_user.email).first()
    if not dev:
        raise HTTPException(status_code=404, detail="No developer profile for this user")

    # Coerce explicitly so callers (including tests that invoke the
    # function directly without going through FastAPI's response-model
    # serializer) get a typed object back, not a raw dict.
    return MyTimesheetResponse(**_get_my_timesheet(db, dev))


@router.post("/me/timesheet/submit", response_model=SubmitTimesheetResponse)
def submit_my_timesheet(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit this week's hours and sync them to QuickBooks inline.

    No request body — the server picks the eligible entries
    (developer, Mon–Fri current week, QB-linked project, not yet synced)
    and POSTs each one to QuickBooks. Per-entry failures are returned
    in the `failed` list rather than as a 5xx; the dev clicks Submit
    again to retry just the failures.

    HTTP status codes:
      200 → "ok" or "partial" result (see `failed[]`)
      404 → no Developer profile for this user
      409 → another sync is in flight (admin force-sync or a different
            dev's concurrent submit). Retry shortly.
      503 → QuickBooks isn't connected yet
      500 → integration-level error (OAuth expired, service item
            missing). Reason includes humanized next step.
    """
    from services.timesheet_service import (
        SUBMIT_LOCKED,
        SUBMIT_NOT_CONNECTED,
    )
    from services.timesheet_service import (
        submit_my_timesheet as _submit_my_timesheet,
    )

    dev = db.query(Developer).filter(Developer.email == current_user.email).first()
    if not dev:
        raise HTTPException(status_code=404, detail="No developer profile for this user")

    result = _submit_my_timesheet(db, dev)
    status = result.get("status")

    # Operational outcomes get distinct HTTP codes so the frontend can
    # render the right banner color without parsing the status string.
    if status == SUBMIT_NOT_CONNECTED:
        raise HTTPException(
            status_code=503, detail=result.get("reason") or "QuickBooks not connected"
        )
    if status == SUBMIT_LOCKED:
        raise HTTPException(
            status_code=409, detail=result.get("reason") or "Another sync is running"
        )
    if status == "error":
        raise HTTPException(
            status_code=500, detail=result.get("reason") or "QuickBooks submit failed"
        )

    # ok / partial: shape the response. Strip the `reason` field on
    # "ok" so the UI doesn't accidentally render an empty banner.
    return SubmitTimesheetResponse(
        status=status or "ok",
        submitted_count=int(result.get("submitted_count") or 0),
        synced_count=int(result.get("synced_count") or 0),
        failed=[SubmitTimesheetFailure(**f) for f in (result.get("failed") or [])],
        week_start=str(result.get("week_start") or ""),
        week_end=str(result.get("week_end") or ""),
        reason=result.get("reason") if status == "partial" else None,
    )


@router.get("/{developer_id}", response_model=DeveloperResponse)
def get_developer(
    developer_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Get a developer by ID (requires auth)"""
    developer = db.query(Developer).filter(Developer.id == developer_id).first()
    if not developer:
        raise HTTPException(status_code=404, detail="Developer not found")
    return developer


@router.put("/{developer_id}", response_model=DeveloperResponse)
def update_developer(
    developer_id: int,
    update: DeveloperUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a developer (requires auth)"""
    developer = db.query(Developer).filter(Developer.id == developer_id).first()
    if not developer:
        raise HTTPException(status_code=404, detail="Developer not found")

    # Check email uniqueness if updating email
    if update.email and update.email != developer.email:
        existing = db.query(Developer).filter(Developer.email == update.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Developer with this email already exists")
        developer.email = update.email

    if update.name is not None:
        developer.name = update.name
    if update.github_username is not None:
        developer.github_username = update.github_username
    if update.avatar_url is not None:
        developer.avatar_url = update.avatar_url

    developer.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(developer)
    return developer


@router.delete("/{developer_id}")
def delete_developer(
    developer_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Delete a developer (requires auth)"""
    developer = db.query(Developer).filter(Developer.id == developer_id).first()
    if not developer:
        raise HTTPException(status_code=404, detail="Developer not found")

    db.delete(developer)
    db.commit()
    return {"status": "deleted", "id": developer_id}
