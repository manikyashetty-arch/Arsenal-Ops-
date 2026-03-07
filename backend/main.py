"""
Arsenal Ops - AI-Powered Project Management Platform
FastAPI backend with Jira-like project/work item management + AI generation
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

# Load environment variables
from pathlib import Path
load_dotenv()
load_dotenv(Path(__file__).parent.parent / '.env')

# Import routers
from routers.projects import router as projects_router
from routers.workitems import router as workitems_router
from routers.developers import router as developers_router
from routers.prd_analysis import router as prd_router
from routers.comments import router as comments_router
from routers.admin import router as admin_router

# Create FastAPI app
app = FastAPI(
    title="Arsenal Ops - AI Project Management",
    description="""
    AI-powered project management platform with Jira-like boards.
    
    ## Features
    - **Projects**: Create and manage multiple projects
    - **Kanban Board**: Drag-and-drop work item management
    - **AI Generation**: Auto-generate user stories and tasks
    - **Sprint Management**: Organize work into sprints
    """,
    version="1.0.0"
)

# CORS middleware - MUST be added before other middleware/routes
# Get allowed origins from environment variable (comma-separated)
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
# Add wildcard for development
if os.getenv("ENVIRONMENT", "development") == "development":
    cors_origins.append("*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# Initialize database tables on startup
from database import init_db
init_db()

# Include routers
app.include_router(projects_router)
app.include_router(workitems_router)
app.include_router(developers_router)
app.include_router(prd_router)
app.include_router(comments_router)
app.include_router(admin_router)

@app.get("/")
def root():
    """API root"""
    return {
        "name": "Arsenal Ops",
        "version": "1.0.0",
        "status": "operational",
        "endpoints": {
            "projects": "/api/projects",
            "workitems": "/api/workitems",
            "developers": "/api/developers",
            "prd_analysis": "/api/prd",
            "comments": "/api/comments",
            "admin": "/api/admin",
        },
        "docs": "/docs"
    }

@app.get("/api/health")
def health_check():
    """Health check endpoint"""
    from datetime import datetime
    azure_configured = bool(os.getenv("AZURE_OPENAI_API_KEY") and os.getenv("AZURE_OPENAI_ENDPOINT"))
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "ai_engine": "operational" if azure_configured else "missing_credentials",
            "api": "operational"
        },
        "version": "1.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)