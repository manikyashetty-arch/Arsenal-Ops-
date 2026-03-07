"""Task model - Kanban-style task cards with dependencies"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime

import sys
sys.path.append('..')
from database import Base

class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    
    # Core fields
    title = Column(String(255), nullable=False)
    description = Column(Text)
    acceptance_criteria = Column(JSON)  # List of criteria
    
    # Status & Priority
    status = Column(String(50), default="todo")  # todo, in_progress, review, done
    priority = Column(String(20), default="medium")  # low, medium, high, critical
    
    # Estimation
    story_points = Column(Integer, default=1)
    estimated_hours = Column(Integer)
    
    # Assignment
    assignee = Column(String(100))
    
    # Dependencies (JSON array of task IDs)
    dependencies = Column(JSON, default=[])
    
    # Jira-style fields
    jira_key = Column(String(50))
    epic = Column(String(100))
    sprint = Column(String(100))
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    due_date = Column(DateTime)
    
    # Relationships
    project = relationship("Project", back_populates="tasks")
