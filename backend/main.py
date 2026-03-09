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
from routers.auth import router as auth_router

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
cors_origins_env = os.getenv("CORS_ORIGINS", "")
if cors_origins_env:
    cors_origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
else:
    cors_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]

# Always add common production frontend URLs
production_frontends = [
    "https://arsenal-ops.vercel.app",
    "https://arsenal-ops-git-main-manikyashetty-archs-projects.vercel.app"
]
for fe in production_frontends:
    if fe not in cors_origins:
        cors_origins.append(fe)

# Allow wildcard in development
if os.getenv("ENVIRONMENT") != "production":
    cors_origins.append("*")

print(f"DEBUG CORS Origins: {cors_origins}")  # Debug logging

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
try:
    from database import init_db, SessionLocal
    init_db()
    print("DEBUG: Database initialized successfully")
    
    # Create default admin user if none exists
    from models.user import User, UserRole
    from passlib.context import CryptContext
    import secrets
    import string
    
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    db = SessionLocal()
    
    try:
        # Check if admin already exists
        existing_admin = db.query(User).filter(User.role == UserRole.ADMIN.value).first()
        if not existing_admin:
            # Generate secure password (max 72 bytes for bcrypt)
            alphabet = string.ascii_letters + string.digits
            temp_password = ''.join(secrets.choice(alphabet) for _ in range(16))
            
            admin = User(
                email="manikya.shetty@arsenalai.com",
                name="manikya rathna",
                hashed_password=pwd_context.hash(temp_password),
                role=UserRole.ADMIN.value,
                is_active=True,
                is_first_login=True
            )
            db.add(admin)
            db.commit()
            print("=" * 60)
            print("DEFAULT ADMIN CREATED!")
            print("=" * 60)
            print(f"Email: {admin.email}")
            print(f"Temporary Password: {temp_password}")
            print("=" * 60)
    except Exception as e:
        print(f"Admin creation error: {e}")
    finally:
        db.close()
        
except Exception as e:
    print(f"DEBUG: Database initialization error: {e}")
    # Continue anyway - tables might already exist

# Include routers
app.include_router(auth_router)
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