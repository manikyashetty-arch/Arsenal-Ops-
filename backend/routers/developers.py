"""
Developers Router - CRUD operations for developers
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session

import sys
sys.path.append('..')
from database import get_db
from models.developer import Developer

router = APIRouter(prefix="/api/developers", tags=["Developers"])


class DeveloperCreate(BaseModel):
    name: str
    email: str
    github_username: Optional[str] = None
    avatar_url: Optional[str] = None


class DeveloperUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    github_username: Optional[str] = None
    avatar_url: Optional[str] = None


class DeveloperResponse(BaseModel):
    id: int
    name: str
    email: str
    github_username: Optional[str]
    avatar_url: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


@router.post("/", response_model=DeveloperResponse)
async def create_developer(developer: DeveloperCreate, db: Session = Depends(get_db)):
    """Create a new developer"""
    # Check if email already exists
    existing = db.query(Developer).filter(Developer.email == developer.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Developer with this email already exists")
    
    new_developer = Developer(
        name=developer.name,
        email=developer.email,
        github_username=developer.github_username,
        avatar_url=developer.avatar_url
    )
    db.add(new_developer)
    db.commit()
    db.refresh(new_developer)
    return new_developer


@router.get("/", response_model=List[DeveloperResponse])
async def list_developers(db: Session = Depends(get_db)):
    """List all developers"""
    developers = db.query(Developer).all()
    return developers


@router.get("/{developer_id}", response_model=DeveloperResponse)
async def get_developer(developer_id: int, db: Session = Depends(get_db)):
    """Get a developer by ID"""
    developer = db.query(Developer).filter(Developer.id == developer_id).first()
    if not developer:
        raise HTTPException(status_code=404, detail="Developer not found")
    return developer


@router.put("/{developer_id}", response_model=DeveloperResponse)
async def update_developer(developer_id: int, update: DeveloperUpdate, db: Session = Depends(get_db)):
    """Update a developer"""
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
async def delete_developer(developer_id: int, db: Session = Depends(get_db)):
    """Delete a developer"""
    developer = db.query(Developer).filter(Developer.id == developer_id).first()
    if not developer:
        raise HTTPException(status_code=404, detail="Developer not found")
    
    db.delete(developer)
    db.commit()
    return {"status": "deleted", "id": developer_id}
