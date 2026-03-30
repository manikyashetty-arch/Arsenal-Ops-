"""PersonalTask model - User-specific tasks that can be converted to project tickets"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime

import sys
sys.path.append('..')
from database import Base


class PersonalTask(Base):
    __tablename__ = "personal_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Task details
    title = Column(String(255), nullable=False)
    description = Column(Text)
    status = Column(String(50), default="todo")  # todo, in_progress, done
    priority = Column(String(50), default="medium")  # low, medium, high, critical
    
    # Optional project association (when converted to project ticket)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    work_item_id = Column(Integer, ForeignKey("work_items.id", ondelete="SET NULL"), nullable=True)
    
    # Time tracking
    estimated_hours = Column(Integer, default=0)
    due_date = Column(DateTime, nullable=True)
    
    # Metadata
    tags = Column(JSON, default=list)
    is_converted = Column(Boolean, default=False)
    converted_at = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="personal_tasks")
    project = relationship("Project")
    work_item = relationship("WorkItem")
    
    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title,
            "description": self.description,
            "status": self.status,
            "priority": self.priority,
            "project_id": self.project_id,
            "work_item_id": self.work_item_id,
            "estimated_hours": self.estimated_hours,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "tags": self.tags or [],
            "is_converted": self.is_converted,
            "converted_at": self.converted_at.isoformat() if self.converted_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
