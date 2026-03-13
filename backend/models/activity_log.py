"""ActivityLog model - Track project activity for feed"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Index
from sqlalchemy.orm import relationship
from datetime import datetime

import sys
sys.path.append('..')
from database import Base


class ActivityLog(Base):
    __tablename__ = "activity_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), index=True)
    
    action = Column(String(50), nullable=False)  # created, updated, deleted, completed, assigned, commented, logged_hours
    entity_type = Column(String(50), nullable=False)  # work_item, sprint, goal, milestone, project
    entity_id = Column(Integer, index=True)
    
    title = Column(String(255))  # Human-readable action title
    details = Column(JSON, default=dict)  # Additional context (old_value, new_value, etc.)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Relationships
    project = relationship("Project", back_populates="activity_logs")
    user = relationship("User")
    
    __table_args__ = (
        Index('idx_activity_log_project_date', 'project_id', 'created_at'),
        Index('idx_activity_log_entity', 'entity_type', 'entity_id'),
    )
    
    def to_dict(self):
        return {
            "id": self.id,
            "project_id": self.project_id,
            "user_id": self.user_id,
            "action": self.action,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "title": self.title,
            "details": self.details or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "user_name": self.user.name if self.user else "System",
            "user_email": self.user.email if self.user else None,
        }
