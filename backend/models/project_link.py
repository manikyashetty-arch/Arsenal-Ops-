"""
ProjectLink Model - Represents links/URLs for projects
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class ProjectLink(Base):
    __tablename__ = "project_links"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    url = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Relationships
    project = relationship("Project", foreign_keys=[project_id])
    
    def __repr__(self):
        return f"<ProjectLink {self.name} (project_id={self.project_id})>"
