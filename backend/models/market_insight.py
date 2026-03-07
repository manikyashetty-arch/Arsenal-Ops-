"""MarketInsight model - Research & Competitor Analysis"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from datetime import datetime

import sys
sys.path.append('..')
from database import Base

class MarketInsight(Base):
    __tablename__ = "market_insights"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    
    # Market data
    industry = Column(String(100))
    market_size_tam = Column(String(100))  # Total Addressable Market
    market_size_sam = Column(String(100))  # Serviceable Addressable Market
    market_size_som = Column(String(100))  # Serviceable Obtainable Market
    cagr = Column(Float)  # Compound Annual Growth Rate
    
    # Competitor analysis
    competitor_name = Column(String(100))
    competitor_strengths = Column(JSON)
    competitor_weaknesses = Column(JSON)
    market_position = Column(String(100))
    
    # Trends & Insights
    trend = Column(String(255))
    trend_analysis = Column(Text)
    opportunity = Column(Text)
    threat = Column(Text)
    
    # SWOT
    swot = Column(JSON)  # {strengths, weaknesses, opportunities, threats}
    
    insight_type = Column(String(50))  # competitor, trend, opportunity, threat
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    project = relationship("Project", back_populates="market_insights")
