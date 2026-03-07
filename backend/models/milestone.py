"""Milestone model - Timeline tracking"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

import sys
sys.path.append('..')
from database import Base

class Milestone(Base):
    __tablename__ = "milestones"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    
    name = Column(String(255), nullable=False)
    description = Column(Text)
    phase = Column(String(100))  # Discovery, Build, Launch, Scale
    
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    
    status = Column(String(50), default="planned")  # planned, in_progress, completed, delayed
    progress_percent = Column(Integer, default=0)
    
    deliverables = Column(Text)  # JSON-serialized list
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    project = relationship("Project", back_populates="milestones")
