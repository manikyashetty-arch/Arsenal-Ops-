"""
Projects Router - CRUD operations for projects with work item stats
"""
from fastapi import APIRouter, HTTPException, Depends
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
from services.github_service import github_service, GitHubService

router = APIRouter(prefix="/api/projects", tags=["Projects"])


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
        "developers": developers
    }


@router.post("/")
async def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    """Create a new project"""
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
async def list_projects(db: Session = Depends(get_db)):
    """List all projects"""
    projects = db.query(Project).all()
    return [format_project(p, db) for p in projects]


@router.get("/{project_id}")
async def get_project(project_id: int, db: Session = Depends(get_db)):
    """Get a project with work item stats"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return format_project(project, db)


@router.put("/{project_id}")
async def update_project(project_id: int, update: ProjectUpdate, db: Session = Depends(get_db)):
    """Update a project"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

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

    project.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(project)
    return format_project(project, db)


@router.delete("/{project_id}")
async def delete_project(project_id: int, db: Session = Depends(get_db)):
    """Delete a project and its work items"""
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
    db: Session = Depends(get_db)
):
    """
    Send GitHub repository invitations to all project developers.
    Uses project-specific GitHub token if configured, otherwise uses global GITHUB_TOKEN.
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
async def check_github_status(project_id: int, db: Session = Depends(get_db)):
    """Check GitHub integration status for a project"""
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
    db: Session = Depends(get_db)
):
    """Add a developer to a project"""
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
    db: Session = Depends(get_db)
):
    """Remove a developer from a project"""
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
