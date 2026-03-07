"""Developer model - Team members and their roles"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from datetime import datetime

import sys
sys.path.append('..')
from database import Base

# Association table for Project-Developer many-to-many relationship
project_developers = Table(
    'project_developers',
    Base.metadata,
    Column('project_id', Integer, ForeignKey('projects.id'), primary_key=True),
    Column('developer_id', Integer, ForeignKey('developers.id'), primary_key=True),
    Column('role', String(100), nullable=False),  # Role in this specific project
    Column('responsibilities', Text),  # What they'll be working on
    Column('assigned_at', DateTime, default=datetime.utcnow)
)


class Developer(Base):
    __tablename__ = "developers"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    github_username = Column(String(100), unique=True)  # GitHub username for invitations
    avatar_url = Column(String(500))
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    projects = relationship(
        "Project",
        secondary=project_developers,
        back_populates="developers"
    )
    assigned_work_items = relationship("WorkItem", foreign_keys="WorkItem.assignee_id", back_populates="assignee")
    reported_work_items = relationship("WorkItem", foreign_keys="WorkItem.reporter_id", back_populates="reporter")
    comments = relationship("Comment", back_populates="author")
