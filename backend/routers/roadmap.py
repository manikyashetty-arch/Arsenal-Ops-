"""
Roadmap Router - Endpoints for roadmap file upload and parsing
Handles Excel roadmap files for bulk task creation
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, date
from sqlalchemy.orm import Session
from sqlalchemy import text
import io
import sys

sys.path.append('..')
from database import get_db
from models.project import Project
from models.user import User
from models.developer import Developer
from models.work_item import WorkItem, WorkItemType
from routers.auth import get_current_user
from parser import parse as parse_roadmap

# NOTE: Roadmap bulk creation does NOT send email notifications to assignees
# For bulk ticket creation from roadmaps, email notifications are disabled
# to avoid notification spam. This can be re-enabled in future if needed.

router = APIRouter(prefix="/api/roadmap", tags=["Roadmap"])


class RoadmapSummary(BaseModel):
    total_epics: int
    total_tasks: int
    total_assignees: int
    assignees: List[str]
    timeline: Dict[str, Any]
    conflicts: List[Dict[str, Any]]
    warnings: List[Dict[str, Any]]
    schedule: Dict[str, Any]


class RoadmapParseResponse(BaseModel):
    status: str
    summary: RoadmapSummary
    parsed_data: Dict[str, Any]  # Full parse output for later commit


class RoadmapCommitRequest(BaseModel):
    project_id: int
    parsed_data: Dict[str, Any]


def get_next_work_item_number(db: Session, key_prefix: str) -> int:
    """Get the next work item number for a key prefix"""
    row = db.execute(
        text(f"""
            SELECT COALESCE(MAX(
                CAST(REGEXP_REPLACE(key, '^{key_prefix}-', '') AS INTEGER)
            ), 0) + 1
            FROM work_items
            WHERE key LIKE :prefix
        """),
        {"prefix": f"{key_prefix}-%"}
    ).scalar()
    return row or 1


def create_work_item(
    db: Session,
    project: Project,
    title: str,
    description: str,
    item_type: str,
    priority: str,
    effort_hrs: Optional[float],
    assignee_id: Optional[int],
    epic_id: Optional[int] = None,
    acceptance_criteria: Optional[List[str]] = None,
) -> WorkItem:
    """Helper to create a work item with auto-generated key"""
    
    # Generate key
    next_num = get_next_work_item_number(db, project.key_prefix)
    key = f"{project.key_prefix}-{next_num}"
    
    # Create work item
    # Handle effort_hrs: convert to int, handle None and 0 properly
    hours = int(effort_hrs) if effort_hrs is not None else 0
    work_item = WorkItem(
        project_id=project.id,
        key=key,
        type=item_type,
        title=title,
        description=description,
        priority=priority,
        status="todo",
        estimated_hours=hours,
        remaining_hours=hours,
        assignee_id=assignee_id,
        epic_id=epic_id,
        acceptance_criteria=acceptance_criteria or [],
    )
    
    db.add(work_item)
    db.flush()  # Get the ID without committing
    return work_item


@router.post("/parse-file")
async def parse_roadmap_file(
    project_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload and parse a roadmap Excel file
    Returns: Summary of epics, tasks, assignees, timeline, conflicts, warnings
    """
    # Verify project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Validate file type
    if not file.filename.lower().endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Please upload an Excel file (.xlsx or .xls)")
    
    # Read file into memory
    try:
        file_content = await file.read()
        
        # Write to temp file for parser
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as tmp:
            tmp.write(file_content)
            tmp_path = tmp.name
        
        # Parse the roadmap
        parsed_result = parse_roadmap(tmp_path)
        
        # Clean up temp file
        import os
        os.unlink(tmp_path)
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse roadmap: {str(e)}")
    
    # Extract summary information
    tickets = parsed_result.get("tickets", [])
    schedule = parsed_result.get("schedule", {})
    conflicts = parsed_result.get("conflicts", [])
    warnings = parsed_result.get("warnings", [])
    availability = parsed_result.get("availability", {})
    
    # Count unique epics
    epics = set()
    for ticket in tickets:
        if ticket.get("epic"):
            epics.add(ticket["epic"])
    
    # Count assignees
    assignees = set()
    for ticket in tickets:
        if ticket.get("assignee"):
            assignees.add(ticket["assignee"])
    
    # Get timeline
    meta = parsed_result.get("meta", {})
    week_range = meta.get("week_range", {})
    
    # Build summary
    summary = RoadmapSummary(
        total_epics=len(epics),
        total_tasks=len(tickets),
        total_assignees=len(assignees),
        assignees=sorted(list(assignees)),
        timeline={
            "start": week_range.get("start"),
            "end": week_range.get("end"),
            "duration_weeks": meta.get("total_weeks", 0)
        },
        conflicts=[{
            "assignee": c.get("assignee"),
            "week": c.get("week"),
            "total_hrs": c.get("total_hrs"),
            "tasks": c.get("tasks", []),
            "overbooked": c.get("overbooked")
        } for c in conflicts],
        warnings=[{
            "row": w.get("row"),
            "task": w.get("task"),
            "issue": w.get("issue"),
            "detail": w.get("detail")
        } for w in warnings],
        schedule=schedule
    )
    
    return RoadmapParseResponse(
        status="success",
        summary=summary,
        parsed_data=parsed_result
    )


@router.post("/commit")
async def commit_roadmap_tickets(
    request: RoadmapCommitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create work items from parsed roadmap data
    Creates epics first, then tasks linked to epics
    Handles assignee lookup with fallback to current user
    """
    # Verify project exists
    project = db.query(Project).filter(Project.id == request.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    try:
        # Get current user's developer profile
        current_dev = db.query(Developer).filter(
            Developer.email == current_user.email
        ).first()
        
        if not current_dev:
            raise HTTPException(status_code=400, detail="Current user is not a team member")
        
        parsed_data = request.parsed_data
        tickets = parsed_data.get("tickets", [])
        
        # Debug: log the number of tickets received
        print(f"DEBUG: Received {len(tickets)} tickets from parsed_data")
        if not tickets:
            print(f"DEBUG: parsed_data keys: {parsed_data.keys()}")
        
        # Step 1: Create epics
        # Build a map of epic names to their work item IDs
        epic_map = {}  # epic_name -> WorkItem
        seen_epics = set()
        
        for ticket in tickets:
            epic_name = ticket.get("epic")
            if epic_name and epic_name not in seen_epics:
                seen_epics.add(epic_name)
                
                epic = create_work_item(
                    db=db,
                    project=project,
                    title=epic_name,
                    description=f"Epic: {epic_name}",
                    item_type=WorkItemType.EPIC.value,
                    priority="high",
                    effort_hrs=None,
                    assignee_id=None,
                    epic_id=None,
                )
                epic_map[epic_name] = epic
        
        # Step 2: Create tasks linked to epics
        created_tasks = 0
        assignee_not_found_count = 0
        
        for ticket in tickets:
            task_name = ticket.get("name")
            description = ticket.get("description", "")
            milestone = ticket.get("milestone", "")
            epic_name = ticket.get("epic")
            priority = ticket.get("priority", "medium")
            effort_hrs = ticket.get("effort_hrs")
            assignee_name = ticket.get("assignee")
            
            # Determine assignee - default to current_dev if no assignee in roadmap
            assignee_id = current_dev.id  # Always default to uploader
            assignee_warning = None
            
            if assignee_name and assignee_name.strip():  # Only if assignee is specified and non-empty
                # Try to find developer by name
                assignee_dev = db.query(Developer).filter(
                    Developer.name == assignee_name
                ).first()
                
                if assignee_dev:
                    assignee_id = assignee_dev.id
                else:
                    # Developer not found - keep current_dev and count as not found
                    assignee_not_found_count += 1
                    assignee_warning = f"Developer '{assignee_name}' not found. Auto-assigned to {current_user.name}"
            
            # Get epic_id
            epic_id = None
            if epic_name and epic_name in epic_map:
                epic_id = epic_map[epic_name].id
            
            # Create task
            task = create_work_item(
                db=db,
                project=project,
                title=task_name,
                description=description,
                item_type="user_story",
                priority=priority,
                effort_hrs=effort_hrs,
                assignee_id=assignee_id,
                epic_id=epic_id,
                acceptance_criteria=[],
            )
            
            created_tasks += 1
        
        # Commit all changes
        db.commit()
        
        return {
            "status": "success",
            "tickets_created": created_tasks,
            "epics_created": len(epic_map),
            "assignees_not_found": assignee_not_found_count,
            "message": f"Created {len(epic_map)} epics and {created_tasks} tasks from roadmap"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to commit roadmap: {str(e)}")
