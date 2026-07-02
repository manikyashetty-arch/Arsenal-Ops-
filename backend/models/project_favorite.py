"""Project favorites - per-user starred projects.

A user↔project many-to-many so each user's favorites are private. Created by
``Base.metadata.create_all`` on startup (no ALTER needed — it's a brand-new
table). Rows are removed by ON DELETE CASCADE when either side is deleted.
"""

import sys
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Table

sys.path.append("..")
from database import Base

# Association table for the User-Project "favorite" many-to-many relationship.
project_favorites = Table(
    "project_favorites",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("project_id", Integer, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
    Column("created_at", DateTime, default=datetime.utcnow),
)
