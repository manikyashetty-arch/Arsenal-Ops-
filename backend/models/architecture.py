"""
Architecture Model - Stores generated architecture designs for projects
"""
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime

import sys
sys.path.append('..')
from database import Base


class Architecture(Base):
    """Architecture design for a project"""
    __tablename__ = "architectures"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Architecture details
    name = Column(String(255), nullable=False)
    description = Column(Text)
    architecture_type = Column(String(50), default="recommended")  # recommended, alternative
    
    # Mermaid diagram
    mermaid_code = Column(Text, nullable=False)
    
    # Analysis results
    cost_analysis = Column(JSON)  # Stores cost breakdown
    tools_recommended = Column(JSON)  # Stores recommended tools
    pros = Column(JSON)  # List of pros
    cons = Column(JSON)  # List of cons
    
    # Metadata
    estimated_cost = Column(String(100))  # e.g., "$200-500/month"
    complexity = Column(String(20))  # low, medium, high
    time_to_implement = Column(String(50))  # e.g., "8-12 weeks"
    
    # Selection status
    is_selected = Column(Boolean, default=False)
    selected_at = Column(DateTime)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    project = relationship("Project", back_populates="architectures")
    
    def to_dict(self):
        return {
            "id": self.id,
            "project_id": self.project_id,
            "name": self.name,
            "description": self.description,
            "architecture_type": self.architecture_type,
            "mermaid_code": self.mermaid_code,
            "cost_analysis": self.cost_analysis,
            "tools_recommended": self.tools_recommended,
            "pros": self.pros,
            "cons": self.cons,
            "estimated_cost": self.estimated_cost,
            "complexity": self.complexity,
            "time_to_implement": self.time_to_implement,
            "is_selected": self.is_selected,
            "selected_at": self.selected_at.isoformat() if self.selected_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class PRDAnalysis(Base):
    """Stores PRD analysis results for a project"""
    __tablename__ = "prd_analyses"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Original PRD content
    filename = Column(String(255))
    prd_content = Column(Text)  # Extracted text from PRD
    additional_context = Column(Text)  # User-provided context
    
    # Analysis results
    summary = Column(Text)
    key_features = Column(JSON)  # List of features
    technical_requirements = Column(JSON)  # List of requirements
    cost_analysis = Column(JSON)  # Cost breakdown object
    recommended_tools = Column(JSON)  # Tools by category
    risks = Column(JSON)  # List of risk objects
    timeline = Column(JSON)  # List of phase objects
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    project = relationship("Project", back_populates="prd_analyses")
    
    def to_dict(self):
        return {
            "id": self.id,
            "project_id": self.project_id,
            "filename": self.filename,
            "summary": self.summary,
            "key_features": self.key_features,
            "technical_requirements": self.technical_requirements,
            "cost_analysis": self.cost_analysis,
            "recommended_tools": self.recommended_tools,
            "risks": self.risks,
            "timeline": self.timeline,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
