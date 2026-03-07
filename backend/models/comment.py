"""Comment model - Comments and activity on work items with @mentions"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Index
from sqlalchemy.orm import relationship
from datetime import datetime

import sys
sys.path.append('..')
from database import Base


class Comment(Base):
    __tablename__ = "comments"
    
    id = Column(Integer, primary_key=True, index=True)
    work_item_id = Column(Integer, ForeignKey("work_items.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("developers.id", ondelete="SET NULL"), index=True)
    
    # Comment content
    content = Column(Text, nullable=False)
    
    # @mentions - list of developer IDs that were mentioned
    mentions = Column(JSON, default=list)
    
    # Type: comment, blocker, update
    comment_type = Column(String(20), default="comment")  # comment, blocker, status_change
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    work_item = relationship("WorkItem", back_populates="comments")
    author = relationship("Developer", back_populates="comments")
    
    # Indexes
    __table_args__ = (
        Index('idx_comment_workitem', 'work_item_id', 'created_at'),
    )
