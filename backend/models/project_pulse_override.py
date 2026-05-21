"""ProjectPulseOverride model - editorial Pulse-view overrides per project.

Stores the JSON blob of fields that are NOT derivable from work_items /
time_entries / sprints / milestones / activity_logs — narrative copy,
ledger rows, manual risks, monthly cost categories, billing inputs,
milestone budgets. One row per project (``project_id`` is the primary
key); the frontend treats absence-or-empty as the "first-time" signal
for its one-shot localStorage migration.

The blob is intentionally opaque on the server side: the frontend
``PulseData`` types are the contract and evolve faster than this table
should. See ``backend/routers/pulse.py`` for the GET/PUT endpoints.
"""

import sys
from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer
from sqlalchemy.orm import relationship

sys.path.append("..")
from database import Base


class ProjectPulseOverride(Base):
    __tablename__ = "project_pulse_overrides"

    project_id = Column(
        Integer,
        ForeignKey("projects.id", ondelete="CASCADE"),
        primary_key=True,
    )
    data = Column(JSON, nullable=False, default=dict)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
    updated_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))

    project = relationship("Project")
    updated_by = relationship("User")

    def to_dict(self):
        return {
            "data": self.data or {},
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "updated_by": (
                {
                    "id": self.updated_by.id,
                    "name": self.updated_by.name,
                    "email": self.updated_by.email,
                }
                if self.updated_by
                else None
            ),
        }
