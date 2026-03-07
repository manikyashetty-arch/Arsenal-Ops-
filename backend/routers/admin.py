"""Admin router - Employee and developer management"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

import sys
sys.path.append('..')
from database import get_db
from models.developer import Developer
from models.project import Project
from models.work_item import WorkItem

router = APIRouter(prefix="/api/admin", tags=["admin"])


class EmployeeCreate(BaseModel):
    name: str
    email: str
    github_username: Optional[str] = None
    avatar_url: Optional[str] = None
    specialization: Optional[str] = None  # frontend, backend, devops, etc.


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    github_username: Optional[str] = None
    avatar_url: Optional[str] = None
    specialization: Optional[str] = None


class EmployeeResponse(BaseModel):
    id: int
    name: str
    email: str
    github_username: Optional[str]
    avatar_url: Optional[str]
    specialization: Optional[str]
    created_at: datetime
    updated_at: datetime
    project_count: int
    assigned_items_count: int

    class Config:
        from_attributes = True


class DashboardStats(BaseModel):
    total_employees: int
    total_projects: int
    total_tickets: int
    active_sprints: int
    tickets_by_status: dict
    tickets_by_priority: dict


# Developer specialization mapping
SPECIALIZATIONS = [
    "frontend",
    "backend", 
    "fullstack",
    "devops",
    "qa",
    "mobile",
    "data",
    "ml",
    "design",
    "pm"
]


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(db: Session = Depends(get_db)):
    """Get admin dashboard statistics"""
    from models.sprint import Sprint
    
    total_employees = db.query(Developer).count()
    total_projects = db.query(Project).count()
    total_tickets = db.query(WorkItem).count()
    active_sprints = db.query(Sprint).filter(Sprint.status == "active").count()
    
    # Tickets by status
    tickets_by_status = {}
    for status in ["backlog", "todo", "in_progress", "in_review", "done"]:
        count = db.query(WorkItem).filter(WorkItem.status == status).count()
        tickets_by_status[status] = count
    
    # Tickets by priority
    tickets_by_priority = {}
    for priority in ["low", "medium", "high", "critical"]:
        count = db.query(WorkItem).filter(WorkItem.priority == priority).count()
        tickets_by_priority[priority] = count
    
    return DashboardStats(
        total_employees=total_employees,
        total_projects=total_projects,
        total_tickets=total_tickets,
        active_sprints=active_sprints,
        tickets_by_status=tickets_by_status,
        tickets_by_priority=tickets_by_priority
    )


@router.get("/employees", response_model=List[EmployeeResponse])
async def list_employees(db: Session = Depends(get_db)):
    """Get all employees/developers"""
    developers = db.query(Developer).all()
    
    result = []
    for dev in developers:
        # Get specialization from metadata if available
        specialization = getattr(dev, 'specialization', None)
        
        result.append(EmployeeResponse(
            id=dev.id,
            name=dev.name,
            email=dev.email,
            github_username=dev.github_username,
            avatar_url=dev.avatar_url,
            specialization=specialization,
            created_at=dev.created_at,
            updated_at=dev.updated_at,
            project_count=len(dev.projects) if dev.projects else 0,
            assigned_items_count=len(dev.assigned_work_items) if dev.assigned_work_items else 0
        ))
    
    return result


@router.post("/employees", response_model=EmployeeResponse)
async def create_employee(employee: EmployeeCreate, db: Session = Depends(get_db)):
    """Create a new employee/developer"""
    # Check if email already exists
    existing = db.query(Developer).filter(Developer.email == employee.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    # Check github username uniqueness if provided
    if employee.github_username:
        existing_github = db.query(Developer).filter(
            Developer.github_username == employee.github_username
        ).first()
        if existing_github:
            raise HTTPException(status_code=400, detail="GitHub username already exists")
    
    new_employee = Developer(
        name=employee.name,
        email=employee.email,
        github_username=employee.github_username,
        avatar_url=employee.avatar_url
    )
    
    db.add(new_employee)
    db.commit()
    db.refresh(new_employee)
    
    return EmployeeResponse(
        id=new_employee.id,
        name=new_employee.name,
        email=new_employee.email,
        github_username=new_employee.github_username,
        avatar_url=new_employee.avatar_url,
        specialization=employee.specialization,
        created_at=new_employee.created_at,
        updated_at=new_employee.updated_at,
        project_count=0,
        assigned_items_count=0
    )


@router.put("/employees/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: int,
    update: EmployeeUpdate,
    db: Session = Depends(get_db)
):
    """Update an employee/developer"""
    employee = db.query(Developer).filter(Developer.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    if update.name:
        employee.name = update.name
    if update.email:
        # Check email uniqueness
        existing = db.query(Developer).filter(
            Developer.email == update.email,
            Developer.id != employee_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already exists")
        employee.email = update.email
    if update.github_username is not None:
        if update.github_username:
            existing_github = db.query(Developer).filter(
                Developer.github_username == update.github_username,
                Developer.id != employee_id
            ).first()
            if existing_github:
                raise HTTPException(status_code=400, detail="GitHub username already exists")
        employee.github_username = update.github_username
    if update.avatar_url is not None:
        employee.avatar_url = update.avatar_url
    
    db.commit()
    db.refresh(employee)
    
    return EmployeeResponse(
        id=employee.id,
        name=employee.name,
        email=employee.email,
        github_username=employee.github_username,
        avatar_url=employee.avatar_url,
        specialization=update.specialization,
        created_at=employee.created_at,
        updated_at=employee.updated_at,
        project_count=len(employee.projects) if employee.projects else 0,
        assigned_items_count=len(employee.assigned_work_items) if employee.assigned_work_items else 0
    )


@router.delete("/employees/{employee_id}")
async def delete_employee(employee_id: int, db: Session = Depends(get_db)):
    """Delete an employee/developer"""
    employee = db.query(Developer).filter(Developer.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Unassign from work items
    db.query(WorkItem).filter(WorkItem.assignee_id == employee_id).update(
        {"assignee_id": None}
    )
    
    db.delete(employee)
    db.commit()
    
    return {"message": "Employee deleted"}


@router.get("/specializations")
async def get_specializations():
    """Get list of available specializations"""
    return {"specializations": SPECIALIZATIONS}


class ProjectGitHubUpdate(BaseModel):
    github_repo_url: Optional[str] = None
    github_repo_name: Optional[str] = None
    github_token: Optional[str] = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    status: str
    created_at: Optional[str]
    total_items: int
    done_items: int
    completion_pct: float
    developer_count: int
    github_repo_url: Optional[str]
    github_repo_name: Optional[str]
    has_github_token: bool

    class Config:
        from_attributes = True


@router.get("/projects", response_model=List[ProjectResponse])
async def list_all_projects(db: Session = Depends(get_db)):
    """Get all projects with stats for admin"""
    projects = db.query(Project).all()
    
    result = []
    for project in projects:
        total_items = len(project.work_items) if project.work_items else 0
        done_items = len([i for i in (project.work_items or []) if i.status == "done"])
        
        result.append(ProjectResponse(
            id=project.id,
            name=project.name,
            description=project.description,
            status=project.status,
            created_at=project.created_at.isoformat() if project.created_at else None,
            total_items=total_items,
            done_items=done_items,
            completion_pct=round((done_items / total_items * 100) if total_items > 0 else 0, 1),
            developer_count=len(project.developers) if project.developers else 0,
            github_repo_url=project.github_repo_url,
            github_repo_name=project.github_repo_name,
            has_github_token=bool(project.github_token)
        ))
    
    return result


@router.put("/projects/{project_id}/github")
async def update_project_github(
    project_id: int,
    update: ProjectGitHubUpdate,
    db: Session = Depends(get_db)
):
    """Update project GitHub settings"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if update.github_repo_url is not None:
        project.github_repo_url = update.github_repo_url
    if update.github_repo_name is not None:
        project.github_repo_name = update.github_repo_name
    if update.github_token is not None:
        project.github_token = update.github_token
    
    db.commit()
    db.refresh(project)
    
    return {
        "id": project.id,
        "name": project.name,
        "github_repo_url": project.github_repo_url,
        "github_repo_name": project.github_repo_name,
        "has_github_token": bool(project.github_token)
    }
