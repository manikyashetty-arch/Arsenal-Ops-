"""
ProjectFile Model - Represents uploaded files for projects
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class ProjectFile(Base):
    __tablename__ = "project_files"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    file_name = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)  # Size in bytes
    file_type = Column(String, nullable=False)  # MIME type
    file_url = Column(String, nullable=False)  # URL or path to download
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)  # User ID who uploaded
    uploaded_by_name = Column(String, nullable=False)  # Email/name of uploader
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Relationships
    project = relationship("Project", foreign_keys=[project_id])
    uploader = relationship("User", foreign_keys=[uploaded_by])
    
    def __repr__(self):
        return f"<ProjectFile {self.file_name} (project_id={self.project_id})>"
