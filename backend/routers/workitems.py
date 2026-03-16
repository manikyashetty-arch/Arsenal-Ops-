"""
Work Items Router - Jira-style work item management with AI generation
Production-ready database storage
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func

import sys
sys.path.append('..')
from database import get_db
from models.work_item import WorkItem, WorkItemType, WorkItemStatus, WorkItemPriority
from models.sprint import Sprint, SprintStatus
from models.project import Project
from models.user import User
from services.llm_agent import llm_agent
from routers.auth import get_current_user

router = APIRouter(prefix="/api/workitems", tags=["Work Items"])

# Counter for generating work item keys
def get_next_item_number(db: Session, project_id: int) -> int:
    """Get the next work item number for a project"""
    count = db.query(func.count(WorkItem.id)).filter(WorkItem.project_id == project_id).scalar()
    return (count or 0) + 1


# Request/Response models
class WorkItemCreate(BaseModel):
    type: str = "task"  # user_story, task, bug, epic
    title: str
    description: str = ""
    status: str = "todo"
    estimated_hours: int = 0
    remaining_hours: int = 0
    story_points: int = 0
    priority: str = "medium"
    assignee_id: Optional[int] = None
    sprint_id: Optional[int] = None
    project_id: int
    tags: List[str] = []
    epic_id: Optional[int] = None
    parent_id: Optional[int] = None
    acceptance_criteria: List[str] = []
    start_date: Optional[str] = None  # ISO date string
    due_date: Optional[str] = None  # ISO date string


class WorkItemUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    estimated_hours: Optional[int] = None
    remaining_hours: Optional[int] = None
    logged_hours: Optional[int] = None  # Hours logged by developer
    story_points: Optional[int] = None
    priority: Optional[str] = None
    assignee_id: Optional[int] = None
    sprint_id: Optional[int] = None
    tags: Optional[List[str]] = None
    type: Optional[str] = None
    epic_id: Optional[int] = None
    parent_id: Optional[int] = None
    acceptance_criteria: Optional[List[str]] = None
    start_date: Optional[str] = None  # ISO date string
    due_date: Optional[str] = None  # ISO date string
    # Frontend compatibility - assigned_hours maps to estimated_hours
    assigned_hours: Optional[int] = None


class BatchStatusUpdate(BaseModel):
    item_ids: List[str]
    status: str


class GenerateStoriesRequest(BaseModel):
    product_name: str
    product_description: str
    count: int = 5
    product_id: str = "default"


class SprintCreate(BaseModel):
    name: str
    project_id: int
    goal: str = ""
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    capacity_hours: Optional[int] = None


@router.get("/")
async def list_work_items(
    project_id: int = None, 
    status: str = None, 
    type: str = None, 
    sprint_id: int = None,
    assignee_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all work items with optional filters (requires auth)"""
    query = db.query(WorkItem)
    
    if project_id:
        query = query.filter(WorkItem.project_id == project_id)
    if status:
        query = query.filter(WorkItem.status == status)
    if type:
        query = query.filter(WorkItem.type == type)
    if sprint_id:
        query = query.filter(WorkItem.sprint_id == sprint_id)
    if assignee_id:
        query = query.filter(WorkItem.assignee_id == assignee_id)
    
    items = query.all()
    
    # Include assignee name in response
    result = []
    for item in items:
        item_dict = {
            "id": str(item.id),
            "key": item.key,
            "type": item.type,
            "title": item.title,
            "description": item.description or "",
            "status": item.status,
            "priority": item.priority,
            "story_points": item.story_points or 0,
            "assigned_hours": item.estimated_hours or 0,
            "estimated_hours": item.estimated_hours or 0,  # Also return as estimated_hours for frontend
            "remaining_hours": item.remaining_hours or 0,
            "logged_hours": item.logged_hours or 0,
            "assignee": "Unassigned",
            "assignee_id": item.assignee_id,
            "sprint": "Backlog",
            "sprint_id": item.sprint_id,
            "epic": "",
            "tags": item.tags or [],
            "due_date": item.due_date.isoformat() if item.due_date else None,
            "start_date": item.start_date.isoformat() if item.start_date else None,
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "updated_at": item.updated_at.isoformat() if item.updated_at else None,
        }
        
        # Get assignee name
        if item.assignee_id and item.assignee:
            item_dict["assignee"] = item.assignee.name
        
        # Get sprint name and dates
        if item.sprint_id and item.sprint:
            item_dict["sprint"] = item.sprint.name
            # Use sprint dates if work item doesn't have its own dates
            if not item_dict["start_date"] and item.sprint.start_date:
                item_dict["start_date"] = item.sprint.start_date.isoformat()
            if not item_dict["due_date"] and item.sprint.end_date:
                item_dict["due_date"] = item.sprint.end_date.isoformat()
        
        result.append(item_dict)
    
    return result


@router.get("/{item_id}")
async def get_work_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific work item (requires auth)"""
    item = db.query(WorkItem).filter(WorkItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Work item not found")
    return item


@router.post("/")
async def create_work_item(
    item: WorkItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new work item"""
    # Get project for key prefix
    project = db.query(Project).filter(Project.id == item.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Generate key using project's key_prefix
    key_prefix = project.key_prefix if project.key_prefix else "PROJ"
    item_number = get_next_item_number(db, item.project_id)
    key = f"{key_prefix}-{item_number}"
    
    work_item = WorkItem(
        project_id=item.project_id,
        key=key,
        type=item.type,
        title=item.title,
        description=item.description,
        status=item.status,
        estimated_hours=item.estimated_hours,
        remaining_hours=item.estimated_hours,  # Initialize remaining as estimated
        story_points=item.story_points,
        priority=item.priority,
        assignee_id=item.assignee_id,
        sprint_id=item.sprint_id,
        epic_id=item.epic_id,
        parent_id=item.parent_id,
        tags=item.tags,
        acceptance_criteria=item.acceptance_criteria,
        start_date=datetime.fromisoformat(item.start_date) if item.start_date else None,
        due_date=datetime.fromisoformat(item.due_date) if item.due_date else None
    )
    
    db.add(work_item)
    
    # Log activity
    from models.activity_log import ActivityLog
    activity = ActivityLog(
        project_id=item.project_id,
        user_id=current_user.id,
        action="created",
        entity_type="work_item",
        entity_id=work_item.id,
        title=f"Created {key}: {item.title}"
    )
    db.add(activity)
    
    db.commit()
    db.refresh(work_item)
    
    # Return with assignee name
    assignee_name = "Unassigned"
    if work_item.assignee_id and work_item.assignee:
        assignee_name = work_item.assignee.name
    
    return {
        "id": str(work_item.id),
        "key": work_item.key,
        "type": work_item.type,
        "title": work_item.title,
        "description": work_item.description or "",
        "status": work_item.status,
        "priority": work_item.priority,
        "story_points": work_item.story_points or 0,
        "assigned_hours": work_item.estimated_hours or 0,
        "estimated_hours": work_item.estimated_hours or 0,  # Also return as estimated_hours for frontend
        "remaining_hours": work_item.remaining_hours or 0,
        "logged_hours": work_item.logged_hours or 0,
        "assignee": assignee_name,
        "assignee_id": work_item.assignee_id,
        "sprint": "Backlog",
        "epic": "",
        "tags": work_item.tags or [],
        "start_date": work_item.start_date.isoformat() if work_item.start_date else None,
        "due_date": work_item.due_date.isoformat() if work_item.due_date else None,
        "created_at": work_item.created_at.isoformat() if work_item.created_at else None,
        "updated_at": work_item.updated_at.isoformat() if work_item.updated_at else None,
    }


@router.put("/{item_id}")
async def update_work_item(
    item_id: int,
    update: WorkItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an existing work item (requires auth)"""
    item = db.query(WorkItem).filter(WorkItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Work item not found")
    
    # Track old assignee before update for transfer comment
    old_assignee_id = item.assignee_id
    old_assignee_name = "Unassigned"
    if old_assignee_id and item.assignee:
        old_assignee_name = item.assignee.name
    
    update_data = update.dict(exclude_unset=True)
    
    # Handle frontend compatibility: assigned_hours -> estimated_hours
    if 'assigned_hours' in update_data:
        update_data['estimated_hours'] = update_data.pop('assigned_hours')
    
    # Handle date fields - parse ISO strings to datetime
    if 'start_date' in update_data and update_data['start_date']:
        update_data['start_date'] = datetime.fromisoformat(update_data['start_date'].replace('Z', '+00:00'))
    if 'due_date' in update_data and update_data['due_date']:
        update_data['due_date'] = datetime.fromisoformat(update_data['due_date'].replace('Z', '+00:00'))
    
    # Handle status transitions
    if "status" in update_data:
        new_status = update_data["status"]
        if new_status == WorkItemStatus.IN_PROGRESS.value and not item.started_at:
            item.started_at = datetime.utcnow()
        elif new_status == WorkItemStatus.DONE.value and not item.completed_at:
            item.completed_at = datetime.utcnow()
    
    for key, value in update_data.items():
        # Allow null for certain fields, skip only for others
        if key in ['assignee_id', 'sprint_id', 'epic_id', 'parent_id', 'reporter_id']:
            setattr(item, key, value)
        elif value is not None:
            setattr(item, key, value)
    
    # Recalculate remaining_hours if estimated_hours or logged_hours changed
    if 'estimated_hours' in update_data or 'logged_hours' in update_data:
        item.remaining_hours = max(0, (item.estimated_hours or 0) - (item.logged_hours or 0))
    
    item.updated_at = datetime.utcnow()
    
    # Handle ticket transfer - create automatic comment
    if 'assignee_id' in update_data:
        new_assignee_id = update_data['assignee_id']
        # Only create comment if assignee actually changed
        if new_assignee_id != old_assignee_id:
            from models.developer import Developer
            new_assignee_name = "Unassigned"
            if new_assignee_id:
                new_dev = db.query(Developer).filter(Developer.id == new_assignee_id).first()
                if new_dev:
                    new_assignee_name = new_dev.name
            
            # Find developer associated with current user for comment author
            author_dev = db.query(Developer).filter(Developer.email == current_user.email).first()
            author_id = author_dev.id if author_dev else None
            
            # Create automatic transfer comment
            from models.comment import Comment
            transfer_comment = Comment(
                work_item_id=item.id,
                author_id=author_id,
                content=f"Ticket transferred from {old_assignee_name} to {new_assignee_name}."
            )
            db.add(transfer_comment)
            
            # Log activity
            from models.activity_log import ActivityLog
            activity = ActivityLog(
                project_id=item.project_id,
                user_id=current_user.id,
                action="reassigned",
                entity_type="work_item",
                entity_id=item.id,
                title=f"Reassigned {item.key} from {old_assignee_name} to {new_assignee_name}"
            )
            db.add(activity)
    
    # Log activity for status changes
    if 'status' in update_data:
        from models.activity_log import ActivityLog
        action = "completed" if update_data['status'] == 'done' else "updated"
        activity = ActivityLog(
            project_id=item.project_id,
            user_id=current_user.id,
            action=action,
            entity_type="work_item",
            entity_id=item.id,
            title=f"{action.capitalize()} {item.key}: {item.title}"
        )
        db.add(activity)
    
    db.commit()
    db.refresh(item)
    
    # Return with assignee name
    assignee_name = "Unassigned"
    if item.assignee_id and item.assignee:
        assignee_name = item.assignee.name
    
    return {
        "id": str(item.id),
        "key": item.key,
        "type": item.type,
        "title": item.title,
        "description": item.description or "",
        "status": item.status,
        "priority": item.priority,
        "story_points": item.story_points or 0,
        "assigned_hours": item.estimated_hours or 0,
        "remaining_hours": item.remaining_hours or 0,
        "logged_hours": item.logged_hours or 0,
        "logged_hours": item.logged_hours or 0,
        "assignee": assignee_name,
        "assignee_id": item.assignee_id,
        "sprint": "Backlog",
        "epic": "",
        "tags": item.tags or [],
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


@router.put("/batch/status")
async def batch_update_status(
    update: BatchStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Batch update status for multiple work items (requires auth)"""
    items = db.query(WorkItem).filter(WorkItem.id.in_(update.item_ids)).all()
    
    for item in items:
        item.status = update.status
        if update.status == WorkItemStatus.IN_PROGRESS.value and not item.started_at:
            item.started_at = datetime.utcnow()
        elif update.status == WorkItemStatus.DONE.value and not item.completed_at:
            item.completed_at = datetime.utcnow()
        item.updated_at = datetime.utcnow()
    
    db.commit()
    return {"updated": [item.id for item in items], "count": len(items)}


@router.delete("/{item_id}")
async def delete_work_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a work item (requires auth)"""
    item = db.query(WorkItem).filter(WorkItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Work item not found")
    
    # Log activity before deletion
    from models.activity_log import ActivityLog
    activity = ActivityLog(
        project_id=item.project_id,
        user_id=current_user.id,
        action="deleted",
        entity_type="work_item",
        title=f"Deleted {item.key}: {item.title}"
    )
    db.add(activity)
    
    db.delete(item)
    db.commit()
    return {"status": "deleted", "id": item_id}


class LogHoursRequest(BaseModel):
    hours: int
    description: Optional[str] = None


@router.post("/{item_id}/log-hours")
async def log_hours(
    item_id: int,
    request: LogHoursRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Log hours to a work item - creates time entry and updates totals (requires auth)"""
    from models.time_entry import TimeEntry
    from models.developer import Developer
    
    item = db.query(WorkItem).filter(WorkItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Work item not found")
    
    if request.hours <= 0:
        raise HTTPException(status_code=400, detail="Hours must be greater than 0")
    
    # Attribute hours to the PERSON LOGGING THE TIME (current user).
    # This ensures reviewers get credit for their review time in PM tab.
    # The ticket's logged_hours total still increases, but the time entry belongs to the logger.
    developer = db.query(Developer).filter(Developer.email == current_user.email).first()
    
    # If current user is not a developer, fall back to ticket assignee
    if not developer and item.assignee_id:
        developer = db.query(Developer).filter(Developer.id == item.assignee_id).first()
    
    print(f"DEBUG log-hours: current_user.email={current_user.email}, assignee_id={item.assignee_id}, logger_developer={developer.id if developer else 'NOT FOUND'}")
    
    # Create time entry
    time_entry = TimeEntry(
        work_item_id=item_id,
        developer_id=developer.id if developer else item.assignee_id,  # Fallback to assignee_id
        hours=request.hours,
        description=request.description
    )
    db.add(time_entry)
    print(f"DEBUG log-hours: Created TimeEntry developer_id={time_entry.developer_id}, hours={request.hours}")
    
    # Update work item totals
    item.logged_hours = (item.logged_hours or 0) + request.hours
    # Calculate remaining as estimated - logged
    item.remaining_hours = max(0, (item.estimated_hours or 0) - (item.logged_hours or 0))
    item.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(item)
    
    # Return updated item
    assignee_name = "Unassigned"
    if item.assignee_id and item.assignee:
        assignee_name = item.assignee.name
    
    return {
        "id": str(item.id),
        "key": item.key,
        "logged_hours": item.logged_hours,
        "remaining_hours": item.remaining_hours,
        "time_entry": time_entry.to_dict(),
        "message": f"Logged {request.hours}h successfully"
    }


@router.post("/generate")
async def generate_work_items(
    request: GenerateStoriesRequest,
    current_user: User = Depends(get_current_user)
):
    """Generate work items using LLM agent (requires auth)"""
    global item_counter

    # Get project key prefix
    key_prefix = "WI"
    try:
        from routers.projects import projects_db
        project = next((p for p in projects_db if str(p["id"]) == request.product_id), None)
        if project:
            key_prefix = project.get("key_prefix", "WI")
    except Exception:
        pass

    try:
        result = await llm_agent.decompose_project(
            project_description=f"{request.product_name}: {request.product_description}",
            target_market=""
        )

        generated_items = []
        tasks = result.get("tasks", [])
        stories = result.get("user_stories", [])

        all_items = []
        for task in tasks[:request.count]:
            all_items.append({
                "type": "task",
                "title": task.get("title", "Generated Task"),
                "description": task.get("description", ""),
                "priority": task.get("priority", "medium"),
                "story_points": task.get("story_points", 3),
                "tags": task.get("dependencies", [])[:3],
                "epic": task.get("epic", ""),
            })

        for story in stories[:max(0, request.count - len(all_items))]:
            title = story.get("title", "")
            if not title and story.get("as_a"):
                title = f"As a {story['as_a']}, I want {story.get('i_want', '')}"
            all_items.append({
                "type": "user_story",
                "title": title or "Generated Story",
                "description": story.get("description", story.get("so_that", "")),
                "priority": story.get("priority", "medium"),
                "story_points": story.get("story_points", 3),
                "tags": [],
                "epic": "",
            })

        for item_data in all_items:
            item_counter += 1
            item_id = f"{key_prefix}-{item_counter}"
            work_item = {
                "id": item_id,
                "type": item_data["type"],
                "title": item_data["title"],
                "description": item_data["description"],
                "status": "todo",
                "assigned_hours": item_data["story_points"] * 4,
                "remaining_hours": item_data["story_points"] * 4,
                "logged_hours": 0,
                "story_points": item_data["story_points"],
                "priority": item_data["priority"],
                "assignee": "Unassigned",
                "sprint": "Backlog",
                "product_id": request.product_id,
                "tags": item_data.get("tags", []),
                "epic": item_data.get("epic", ""),
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            }
            work_items_db[item_id] = work_item
            generated_items.append(work_item)

        return {"items": generated_items, "generated_count": len(generated_items)}

    except Exception as e:
        # Fallback: generate placeholder items
        generated_items = []
        types = ["user_story", "task", "bug"]
        priorities = ["high", "medium", "low"]
        for i in range(min(request.count, 5)):
            item_counter += 1
            item_id = f"{key_prefix}-{item_counter}"
            work_item = {
                "id": item_id,
                "type": types[i % len(types)],
                "title": f"Generated: {request.product_name} - Item {i + 1}",
                "description": f"Auto-generated item for {request.product_description}",
                "status": "todo",
                "assigned_hours": 8,
                "remaining_hours": 8,
                "logged_hours": 0,
                "story_points": [1, 2, 3, 5, 8][i % 5],
                "priority": priorities[i % len(priorities)],
                "assignee": "Unassigned",
                "sprint": "Backlog",
                "product_id": request.product_id,
                "tags": ["ai-generated"],
                "epic": "",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            }
            work_items_db[item_id] = work_item
            generated_items.append(work_item)

        return {
            "items": generated_items,
            "generated_count": len(generated_items),
            "note": f"Fallback generation used (AI error: {str(e)[:100]})"
        }


# Sprint endpoints
@router.post("/sprints")
async def create_sprint(
    sprint: SprintCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new sprint (requires auth)"""
    # Verify project exists
    project = db.query(Project).filter(Project.id == sprint.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    new_sprint = Sprint(
        project_id=sprint.project_id,
        name=sprint.name,
        goal=sprint.goal,
        start_date=datetime.fromisoformat(sprint.start_date) if sprint.start_date else None,
        end_date=datetime.fromisoformat(sprint.end_date) if sprint.end_date else None,
        capacity_hours=sprint.capacity_hours
    )
    
    db.add(new_sprint)
    db.commit()
    db.refresh(new_sprint)
    return new_sprint


@router.get("/sprints/list")
async def list_sprints(
    project_id: int = None,
    status: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List sprints, optionally filtered by project (requires auth)"""
    query = db.query(Sprint)
    if project_id:
        query = query.filter(Sprint.project_id == project_id)
    if status:
        query = query.filter(Sprint.status == status)
    return query.all()


@router.get("/sprints/{sprint_id}")
async def get_sprint(
    sprint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific sprint with its work items (requires auth)"""
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    return sprint


@router.put("/sprints/{sprint_id}/activate")
async def activate_sprint(
    sprint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Activate a sprint (requires auth)"""
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    
    sprint.status = SprintStatus.ACTIVE.value
    sprint.activated_at = datetime.utcnow()
    db.commit()
    db.refresh(sprint)
    return sprint


@router.put("/sprints/{sprint_id}/complete")
async def complete_sprint(
    sprint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Complete a sprint (requires auth)"""
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    
    sprint.status = SprintStatus.COMPLETED.value
    sprint.completed_at = datetime.utcnow()
    
    # Calculate velocity (completed story points)
    completed_points = db.query(func.sum(WorkItem.story_points)).filter(
        WorkItem.sprint_id == sprint_id,
        WorkItem.status == WorkItemStatus.DONE.value
    ).scalar() or 0
    
    sprint.velocity = completed_points
    db.commit()
    db.refresh(sprint)
    return sprint


class MoveTicketRequest(BaseModel):
    target_sprint_id: Optional[int] = None  # null means move to backlog


@router.put("/{item_id}/move-sprint")
async def move_ticket_to_sprint(
    item_id: int,
    request: MoveTicketRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Move a ticket to a different sprint or to backlog (requires auth)"""
    item = db.query(WorkItem).filter(WorkItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Work item not found")
    
    # If moving to backlog
    if request.target_sprint_id is None:
        item.sprint_id = None
        item.status = WorkItemStatus.BACKLOG.value
    else:
        # Verify sprint exists and belongs to same project
        sprint = db.query(Sprint).filter(
            Sprint.id == request.target_sprint_id,
            Sprint.project_id == item.project_id
        ).first()
        if not sprint:
            raise HTTPException(status_code=404, detail="Sprint not found or doesn't belong to this project")
        
        item.sprint_id = request.target_sprint_id
        # If item was in backlog, move to todo
        if item.status == WorkItemStatus.BACKLOG.value:
            item.status = WorkItemStatus.TODO.value
    
    item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(item)
    
    # Return with sprint name
    sprint_name = "Backlog"
    if item.sprint_id and item.sprint:
        sprint_name = item.sprint.name
    
    assignee_name = "Unassigned"
    if item.assignee_id and item.assignee:
        assignee_name = item.assignee.name
    
    return {
        "id": str(item.id),
        "key": item.key,
        "type": item.type,
        "title": item.title,
        "description": item.description or "",
        "status": item.status,
        "priority": item.priority,
        "story_points": item.story_points or 0,
        "assigned_hours": item.estimated_hours or 0,
        "remaining_hours": item.remaining_hours or 0,
        "logged_hours": item.logged_hours or 0,
        "assignee": assignee_name,
        "assignee_id": item.assignee_id,
        "sprint": sprint_name,
        "sprint_id": item.sprint_id,
        "epic": "",
        "tags": item.tags or [],
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


@router.get("/projects/{project_id}/sprints")
async def list_project_sprints(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all sprints for a project with work item counts (requires auth)"""
    sprints = db.query(Sprint).filter(Sprint.project_id == project_id).order_by(Sprint.start_date).all()
    
    result = []
    for sprint in sprints:
        # Count items by status
        todo_count = db.query(func.count(WorkItem.id)).filter(
            WorkItem.sprint_id == sprint.id,
            WorkItem.status == WorkItemStatus.TODO.value
        ).scalar() or 0
        
        in_progress_count = db.query(func.count(WorkItem.id)).filter(
            WorkItem.sprint_id == sprint.id,
            WorkItem.status == WorkItemStatus.IN_PROGRESS.value
        ).scalar() or 0
        
        done_count = db.query(func.count(WorkItem.id)).filter(
            WorkItem.sprint_id == sprint.id,
            WorkItem.status == WorkItemStatus.DONE.value
        ).scalar() or 0
        
        total_points = db.query(func.sum(WorkItem.story_points)).filter(
            WorkItem.sprint_id == sprint.id
        ).scalar() or 0
        
        completed_points = db.query(func.sum(WorkItem.story_points)).filter(
            WorkItem.sprint_id == sprint.id,
            WorkItem.status == WorkItemStatus.DONE.value
        ).scalar() or 0
        
        result.append({
            "id": sprint.id,
            "name": sprint.name,
            "goal": sprint.goal,
            "status": sprint.status,
            "start_date": sprint.start_date.isoformat() if sprint.start_date else None,
            "end_date": sprint.end_date.isoformat() if sprint.end_date else None,
            "capacity_hours": sprint.capacity_hours,
            "velocity": sprint.velocity,
            "total_items": todo_count + in_progress_count + done_count,
            "todo_count": todo_count,
            "in_progress_count": in_progress_count,
            "done_count": done_count,
            "total_points": total_points,
            "completed_points": completed_points,
            "completion_pct": round((completed_points / total_points * 100) if total_points > 0 else 0, 1)
        })
    
    return result


@router.get("/projects/{project_id}/analytics")
async def get_project_analytics(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get project analytics for charts and graphs (requires auth)"""
    # Verify project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get all work items for the project
    items = db.query(WorkItem).filter(WorkItem.project_id == project_id).all()
    
    # Status distribution
    status_counts = {}
    for status in WorkItemStatus:
        count = sum(1 for item in items if item.status == status.value)
        if count > 0:
            status_counts[status.value] = count
    
    # Type distribution
    type_counts = {}
    for item_type in WorkItemType:
        count = sum(1 for item in items if item.type == item_type.value)
        if count > 0:
            type_counts[item_type.value] = count
    
    # Priority distribution
    priority_counts = {}
    for item in items:
        priority_counts[item.priority] = priority_counts.get(item.priority, 0) + 1
    
    # Sprint velocity data
    sprints = db.query(Sprint).filter(Sprint.project_id == project_id).order_by(Sprint.start_date).all()
    velocity_data = []
    for sprint in sprints:
        total_points = db.query(func.sum(WorkItem.story_points)).filter(
            WorkItem.sprint_id == sprint.id
        ).scalar() or 0
        completed_points = db.query(func.sum(WorkItem.story_points)).filter(
            WorkItem.sprint_id == sprint.id,
            WorkItem.status == WorkItemStatus.DONE.value
        ).scalar() or 0
        velocity_data.append({
            "sprint_name": sprint.name,
            "committed": total_points,
            "completed": completed_points,
            "start_date": sprint.start_date.isoformat() if sprint.start_date else None
        })
    
    # Burndown data (last 14 days)
    from datetime import timedelta
    burndown_data = []
    for i in range(14, -1, -1):
        date = datetime.utcnow() - timedelta(days=i)
        # Count items done by this date
        done_count = sum(1 for item in items 
                        if item.status == WorkItemStatus.DONE.value 
                        and item.completed_at 
                        and item.completed_at.date() <= date.date())
        total_count = len(items)
        remaining = total_count - done_count
        burndown_data.append({
            "date": date.strftime("%Y-%m-%d"),
            "remaining": remaining,
            "completed": done_count
        })
    
    # Team performance (by assignee)
    assignee_stats = {}
    for item in items:
        if item.assignee_id:
            if item.assignee_id not in assignee_stats:
                assignee_stats[item.assignee_id] = {
                    "name": item.assignee.name if item.assignee else f"User {item.assignee_id}",
                    "total_items": 0,
                    "completed_items": 0,
                    "total_points": 0,
                    "completed_points": 0
                }
            assignee_stats[item.assignee_id]["total_items"] += 1
            assignee_stats[item.assignee_id]["total_points"] += item.story_points or 0
            if item.status == WorkItemStatus.DONE.value:
                assignee_stats[item.assignee_id]["completed_items"] += 1
                assignee_stats[item.assignee_id]["completed_points"] += item.story_points or 0
    
    return {
        "total_items": len(items),
        "total_story_points": sum(item.story_points or 0 for item in items),
        "completed_points": sum(item.story_points or 0 for item in items if item.status == WorkItemStatus.DONE.value),
        "status_distribution": status_counts,
        "type_distribution": type_counts,
        "priority_distribution": priority_counts,
        "velocity_data": velocity_data,
        "burndown_data": burndown_data,
        "team_performance": list(assignee_stats.values())
    }


@router.get("/projects/{project_id}/hours-analytics")
async def get_hours_analytics(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get hours analytics for project manager view (requires auth)"""
    from models.developer import Developer
    
    # Verify project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get all work items for the project
    items = db.query(WorkItem).filter(WorkItem.project_id == project_id).all()
    
    # Get all sprints
    sprints = db.query(Sprint).filter(Sprint.project_id == project_id).order_by(Sprint.start_date).all()
    
    # Get all developers assigned to this project
    developers = list(project.developers) if hasattr(project, 'developers') else []
    
    # Hours per sprint
    sprint_hours = []
    for sprint in sprints:
        sprint_items = [item for item in items if item.sprint_id == sprint.id]
        allocated = sum(item.estimated_hours or 0 for item in sprint_items)
        logged = sum(item.logged_hours or 0 for item in sprint_items)
        # Calculate remaining properly: estimated - logged for incomplete items
        remaining = sum(
            max(0, (item.estimated_hours or 0) - (item.logged_hours or 0))
            for item in sprint_items if item.status != WorkItemStatus.DONE.value
        )
        
        sprint_hours.append({
            "sprint_id": sprint.id,
            "sprint_name": sprint.name,
            "status": sprint.status,
            "allocated_hours": allocated,
            "logged_hours": logged,
            "remaining_hours": remaining,
            "total_items": len(sprint_items)
        })
    
    # Hours per developer - track both current assignments AND past contributions
    developer_hours = []
    from models.time_entry import TimeEntry
    
    # Get all time entries for this project's work items
    work_item_ids = [item.id for item in items]
    all_time_entries = db.query(TimeEntry).filter(TimeEntry.work_item_id.in_(work_item_ids)).all() if work_item_ids else []
    
    # Also get developers who have logged time entries for this project's work items
    # (they might not be formally assigned to the project)
    developer_ids_from_entries = {te.developer_id for te in all_time_entries if te.developer_id}
    existing_ids = {d.id for d in developers}
    
    for dev_id in developer_ids_from_entries:
        if dev_id not in existing_ids:
            dev = db.query(Developer).filter(Developer.id == dev_id).first()
            if dev:
                developers.append(dev)
                existing_ids.add(dev_id)
    
    # Build a map of work_item_id to assignee_id for entries with NULL developer_id
    work_item_assignee_map = {item.id: item.assignee_id for item in items}
    
    print(f"DEBUG: Found {len(all_time_entries)} time entries for project {project_id}")
    for te in all_time_entries:
        effective_dev_id = te.developer_id or work_item_assignee_map.get(te.work_item_id)
        print(f"DEBUG: TimeEntry id={te.id}, developer_id={te.developer_id}, effective={effective_dev_id}, hours={te.hours}")
    
    for dev in developers:
        # Tickets currently assigned to this developer
        dev_items = [item for item in items if item.assignee_id == dev.id]
        
        # Hours logged BY this developer (their own time entries where developer_id = dev.id)
        # OR if developer_id is NULL, fall back to ticket assignee attribution
        dev_time_entries = [
            te for te in all_time_entries 
            if te.developer_id == dev.id or
               (te.developer_id is None and work_item_assignee_map.get(te.work_item_id) == dev.id)
        ]
        logged = sum(te.hours for te in dev_time_entries)
        print(f"DEBUG: Developer {dev.name} (id={dev.id}) logged {logged}h from {len(dev_time_entries)} personal entries")
        
        # Allocated = remaining work on their current tickets (estimated - total logged)
        allocated = sum(
            max(0, (item.estimated_hours or 0) - (item.logged_hours or 0))
            for item in dev_items if item.status != WorkItemStatus.DONE.value
        )
        
        # If developer has no current tickets but logged hours, show their contribution
        if len(dev_items) == 0 and logged > 0:
            allocated = logged  # Show their past contribution as allocated
        
        # Remaining = unlogged time on tickets currently assigned to them
        remaining = sum(
            max(0, (item.estimated_hours or 0) - (item.logged_hours or 0))
            for item in dev_items if item.status != WorkItemStatus.DONE.value
        )
        
        completed_items = [item for item in dev_items if item.status == WorkItemStatus.DONE.value]
        
        # Current week logged hours for this developer (Sunday to Saturday)
        from datetime import timedelta
        # Find Sunday of current week (weekday(): Monday=0, Sunday=6)
        today = datetime.utcnow()
        days_since_sunday = (today.weekday() + 1) % 7  # Days since last Sunday
        current_week_start = today - timedelta(days=days_since_sunday)
        current_week_start = current_week_start.replace(hour=0, minute=0, second=0, microsecond=0)
        current_week_end = current_week_start + timedelta(days=6, hours=23, minutes=59, seconds=59)
        
        # Debug logging
        print(f"DEBUG: Week range {current_week_start} to {current_week_end}")
        for te in dev_time_entries:
            if te.logged_at:
                print(f"DEBUG: Entry logged_at={te.logged_at}, in_range={current_week_start <= te.logged_at <= current_week_end}")
        
        current_week_logged = sum(
            te.hours for te in dev_time_entries
            if te.logged_at and current_week_start <= te.logged_at <= current_week_end
        )
        
        developer_hours.append({
            "developer_id": dev.id,
            "developer_name": dev.name,
            "developer_email": dev.email,
            "role": dev.role if hasattr(dev, 'role') else "Developer",
            "allocated_hours": allocated,
            "logged_hours": logged,
            "remaining_hours": remaining,
            "current_week_logged": current_week_logged,
            "total_items": len(dev_items),
            "completed_items": len(completed_items)
        })
    
    # Weekly breakdown - based on calendar weeks (Sunday to Saturday)
    from datetime import timedelta
    from models.time_entry import TimeEntry
    weekly_hours = []
    
    # Get all time entries for this project's work items
    work_item_ids = [item.id for item in items]
    time_entries = db.query(TimeEntry).filter(TimeEntry.work_item_id.in_(work_item_ids)).all()
    
    # Calculate weeks from first sprint start (or project start if no sprints) to now
    today = datetime.utcnow()
    
    # Find the earliest sprint start date, or use project creation if no sprints
    earliest_sprint = db.query(Sprint).filter(
        Sprint.project_id == project_id,
        Sprint.start_date != None
    ).order_by(Sprint.start_date.asc()).first()
    
    if earliest_sprint and earliest_sprint.start_date:
        # Start from the week containing the first sprint start
        period_start = earliest_sprint.start_date
    else:
        # No sprints yet - don't show any weeks until sprint is created
        period_start = today  # This will result in empty weekly_hours
    
    # Find the Sunday of the week containing period_start
    # weekday() returns 0=Monday, 6=Sunday. We want Sunday as start (6 or -1)
    days_to_sunday = (period_start.weekday() + 1) % 7  # Days to previous Sunday
    first_sunday = period_start - timedelta(days=days_to_sunday)
    
    # Generate weeks from first Sunday to now (max 10 weeks for display)
    week_num = 1
    current_week_start = first_sunday
    
    while current_week_start <= today:
        week_end = current_week_start + timedelta(days=6)  # Saturday
        
        # Time entries logged this week
        week_entries = [te for te in time_entries 
                       if te.logged_at 
                       and current_week_start <= te.logged_at <= min(week_end, today)]
        
        # Sum hours from time entries this week
        week_logged = sum(te.hours for te in week_entries)
        
        # Items completed this week
        week_items_completed = [item for item in items 
                               if item.completed_at 
                               and current_week_start <= item.completed_at <= min(week_end, today)]
        
        # Allocated hours = estimated hours of items DUE this week (work to be done)
        # Exclude weekends from calculation
        week_items_allocated = [item for item in items
                               if item.due_date 
                               and current_week_start <= item.due_date <= week_end
                               and item.status != WorkItemStatus.DONE.value]  # Only non-completed items
        
        # Calculate allocated hours excluding weekends
        week_allocated = 0
        for item in week_items_allocated:
            task_start = item.start_date or current_week_start
            task_end = item.due_date
            # Count only working days (Mon-Fri) in this week
            working_days = 0
            current_day = max(task_start, current_week_start)
            end_day = min(task_end, week_end)
            while current_day <= end_day:
                if current_day.weekday() < 5:  # Mon-Fri
                    working_days += 1
                current_day += timedelta(days=1)
            
            # Total days in task
            total_task_days = (task_end - task_start).days + 1
            if total_task_days > 0 and working_days > 0:
                # Proportional hours for working days
                hours_per_day = (item.estimated_hours or 0) / total_task_days
                week_allocated += int(hours_per_day * working_days)
        
        weekly_hours.append({
            "week": current_week_start.strftime("%Y-%m-%d"),
            "week_end": week_end.strftime("%Y-%m-%d"),
            "week_label": f"Week {week_num}",
            # Always show full Sun-Sat range for the week label, not truncated to today
            "date_range": f"{current_week_start.strftime('%Y-%m-%d')} - {week_end.strftime('%Y-%m-%d')}",
            "allocated_hours": week_allocated,
            "logged_hours": week_logged,
            "items_completed": len(week_items_completed)
        })
        
        week_num += 1
        current_week_start = current_week_start + timedelta(weeks=1)
        
        # Limit to 10 most recent weeks
        if week_num > 10:
            break
    
    # Reverse to show most recent weeks first
    weekly_hours.reverse()
    
    # Totals - calculate remaining as estimated - logged if not set
    total_allocated = sum(item.estimated_hours or 0 for item in items)
    total_logged = sum(item.logged_hours or 0 for item in items)
    # Calculate remaining properly: estimated - logged for each item
    total_remaining = sum(
        max(0, (item.estimated_hours or 0) - (item.logged_hours or 0)) 
        for item in items if item.status != WorkItemStatus.DONE.value
    )
    
    # Add per-ticket time breakdown to each developer
    for dev_data in developer_hours:
        dev_id = dev_data["developer_id"]
        # Get all time entries by this developer
        dev_entries = [te for te in time_entries if te.developer_id == dev_id]
        
        # Group by work item
        ticket_breakdown = []
        for entry in dev_entries:
            # Find the work item
            work_item = next((item for item in items if item.id == entry.work_item_id), None)
            if work_item:
                ticket_breakdown.append({
                    "item_id": work_item.id,
                    "item_key": work_item.key,
                    "title": work_item.title,
                    "hours_logged": entry.hours,
                    "logged_at": entry.logged_at.isoformat() if entry.logged_at else None,
                    "description": entry.description
                })
        
        dev_data["ticket_breakdown"] = ticket_breakdown
    
    return {
        "project_name": project.name,
        "total_allocated_hours": total_allocated,
        "total_logged_hours": total_logged,
        "total_remaining_hours": total_remaining,
        "sprint_hours": sprint_hours,
        "developer_hours": developer_hours,
        "weekly_hours": weekly_hours
    }


# ============== TASK DEPENDENCIES ==============

class DependencyCreate(BaseModel):
    depends_on_id: int
    dependency_type: str = "blocks"  # blocks, blocked_by


@router.get("/{item_id}/dependencies")
async def get_item_dependencies(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all dependencies for a work item"""
    from models.task_dependency import TaskDependency
    
    item = db.query(WorkItem).filter(WorkItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Work item not found")
    
    dependencies = db.query(TaskDependency).filter(
        (TaskDependency.work_item_id == item_id) | (TaskDependency.depends_on_id == item_id)
    ).all()
    
    return [d.to_dict() for d in dependencies]


@router.post("/{item_id}/dependencies")
async def add_item_dependency(
    item_id: int,
    dependency: DependencyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a dependency to a work item"""
    from models.task_dependency import TaskDependency
    from models.activity_log import ActivityLog
    
    item = db.query(WorkItem).filter(WorkItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Work item not found")
    
    depends_on = db.query(WorkItem).filter(WorkItem.id == dependency.depends_on_id).first()
    if not depends_on:
        raise HTTPException(status_code=404, detail="Dependent work item not found")
    
    # Check for circular dependency
    if item_id == dependency.depends_on_id:
        raise HTTPException(status_code=400, detail="Cannot create self-dependency")
    
    # Check if dependency already exists
    existing = db.query(TaskDependency).filter(
        TaskDependency.work_item_id == item_id,
        TaskDependency.depends_on_id == dependency.depends_on_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Dependency already exists")
    
    new_dependency = TaskDependency(
        work_item_id=item_id,
        depends_on_id=dependency.depends_on_id,
        dependency_type=dependency.dependency_type
    )
    db.add(new_dependency)
    
    # Log activity
    activity = ActivityLog(
        project_id=item.project_id,
        user_id=current_user.id,
        action="updated",
        entity_type="work_item",
        entity_id=item_id,
        title=f"Added dependency: {item.key} depends on {depends_on.key}"
    )
    db.add(activity)
    
    db.commit()
    db.refresh(new_dependency)
    return new_dependency.to_dict()


@router.delete("/{item_id}/dependencies/{dep_id}")
async def remove_item_dependency(
    item_id: int,
    dep_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove a dependency from a work item"""
    from models.task_dependency import TaskDependency
    from models.activity_log import ActivityLog
    
    dependency = db.query(TaskDependency).filter(
        TaskDependency.id == dep_id,
        TaskDependency.work_item_id == item_id
    ).first()
    
    if not dependency:
        raise HTTPException(status_code=404, detail="Dependency not found")
    
    item = db.query(WorkItem).filter(WorkItem.id == item_id).first()
    
    # Log activity
    activity = ActivityLog(
        project_id=item.project_id if item else None,
        user_id=current_user.id,
        action="updated",
        entity_type="work_item",
        entity_id=item_id,
        title=f"Removed dependency from {item.key if item else item_id}"
    )
    db.add(activity)
    
    db.delete(dependency)
    db.commit()
    return {"status": "deleted", "id": dep_id}


# ============== MY TASKS ==============

@router.get("/my-tasks")
async def get_my_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all tasks assigned to the current user across all projects"""
    from models.developer import Developer
    from models.project import Project
    
    # Find developer associated with current user
    developer = db.query(Developer).filter(Developer.email == current_user.email).first()
    
    if not developer:
        return []
    
    # Get all work items assigned to this developer
    items = db.query(WorkItem).filter(WorkItem.assignee_id == developer.id).all()
    
    result = []
    for item in items:
        project = db.query(Project).filter(Project.id == item.project_id).first()
        
        result.append({
            "id": str(item.id),
            "key": item.key,
            "title": item.title,
            "type": item.type,
            "status": item.status,
            "priority": item.priority,
            "project_id": item.project_id,
            "project_name": project.name if project else "Unknown",
            "due_date": item.due_date.isoformat() if item.due_date else None,
            "estimated_hours": item.estimated_hours,
            "logged_hours": item.logged_hours,
            "remaining_hours": item.remaining_hours,
            "is_overdue": item.due_date and item.due_date < datetime.utcnow() and item.status != "done"
        })
    
    return result
    
    return result
