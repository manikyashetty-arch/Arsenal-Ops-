"""Sprint model - Agile sprint management"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

import sys
sys.path.append('..')
from database import Base


class SprintStatus(str, enum.Enum):
    PLANNING = "planning"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Sprint(Base):
    __tablename__ = "sprints"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Sprint details
    name = Column(String(100), nullable=False)
    goal = Column(Text)
    status = Column(String(50), default=SprintStatus.PLANNING.value, nullable=False, index=True)
    
    # Dates
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    
    # Capacity planning
    capacity_hours = Column(Integer)  # Total team capacity
    velocity = Column(Integer)  # Points completed in previous sprints
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    activated_at = Column(DateTime)
    completed_at = Column(DateTime)
    
    # Relationships
    project = relationship("Project", back_populates="sprints")
    work_items = relationship("WorkItem", back_populates="sprint", cascade="all, delete-orphan")
    
    # Indexes for common queries
    __table_args__ = (
        Index('idx_sprint_project_status', 'project_id', 'status'),
        Index('idx_sprint_dates', 'start_date', 'end_date'),
    )
