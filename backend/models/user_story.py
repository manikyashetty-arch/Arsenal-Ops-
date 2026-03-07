"""UserStory model - Requirements & Development"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime

import sys
sys.path.append('..')
from database import Base

class UserStory(Base):
    __tablename__ = "user_stories"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    
    # Core story format
    title = Column(String(255), nullable=False)
    as_a = Column(String(100))  # As a [user type]
    i_want = Column(Text)  # I want [feature]
    so_that = Column(Text)  # So that [benefit]
    
    # Acceptance criteria
    acceptance_criteria = Column(JSON)  # List of criteria
    
    # Estimation
    story_points = Column(Integer, default=1)
    priority = Column(String(20), default="medium")
    
    # Status
    status = Column(String(50), default="backlog")  # backlog, ready, in_sprint, done
    
    # Jira fields
    jira_key = Column(String(50))
    epic = Column(String(100))
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    project = relationship("Project", back_populates="user_stories")
