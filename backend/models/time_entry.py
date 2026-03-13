"""TimeEntry model - Track individual time log entries"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime

import sys
sys.path.append('..')
from database import Base


class TimeEntry(Base):
    __tablename__ = "time_entries"
    
    id = Column(Integer, primary_key=True, index=True)
    work_item_id = Column(Integer, ForeignKey("work_items.id", ondelete="CASCADE"), nullable=False, index=True)
    developer_id = Column(Integer, ForeignKey("developers.id", ondelete="SET NULL"), index=True)
    
    # Time tracking
    hours = Column(Integer, nullable=False)  # Hours logged in this entry
    description = Column(Text)  # Optional description of work done
    
    # Timestamp
    logged_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Relationships
    work_item = relationship("WorkItem", back_populates="time_entries")
    developer = relationship("Developer")
    
    # Indexes for queries
    __table_args__ = (
        Index('idx_time_entry_work_item_date', 'work_item_id', 'logged_at'),
        Index('idx_time_entry_developer_date', 'developer_id', 'logged_at'),
    )
    
    def to_dict(self):
        return {
            "id": self.id,
            "work_item_id": self.work_item_id,
            "developer_id": self.developer_id,
            "hours": self.hours,
            "description": self.description,
            "logged_at": self.logged_at.isoformat() if self.logged_at else None,
        }
