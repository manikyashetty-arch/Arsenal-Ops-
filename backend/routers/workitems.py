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
from services.llm_agent import llm_agent

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


class WorkItemUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    estimated_hours: Optional[int] = None
    remaining_hours: Optional[int] = None
    story_points: Optional[int] = None
    priority: Optional[str] = None
    assignee_id: Optional[int] = None
    sprint_id: Optional[int] = None
    tags: Optional[List[str]] = None
    type: Optional[str] = None
    epic_id: Optional[int] = None
    parent_id: Optional[int] = None
    acceptance_criteria: Optional[List[str]] = None


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
    db: Session = Depends(get_db)
):
    """List all work items with optional filters"""
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
            "remaining_hours": item.remaining_hours or 0,
            "assignee": "Unassigned",
            "assignee_id": item.assignee_id,
            "sprint": "Backlog",
            "sprint_id": item.sprint_id,
            "epic": "",
            "tags": item.tags or [],
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "updated_at": item.updated_at.isoformat() if item.updated_at else None,
        }
        
        # Get assignee name
        if item.assignee_id and item.assignee:
            item_dict["assignee"] = item.assignee.name
        
        # Get sprint name
        if item.sprint_id and item.sprint:
            item_dict["sprint"] = item.sprint.name
        
        result.append(item_dict)
    
    return result


@router.get("/{item_id}")
async def get_work_item(item_id: int, db: Session = Depends(get_db)):
    """Get a specific work item"""
    item = db.query(WorkItem).filter(WorkItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Work item not found")
    return item


@router.post("/")
async def create_work_item(item: WorkItemCreate, db: Session = Depends(get_db)):
    """Create a new work item"""
    # Get project for key prefix
    project = db.query(Project).filter(Project.id == item.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Generate key
    key_prefix = project.status[:4].upper() if project.status else "PROJ"
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
        remaining_hours=item.remaining_hours,
        story_points=item.story_points,
        priority=item.priority,
        assignee_id=item.assignee_id,
        sprint_id=item.sprint_id,
        epic_id=item.epic_id,
        parent_id=item.parent_id,
        tags=item.tags,
        acceptance_criteria=item.acceptance_criteria
    )
    
    db.add(work_item)
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
        "remaining_hours": work_item.remaining_hours or 0,
        "assignee": assignee_name,
        "assignee_id": work_item.assignee_id,
        "sprint": "Backlog",
        "epic": "",
        "tags": work_item.tags or [],
        "created_at": work_item.created_at.isoformat() if work_item.created_at else None,
        "updated_at": work_item.updated_at.isoformat() if work_item.updated_at else None,
    }


@router.put("/{item_id}")
async def update_work_item(item_id: int, update: WorkItemUpdate, db: Session = Depends(get_db)):
    """Update an existing work item"""
    item = db.query(WorkItem).filter(WorkItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Work item not found")
    
    update_data = update.dict(exclude_unset=True)
    
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
    
    item.updated_at = datetime.utcnow()
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
        "assignee": assignee_name,
        "assignee_id": item.assignee_id,
        "sprint": "Backlog",
        "epic": "",
        "tags": item.tags or [],
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


@router.put("/batch/status")
async def batch_update_status(update: BatchStatusUpdate, db: Session = Depends(get_db)):
    """Batch update status for multiple work items"""
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
async def delete_work_item(item_id: int, db: Session = Depends(get_db)):
    """Delete a work item"""
    item = db.query(WorkItem).filter(WorkItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Work item not found")
    
    db.delete(item)
    db.commit()
    return {"status": "deleted", "id": item_id}


@router.post("/generate")
async def generate_work_items(request: GenerateStoriesRequest):
    """Generate work items using LLM agent"""
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
async def create_sprint(sprint: SprintCreate, db: Session = Depends(get_db)):
    """Create a new sprint"""
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
async def list_sprints(project_id: int = None, status: str = None, db: Session = Depends(get_db)):
    """List sprints, optionally filtered by project"""
    query = db.query(Sprint)
    if project_id:
        query = query.filter(Sprint.project_id == project_id)
    if status:
        query = query.filter(Sprint.status == status)
    return query.all()


@router.get("/sprints/{sprint_id}")
async def get_sprint(sprint_id: int, db: Session = Depends(get_db)):
    """Get a specific sprint with its work items"""
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    return sprint


@router.put("/sprints/{sprint_id}/activate")
async def activate_sprint(sprint_id: int, db: Session = Depends(get_db)):
    """Activate a sprint"""
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    
    sprint.status = SprintStatus.ACTIVE.value
    sprint.activated_at = datetime.utcnow()
    db.commit()
    db.refresh(sprint)
    return sprint


@router.put("/sprints/{sprint_id}/complete")
async def complete_sprint(sprint_id: int, db: Session = Depends(get_db)):
    """Complete a sprint"""
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
    db: Session = Depends(get_db)
):
    """Move a ticket to a different sprint or to backlog"""
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
async def list_project_sprints(project_id: int, db: Session = Depends(get_db)):
    """List all sprints for a project with work item counts"""
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
