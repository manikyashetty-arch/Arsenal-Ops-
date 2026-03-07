"""Persona model - Buyer personas for GTM"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime

import sys
sys.path.append('..')
from database import Base

class Persona(Base):
    __tablename__ = "personas"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    
    name = Column(String(100), nullable=False)  # e.g., "Enterprise Emma"
    role = Column(String(100))  # e.g., "VP of Product"
    
    # Demographics
    age_range = Column(String(50))
    company_size = Column(String(100))
    industry = Column(String(100))
    
    # Psychographics
    goals = Column(JSON)  # List of goals
    pain_points = Column(JSON)  # List of pain points
    motivations = Column(JSON)  # List of motivations
    
    # Behavior
    decision_criteria = Column(JSON)
    preferred_channels = Column(JSON)
    
    # Summary
    bio = Column(Text)
    quote = Column(Text)  # Representative quote
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    project = relationship("Project", back_populates="personas")
