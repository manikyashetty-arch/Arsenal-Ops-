"""TaskDependency model - Link tasks as blocking/blocked by other tasks"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Index
from sqlalchemy.orm import relationship
from datetime import datetime

import sys
sys.path.append('..')
from database import Base


class TaskDependency(Base):
    __tablename__ = "task_dependencies"
    
    id = Column(Integer, primary_key=True, index=True)
    work_item_id = Column(Integer, ForeignKey("work_items.id", ondelete="CASCADE"), nullable=False, index=True)
    depends_on_id = Column(Integer, ForeignKey("work_items.id", ondelete="CASCADE"), nullable=False, index=True)
    dependency_type = Column(String(20), default="blocks", nullable=False)  # blocks, blocked_by
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    work_item = relationship("WorkItem", foreign_keys=[work_item_id], back_populates="dependencies")
    depends_on = relationship("WorkItem", foreign_keys=[depends_on_id], back_populates="blocked_by")
    
    __table_args__ = (
        Index('idx_task_dependency_work_item', 'work_item_id'),
        Index('idx_task_dependency_depends_on', 'depends_on_id'),
    )
    
    def to_dict(self):
        return {
            "id": self.id,
            "work_item_id": self.work_item_id,
            "depends_on_id": self.depends_on_id,
            "dependency_type": self.dependency_type,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
