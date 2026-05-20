"""WorkItemAssignmentHistory model - audit trail of which developer held a work item
between which timestamps. Used to attribute capacity correctly when tickets are
transferred between developers within a week."""

import sys
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer
from sqlalchemy.orm import relationship

sys.path.append("..")
from database import Base


class WorkItemAssignmentHistory(Base):
    __tablename__ = "work_item_assignment_history"

    id = Column(Integer, primary_key=True, index=True)
    work_item_id = Column(
        Integer, ForeignKey("work_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    developer_id = Column(
        Integer, ForeignKey("developers.id", ondelete="SET NULL"), nullable=True, index=True
    )

    assigned_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    unassigned_at = Column(DateTime, nullable=True)

    work_item = relationship("WorkItem")
    developer = relationship("Developer")

    __table_args__ = (
        Index("idx_wiah_work_item_assigned", "work_item_id", "assigned_at"),
        Index("idx_wiah_developer_assigned", "developer_id", "assigned_at"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "work_item_id": self.work_item_id,
            "developer_id": self.developer_id,
            "assigned_at": self.assigned_at.isoformat() if self.assigned_at else None,
            "unassigned_at": self.unassigned_at.isoformat() if self.unassigned_at else None,
        }
