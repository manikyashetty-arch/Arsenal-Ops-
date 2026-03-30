"""
CustomRestriction Model - Represents custom restriction roles for users
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

# Association table for many-to-many relationship between users and custom restrictions
user_custom_restrictions = Table(
    'user_custom_restrictions',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
    Column('custom_restriction_id', Integer, ForeignKey('custom_restrictions.id', ondelete='CASCADE'), primary_key=True)
)


class CustomRestriction(Base):
    __tablename__ = "custom_restrictions"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True, index=True)  # e.g., "NoWorkload", "NoAnalytics"
    tab_name = Column(String(100), nullable=False)  # e.g., "overview", "hub", "tracker", "calendar", "business", "goals", "activity", "pm"
    subsection = Column(String(100), nullable=False)  # e.g., "workload", "analytics", "calendar", "timeline", "goals"
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Relationships
    users = relationship(
        "User",
        secondary=user_custom_restrictions,
        back_populates="custom_restrictions"
    )
    
    def __repr__(self):
        return f"<CustomRestriction {self.name} - {self.tab_name}.{self.subsection}>"
