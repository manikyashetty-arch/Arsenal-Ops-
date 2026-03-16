"""
Projects Router - CRUD operations for projects with work item stats
"""
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import select, insert, delete

import sys
sys.path.append('..')
from database import get_db
from models.project import Project
from models.developer import Developer, project_developers
from models.architecture import Architecture
from models.user import User, UserRole
from services.github_service import github_service, GitHubService
from routers.auth import get_current_user

router = APIRouter(prefix="/api/projects", tags=["Projects"])


def has_project_access(project: Project, user: User) -> bool:
    """Check if user has access to a project (admin or assigned developer)"""
    # Admin has access to all projects
    if user.role == UserRole.ADMIN.value:
        return True
    
    # Check if user is assigned as a developer to this project
    for dev in project.developers:
        if dev.email == user.email:
            return True
    
    return False


def require_project_access(project_id: int, user: User, db: Session):
    """Require project access, raise 403 if denied"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if not has_project_access(project, user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this project"
        )
    
    return project


class DeveloperAssignment(BaseModel):
    developer_id: int
    role: str
    responsibilities: Optional[str] = None


class ProjectCreate(BaseModel):
    name: str
    description: str
    key_prefix: str = "PROJ"
    github_repo_url: Optional[str] = None
    developers: Optional[List[DeveloperAssignment]] = []


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    github_repo_url: Optional[str] = None
    end_date: Optional[str] = None


class ProjectDeveloperResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    responsibilities: Optional[str]


class ProjectResponse(BaseModel):
    id: int
    name: str
    description: str
    key_prefix: str
    status: str
    created_at: str
    work_item_stats: dict
    developers: List[ProjectDeveloperResponse]


def get_project_work_item_stats(project_id: int, db: Session) -> dict:
    """Get work item statistics for a project"""
    from models.work_item import WorkItem
    
    items = db.query(WorkItem).filter(WorkItem.project_id == project_id).all()
    total = len(items)
    by_status = {}
    for item in items:
        s = item.status or "todo"
        by_status[s] = by_status.get(s, 0) + 1
    total_points = sum(item.story_points or 0 for item in items)
    completed = by_status.get("done", 0)
    return {
        "total": total,
        "by_status": by_status,
        "total_points": total_points,
        "completed": completed,
        "completion_pct": round((completed / total * 100) if total > 0 else 0, 1)
    }


def format_project(project: Project, db: Session) -> dict:
    stats = get_project_work_item_stats(project.id, db)
    
    # Get developers with their roles from the association table
    developers = []
    result = db.execute(
        select(
            Developer.id,
            Developer.name,
            Developer.email,
            Developer.github_username,
            project_developers.c.role,
            project_developers.c.responsibilities
        )
        .join(project_developers, Developer.id == project_developers.c.developer_id)
        .where(project_developers.c.project_id == project.id)
    ).all()
    
    for row in result:
        developers.append({
            "id": row.id,
            "name": row.name,
            "email": row.email,
            "github_username": row.github_username,
            "role": row.role,
            "responsibilities": row.responsibilities
        })
    
    # Parse GitHub repo name if URL exists
    github_repo_name = None
    if project.github_repo_url:
        github_repo_name = github_service.parse_repo_name(project.github_repo_url)
    
    # Get selected architecture
    selected_architecture = db.query(Architecture).filter(
        Architecture.project_id == project.id,
        Architecture.is_selected == True
    ).first()
    
    # Get all architectures for this project
    all_architectures = db.query(Architecture).filter(
        Architecture.project_id == project.id
    ).order_by(Architecture.created_at.desc()).all()
    
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "key_prefix": project.status or "PROJ",
        "status": project.status or "active",
        "github_repo_url": project.github_repo_url,
        "github_repo_name": github_repo_name,
        "created_at": project.created_at.isoformat() if project.created_at else datetime.utcnow().isoformat(),
        "work_item_stats": stats,
        "developers": developers,
        "selected_architecture": selected_architecture.to_dict() if selected_architecture else None,
        "architectures": [arch.to_dict() for arch in all_architectures]
    }


@router.post("/")
async def create_project(
    project: ProjectCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new project (requires auth)"""
    # Check for duplicate project name
    existing = db.query(Project).filter(Project.name == project.name).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Project with name '{project.name}' already exists")
    
    # Parse GitHub repo name from URL
    github_repo_name = None
    if project.github_repo_url:
        github_repo_name = github_service.parse_repo_name(project.github_repo_url)
    
    new_project = Project(
        name=project.name,
        description=project.description,
        status=project.key_prefix.upper().replace(" ", "") if project.key_prefix else "PROJ",
        github_repo_url=project.github_repo_url,
        github_repo_name=github_repo_name
    )
    
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    
    # Assign developers if provided
    if project.developers:
        for dev_assignment in project.developers:
            # Verify developer exists
            developer = db.query(Developer).filter(Developer.id == dev_assignment.developer_id).first()
            if not developer:
                raise HTTPException(status_code=400, detail=f"Developer with ID {dev_assignment.developer_id} not found")
            
            # Insert into association table
            db.execute(
                insert(project_developers).values(
                    project_id=new_project.id,
                    developer_id=dev_assignment.developer_id,
                    role=dev_assignment.role,
                    responsibilities=dev_assignment.responsibilities
                )
            )
        db.commit()
    
    return format_project(new_project, db)


@router.get("/")
async def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all projects (admin sees all, developers see assigned only)"""
    if current_user.role == UserRole.ADMIN.value:
        # Admin sees all projects
        projects = db.query(Project).all()
    else:
        # Developer sees only assigned projects
        projects = db.query(Project).join(project_developers).join(Developer).filter(
            Developer.email == current_user.email
        ).all()
    
    return [format_project(p, db) for p in projects]


@router.get("/{project_id}")
async def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a project with work item stats (requires access)"""
    project = require_project_access(project_id, current_user, db)
    return format_project(project, db)


@router.put("/{project_id}")
async def update_project(
    project_id: int,
    update: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a project (requires access)"""
    project = require_project_access(project_id, current_user, db)

    if update.name is not None:
        project.name = update.name
    if update.description is not None:
        project.description = update.description
    if update.status is not None:
        project.status = update.status
    if update.github_repo_url is not None:
        project.github_repo_url = update.github_repo_url
        # Update github_repo_name
        project.github_repo_name = github_service.parse_repo_name(update.github_repo_url)
    if update.end_date is not None:
        project.end_date = datetime.fromisoformat(update.end_date.replace('Z', '+00:00')) if update.end_date else None

    project.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(project)
    return format_project(project, db)


@router.delete("/{project_id}")
async def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a project and its work items (requires admin access)"""
    # Only admins can delete projects
    if current_user.role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete projects"
        )
    
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Delete project (cascade will handle related records)
    db.delete(project)
    db.commit()
    return {"status": "deleted", "id": project_id}


@router.post("/{project_id}/github-invite")
async def send_github_invitations(
    project_id: int, 
    role: str = "push",  # pull, push, admin, maintain, triage
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Send GitHub repository invitations to all project developers.
    Uses project-specific GitHub token if configured, otherwise uses global GITHUB_TOKEN.
    (requires auth)
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if not project.github_repo_url:
        raise HTTPException(status_code=400, detail="Project has no GitHub repository URL configured")
    
    # Parse repo name - prefer explicit repo_name if set
    repo_name = project.github_repo_name or github_service.parse_repo_name(project.github_repo_url)
    if not repo_name:
        raise HTTPException(status_code=400, detail="Invalid GitHub repository URL")
    
    # Use project-specific token or fall back to global token
    project_github_service = GitHubService(token=project.github_token) if project.github_token else github_service
    
    # Check GitHub configuration
    if not project_github_service.is_configured():
        raise HTTPException(
            status_code=503, 
            detail="GitHub integration not configured. Set GITHUB_TOKEN environment variable or add a project-specific token in Admin."
        )
    
    # Get developers with GitHub usernames
    developers = db.execute(
        select(
            Developer.id,
            Developer.name,
            Developer.github_username
        )
        .join(project_developers, Developer.id == project_developers.c.developer_id)
        .where(project_developers.c.project_id == project_id)
    ).all()
    
    # Filter developers with GitHub usernames
    github_usernames = [d.github_username for d in developers if d.github_username]
    
    if not github_usernames:
        return {
            "success": False,
            "message": "No developers with GitHub usernames found in this project",
            "developers_without_github": [
                {"id": d.id, "name": d.name} for d in developers if not d.github_username
            ]
        }
    
    # Send invitations using project-specific or global service
    result = project_github_service.send_bulk_invitations(repo_name, github_usernames, role)
    
    return {
        "success": result["failed"] == 0,
        "project_id": project_id,
        "repo_name": repo_name,
        "used_project_token": bool(project.github_token),
        "total_invitations": result["total"],
        "successful": result["successful"],
        "failed": result["failed"],
        "results": result["results"],
        "developers_without_github": [
            {"id": d.id, "name": d.name} for d in developers if not d.github_username
        ]
    }


@router.get("/{project_id}/github-status")
async def check_github_status(
    project_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Check GitHub integration status for a project (requires auth)"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get developers with GitHub usernames
    developers = db.execute(
        select(
            Developer.id,
            Developer.github_username
        )
        .join(project_developers, Developer.id == project_developers.c.developer_id)
        .where(project_developers.c.project_id == project_id)
    ).all()
    
    developers_with_github = [d for d in developers if d.github_username]
    
    return {
        "has_repo": bool(project.github_repo_url),
        "repo_url": project.github_repo_url,
        "repo_name": project.github_repo_name,
        "developer_count": len(developers_with_github),
        "sent_count": 0,  # TODO: Track sent invitations in database
        "configured": github_service.is_configured(),
        "has_admin_access": github_service.validate_repo_access(project.github_repo_name) if project.github_repo_name else False,
    }


@router.post("/{project_id}/developers")
async def add_developer_to_project(
    project_id: int, 
    assignment: DeveloperAssignment, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a developer to a project (requires auth)"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    developer = db.query(Developer).filter(Developer.id == assignment.developer_id).first()
    if not developer:
        raise HTTPException(status_code=404, detail="Developer not found")
    
    # Check if already assigned
    existing = db.execute(
        select(project_developers).where(
            project_developers.c.project_id == project_id,
            project_developers.c.developer_id == assignment.developer_id
        )
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Developer already assigned to this project")
    
    # Add to association table
    db.execute(
        insert(project_developers).values(
            project_id=project_id,
            developer_id=assignment.developer_id,
            role=assignment.role,
            responsibilities=assignment.responsibilities
        )
    )
    db.commit()
    
    return {"status": "success", "message": f"Developer {developer.name} added to project"}


@router.delete("/{project_id}/developers/{developer_id}")
async def remove_developer_from_project(
    project_id: int, 
    developer_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove a developer from a project (requires auth)"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Delete from association table
    result = db.execute(
        project_developers.delete().where(
            project_developers.c.project_id == project_id,
            project_developers.c.developer_id == developer_id
        )
    )
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Developer not found in this project")
    
    db.commit()
    return {"status": "success", "message": "Developer removed from project"}


# ============== PROJECT HUB ENDPOINTS ==============

# --- Goals ---

class GoalCreate(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None

class GoalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    progress: Optional[int] = None
    due_date: Optional[datetime] = None

@router.get("/{project_id}/goals")
async def get_project_goals(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all goals for a project"""
    project = require_project_access(project_id, current_user, db)
    
    from models.project_goal import ProjectGoal
    goals = db.query(ProjectGoal).filter(ProjectGoal.project_id == project_id).order_by(ProjectGoal.created_at.desc()).all()
    return [g.to_dict() for g in goals]


@router.post("/{project_id}/goals")
async def create_project_goal(
    project_id: int,
    goal: GoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new project goal"""
    project = require_project_access(project_id, current_user, db)
    
    from models.project_goal import ProjectGoal
    from models.activity_log import ActivityLog
    
    new_goal = ProjectGoal(
        project_id=project_id,
        title=goal.title,
        description=goal.description,
        due_date=goal.due_date
    )
    db.add(new_goal)
    
    # Log activity
    activity = ActivityLog(
        project_id=project_id,
        user_id=current_user.id,
        action="created",
        entity_type="goal",
        entity_id=new_goal.id,
        title=f"Created goal: {goal.title}"
    )
    db.add(activity)
    
    db.commit()
    db.refresh(new_goal)
    return new_goal.to_dict()


@router.put("/goals/{goal_id}")
async def update_project_goal(
    goal_id: int,
    goal_update: GoalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a project goal"""
    from models.project_goal import ProjectGoal
    from models.activity_log import ActivityLog
    
    goal = db.query(ProjectGoal).filter(ProjectGoal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    require_project_access(goal.project_id, current_user, db)
    
    if goal_update.title is not None:
        goal.title = goal_update.title
    if goal_update.description is not None:
        goal.description = goal_update.description
    if goal_update.status is not None:
        goal.status = goal_update.status
        if goal_update.status == "completed":
            goal.completed_at = datetime.utcnow()
    if goal_update.progress is not None:
        goal.progress = goal_update.progress
    if goal_update.due_date is not None:
        goal.due_date = goal_update.due_date
    
    goal.updated_at = datetime.utcnow()
    
    # Log activity
    activity = ActivityLog(
        project_id=goal.project_id,
        user_id=current_user.id,
        action="updated",
        entity_type="goal",
        entity_id=goal.id,
        title=f"Updated goal: {goal.title}"
    )
    db.add(activity)
    
    db.commit()
    return goal.to_dict()


@router.delete("/goals/{goal_id}")
async def delete_project_goal(
    goal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a project goal"""
    from models.project_goal import ProjectGoal
    from models.activity_log import ActivityLog
    
    goal = db.query(ProjectGoal).filter(ProjectGoal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    project = require_project_access(goal.project_id, current_user, db)
    
    # Log activity before deletion
    activity = ActivityLog(
        project_id=goal.project_id,
        user_id=current_user.id,
        action="deleted",
        entity_type="goal",
        title=f"Deleted goal: {goal.title}"
    )
    db.add(activity)
    
    db.delete(goal)
    db.commit()
    return {"status": "deleted", "id": goal_id}


# --- Milestones ---

class MilestoneCreate(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None

@router.get("/{project_id}/milestones")
async def get_project_milestones(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all milestones for a project"""
    project = require_project_access(project_id, current_user, db)
    
    from models.project_milestone import ProjectMilestone
    milestones = db.query(ProjectMilestone).filter(ProjectMilestone.project_id == project_id).order_by(ProjectMilestone.due_date).all()
    return [m.to_dict() for m in milestones]


@router.post("/{project_id}/milestones")
async def create_project_milestone(
    project_id: int,
    milestone: MilestoneCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new project milestone"""
    project = require_project_access(project_id, current_user, db)
    
    from models.project_milestone import ProjectMilestone
    from models.activity_log import ActivityLog
    
    new_milestone = ProjectMilestone(
        project_id=project_id,
        title=milestone.title,
        description=milestone.description,
        due_date=milestone.due_date
    )
    db.add(new_milestone)
    
    # Log activity
    activity = ActivityLog(
        project_id=project_id,
        user_id=current_user.id,
        action="created",
        entity_type="milestone",
        entity_id=new_milestone.id,
        title=f"Created milestone: {milestone.title}"
    )
    db.add(activity)
    
    db.commit()
    db.refresh(new_milestone)
    return new_milestone.to_dict()


@router.put("/milestones/{milestone_id}")
async def update_project_milestone(
    milestone_id: int,
    milestone_update: MilestoneCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a project milestone"""
    from models.project_milestone import ProjectMilestone
    
    milestone = db.query(ProjectMilestone).filter(ProjectMilestone.id == milestone_id).first()
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")
    
    require_project_access(milestone.project_id, current_user, db)
    
    milestone.title = milestone_update.title
    milestone.description = milestone_update.description
    milestone.due_date = milestone_update.due_date
    
    db.commit()
    return milestone.to_dict()


@router.post("/milestones/{milestone_id}/complete")
async def complete_project_milestone(
    milestone_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark a milestone as completed"""
    from models.project_milestone import ProjectMilestone
    from models.activity_log import ActivityLog
    
    milestone = db.query(ProjectMilestone).filter(ProjectMilestone.id == milestone_id).first()
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")
    
    require_project_access(milestone.project_id, current_user, db)
    
    milestone.completed_at = datetime.utcnow()
    
    # Log activity
    activity = ActivityLog(
        project_id=milestone.project_id,
        user_id=current_user.id,
        action="completed",
        entity_type="milestone",
        entity_id=milestone.id,
        title=f"Completed milestone: {milestone.title}"
    )
    db.add(activity)
    
    db.commit()
    return milestone.to_dict()


@router.delete("/milestones/{milestone_id}")
async def delete_project_milestone(
    milestone_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a project milestone"""
    from models.project_milestone import ProjectMilestone
    from models.activity_log import ActivityLog
    
    milestone = db.query(ProjectMilestone).filter(ProjectMilestone.id == milestone_id).first()
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")
    
    project = require_project_access(milestone.project_id, current_user, db)
    
    # Log activity before deletion
    activity = ActivityLog(
        project_id=milestone.project_id,
        user_id=current_user.id,
        action="deleted",
        entity_type="milestone",
        title=f"Deleted milestone: {milestone.title}"
    )
    db.add(activity)
    
    db.delete(milestone)
    db.commit()
    return {"status": "deleted", "id": milestone_id}


# --- Activity Feed ---

@router.get("/{project_id}/activity")
async def get_project_activity(
    project_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get activity feed for a project"""
    project = require_project_access(project_id, current_user, db)
    
    from models.activity_log import ActivityLog
    activities = db.query(ActivityLog).filter(
        ActivityLog.project_id == project_id
    ).order_by(ActivityLog.created_at.desc()).limit(limit).all()
    
    return [a.to_dict() for a in activities]


# --- Workload ---

def get_working_days_in_range(start_date: datetime, end_date: datetime) -> int:
    """Calculate number of working days (Mon-Fri) between two dates"""
    if not start_date or not end_date:
        return 0
    
    # Ensure start <= end
    if start_date > end_date:
        start_date, end_date = end_date, start_date
    
    working_days = 0
    current = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    end = end_date.replace(hour=0, minute=0, second=0, microsecond=0)
    
    while current <= end:
        # weekday(): Monday=0, Sunday=6
        if current.weekday() < 5:  # Mon-Fri
            working_days += 1
        current += timedelta(days=1)
    
    return working_days

def calculate_hours_excluding_weekends(total_hours: int, start_date: datetime, end_date: datetime) -> int:
    """Calculate hours proportionally excluding weekend days"""
    if not start_date or not end_date or total_hours <= 0:
        return 0
    
    # Total days in range
    total_days = (end_date - start_date).days + 1
    if total_days <= 0:
        return total_hours
    
    # Working days in range
    working_days = get_working_days_in_range(start_date, end_date)
    
    # If no working days (task spans only weekend), return 0
    if working_days == 0:
        return 0
    
    # Proportional hours: (working_days / total_days) * total_hours
    # But simpler: assume hours are evenly distributed across working days only
    hours_per_day = total_hours / total_days
    return int(hours_per_day * working_days)

@router.get("/{project_id}/workload")
async def get_project_workload(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get workload data for all developers in a project"""
    project = require_project_access(project_id, current_user, db)
    
    from models.work_item import WorkItem
    from datetime import timedelta
    
    # Calculate this week's boundaries (Sunday to Saturday)
    today = datetime.utcnow()
    days_since_sunday = (today.weekday() + 1) % 7
    week_start = today - timedelta(days=days_since_sunday)
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = week_start + timedelta(days=6, hours=23, minutes=59, seconds=59)
    
    # Get all work items for this project
    items = db.query(WorkItem).filter(WorkItem.project_id == project_id).all()
    
    # Group by assignee
    workload_data = {}
    
    for item in items:
        assignee_id = item.assignee_id
        if not assignee_id:
            assignee_id = "unassigned"
        
        if assignee_id not in workload_data:
            assignee_name = "Unassigned"
            if item.assignee:
                assignee_name = item.assignee.name
            workload_data[assignee_id] = {
                "developer_id": assignee_id,
                "developer_name": assignee_name,
                "total_items": 0,
                "completed_items": 0,
                "in_progress_items": 0,
                "todo_items": 0,
                "overdue_items": 0,
                "estimated_hours": 0,
                "logged_hours": 0,
                "remaining_hours": 0,
                "this_week_remaining_hours": 0,  # Only tasks due this week (Mon-Fri)
                "items": []
            }
        
        
        workload_data[assignee_id]["total_items"] += 1
        workload_data[assignee_id]["estimated_hours"] += item.estimated_hours or 0
        workload_data[assignee_id]["logged_hours"] += item.logged_hours or 0
        workload_data[assignee_id]["remaining_hours"] += item.remaining_hours or 0
        
        # Count this week's allocated hours for active tasks (in_progress or todo)
        # Include tasks that are in progress (regardless of due date) OR due this week
        if item.status != "done" and item.estimated_hours:
            is_active_this_week = (
                # Task is in progress (actively being worked on)
                item.status == "in_progress" or
                # Task is due this week
                (item.due_date and week_start <= item.due_date <= week_end) or
                # Task spans this week (start date in past, due date in future)
                (item.start_date and item.due_date and item.start_date <= week_end and item.due_date >= week_start)
            )
            
            if is_active_this_week:
                # Calculate working days only for this week portion
                task_start = item.start_date or week_start
                task_end = item.due_date or (week_start + timedelta(days=6))
                
                # Calculate overlap with this week
                overlap_start = max(task_start, week_start)
                overlap_end = min(task_end, week_end)
                
                if overlap_start <= overlap_end:
                    working_hours = calculate_hours_excluding_weekends(
                        item.remaining_hours or item.estimated_hours or 0, 
                        overlap_start, 
                        overlap_end
                    )
                    workload_data[assignee_id]["this_week_remaining_hours"] += working_hours
        
        if item.status == "done":
            workload_data[assignee_id]["completed_items"] += 1
        elif item.status == "in_progress":
            workload_data[assignee_id]["in_progress_items"] += 1
        else:
            workload_data[assignee_id]["todo_items"] += 1
        
        # Check if overdue
        if item.due_date and item.due_date < datetime.utcnow() and item.status != "done":
            workload_data[assignee_id]["overdue_items"] += 1
        
        workload_data[assignee_id]["items"].append({
            "id": item.id,
            "key": item.key,
            "title": item.title,
            "status": item.status,
            "priority": item.priority,
            "due_date": item.due_date.isoformat() if item.due_date else None,
            "estimated_hours": item.estimated_hours,
            "logged_hours": item.logged_hours
        })
    
    return list(workload_data.values())
