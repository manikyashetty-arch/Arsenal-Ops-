"""TimeEntry model - Track individual time log entries"""

import sys
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship

sys.path.append("..")
from database import Base


class TimeEntry(Base):
    __tablename__ = "time_entries"

    id = Column(Integer, primary_key=True, index=True)
    work_item_id = Column(
        Integer, ForeignKey("work_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    developer_id = Column(Integer, ForeignKey("developers.id", ondelete="SET NULL"), index=True)

    # Time tracking
    hours = Column(Integer, nullable=False)  # Hours logged in this entry
    description = Column(Text)  # Optional description of work done

    # Timestamp
    logged_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # ── QuickBooks sync state ────────────────────────────────────────────
    # Once successfully pushed to QB, holds the returned TimeActivity Id.
    # Indexed because the sync worker filters on `IS NULL`; presence of
    # this column on a row also blocks re-syncing (idempotency).
    workforce_entry_id = Column(String(64), nullable=True, index=True)

    # Relationships
    work_item = relationship("WorkItem", back_populates="time_entries")
    developer = relationship("Developer")

    # Indexes for queries
    __table_args__ = (
        Index("idx_time_entry_work_item_date", "work_item_id", "logged_at"),
        Index("idx_time_entry_developer_date", "developer_id", "logged_at"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "work_item_id": self.work_item_id,
            "developer_id": self.developer_id,
            "hours": self.hours,
            "description": self.description,
            "logged_at": self.logged_at.isoformat() if self.logged_at else None,
            "workforce_entry_id": self.workforce_entry_id,
        }
