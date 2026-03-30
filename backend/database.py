"""
Database configuration and session management
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Use PostgreSQL if DATABASE_URL is set, otherwise fallback to SQLite
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    # Fallback to SQLite for local development
    DATABASE_URL = "sqlite:///./productmind.db"

# Configure connection pooling for Neon
connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}

engine = create_engine(
    DATABASE_URL, 
    connect_args=connect_args,
    pool_pre_ping=True,  # Verify connections before using
    pool_recycle=300,    # Recycle every 5 minutes
    pool_size=5,         # Max 5 connections
    max_overflow=10      # Allow 10 extra if needed
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """Dependency for getting database sessions"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def run_migrations():
    """Run database migrations for schema updates"""
    from sqlalchemy import text
    
    with engine.connect() as conn:
        # Migration: Add logged_hours column to work_items
        try:
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'work_items' AND column_name = 'logged_hours'
            """))
            
            if not result.fetchone():
                print("[MIGRATION] Adding logged_hours column to work_items...")
                conn.execute(text("""
                    ALTER TABLE work_items 
                    ADD COLUMN logged_hours INTEGER DEFAULT 0
                """))
                conn.commit()
                print("[MIGRATION] logged_hours column added successfully!")
        except Exception as e:
            print(f"[MIGRATION ERROR] {e}")
        
        # Migration: Add goal_id column to work_items
        try:
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'work_items' AND column_name = 'goal_id'
            """))
            
            if not result.fetchone():
                print("[MIGRATION] Adding goal_id column to work_items...")
                conn.execute(text("""
                    ALTER TABLE work_items 
                    ADD COLUMN goal_id INTEGER REFERENCES project_goals(id) ON DELETE SET NULL
                """))
                conn.commit()
                print("[MIGRATION] goal_id column added successfully!")
        except Exception as e:
            print(f"[MIGRATION ERROR] {e}")
        
        # Migration: Add start_date column to work_items
        try:
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'work_items' AND column_name = 'start_date'
            """))
            
            if not result.fetchone():
                print("[MIGRATION] Adding start_date column to work_items...")
                conn.execute(text("""
                    ALTER TABLE work_items 
                    ADD COLUMN start_date TIMESTAMP
                """))
                conn.commit()
                print("[MIGRATION] start_date column added successfully!")
        except Exception as e:
            print(f"[MIGRATION ERROR] {e}")
        
        # Migration: Create task_dependencies table if not exists
        try:
            result = conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_name = 'task_dependencies'
            """))
            
            if not result.fetchone():
                print("[MIGRATION] Creating task_dependencies table...")
                conn.execute(text("""
                    CREATE TABLE task_dependencies (
                        id SERIAL PRIMARY KEY,
                        work_item_id INTEGER REFERENCES work_items(id) ON DELETE CASCADE,
                        depends_on_id INTEGER REFERENCES work_items(id) ON DELETE CASCADE,
                        dependency_type VARCHAR(20) DEFAULT 'blocks',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                conn.commit()
                print("[MIGRATION] task_dependencies table created!")
        except Exception as e:
            print(f"[MIGRATION ERROR] {e}")
        
        # Migration: Create project_goals table if not exists
        try:
            result = conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_name = 'project_goals'
            """))
            
            if not result.fetchone():
                print("[MIGRATION] Creating project_goals table...")
                conn.execute(text("""
                    CREATE TABLE project_goals (
                        id SERIAL PRIMARY KEY,
                        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
                        title VARCHAR(255) NOT NULL,
                        description TEXT,
                        status VARCHAR(20) DEFAULT 'active',
                        progress INTEGER DEFAULT 0,
                        due_date TIMESTAMP,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                conn.commit()
                print("[MIGRATION] project_goals table created!")
        except Exception as e:
            print(f"[MIGRATION ERROR] {e}")
        
        # Migration: Create project_milestones table if not exists
        try:
            result = conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_name = 'project_milestones'
            """))
            
            if not result.fetchone():
                print("[MIGRATION] Creating project_milestones table...")
                conn.execute(text("""
                    CREATE TABLE project_milestones (
                        id SERIAL PRIMARY KEY,
                        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
                        title VARCHAR(255) NOT NULL,
                        description VARCHAR(500),
                        due_date TIMESTAMP,
                        completed_at TIMESTAMP,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                conn.commit()
                print("[MIGRATION] project_milestones table created!")
        except Exception as e:
            print(f"[MIGRATION ERROR] {e}")
        
        # Migration: Create activity_logs table if not exists
        try:
            result = conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_name = 'activity_logs'
            """))
            
            if not result.fetchone():
                print("[MIGRATION] Creating activity_logs table...")
                conn.execute(text("""
                    CREATE TABLE activity_logs (
                        id SERIAL PRIMARY KEY,
                        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
                        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                        action VARCHAR(50) NOT NULL,
                        entity_type VARCHAR(50),
                        entity_id INTEGER,
                        title VARCHAR(255),
                        description TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                conn.commit()
                print("[MIGRATION] activity_logs table created!")
        except Exception as e:
            print(f"[MIGRATION ERROR] {e}")
        
        # Migration: Create time_entries table if not exists
        try:
            result = conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_name = 'time_entries'
            """))
            
            if not result.fetchone():
                print("[MIGRATION] Creating time_entries table...")
                conn.execute(text("""
                    CREATE TABLE time_entries (
                        id SERIAL PRIMARY KEY,
                        work_item_id INTEGER REFERENCES work_items(id) ON DELETE CASCADE NOT NULL,
                        developer_id INTEGER REFERENCES developers(id) ON DELETE SET NULL,
                        hours INTEGER NOT NULL,
                        description TEXT,
                        logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                conn.execute(text("CREATE INDEX idx_time_entry_work_item ON time_entries(work_item_id)"))
                conn.execute(text("CREATE INDEX idx_time_entry_developer ON time_entries(developer_id)"))
                conn.commit()
                print("[MIGRATION] time_entries table created!")
        except Exception as e:
            print(f"[MIGRATION ERROR] {e}")
        
        # Migration: Add key_prefix column to projects
        try:
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'projects' AND column_name = 'key_prefix'
            """))
            
            if not result.fetchone():
                print("[MIGRATION] Adding key_prefix column to projects...")
                conn.execute(text("""
                    ALTER TABLE projects 
                    ADD COLUMN key_prefix VARCHAR(10) DEFAULT 'PROJ'
                """))
                conn.commit()
                print("[MIGRATION] key_prefix column added successfully!")
        except Exception as e:
            print(f"[MIGRATION ERROR] {e}")
        
        # Migration: Add is_resolved column to comments
        try:
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'comments' AND column_name = 'is_resolved'
            """))
            
            if not result.fetchone():
                print("[MIGRATION] Adding is_resolved column to comments...")
                conn.execute(text("""
                    ALTER TABLE comments 
                    ADD COLUMN is_resolved BOOLEAN DEFAULT FALSE
                """))
                conn.commit()
                print("[MIGRATION] is_resolved column added successfully!")
        except Exception as e:
            print(f"[MIGRATION ERROR] {e}")
        
        # Migration: Create project_files table if not exists
        try:
            result = conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_name = 'project_files'
            """))
            
            if not result.fetchone():
                print("[MIGRATION] Creating project_files table...")
                conn.execute(text("""
                    CREATE TABLE project_files (
                        id SERIAL PRIMARY KEY,
                        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
                        file_name VARCHAR(255) NOT NULL,
                        file_size INTEGER NOT NULL,
                        file_type VARCHAR(100) NOT NULL,
                        file_url VARCHAR(500) NOT NULL,
                        uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                        uploaded_by_name VARCHAR(255) NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT fk_project_files_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
                    )
                """))
                conn.execute(text("CREATE INDEX idx_project_files_project ON project_files(project_id)"))
                conn.execute(text("CREATE INDEX idx_project_files_created ON project_files(created_at)"))
                conn.commit()
                print("[MIGRATION] project_files table created!")
        except Exception as e:
            print(f"[MIGRATION ERROR] {e}")
        
        # Migration: Create personal_tasks table if not exists
        try:
            result = conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_name = 'personal_tasks'
            """))
            
            if not result.fetchone():
                print("[MIGRATION] Creating personal_tasks table...")
                conn.execute(text("""
                    CREATE TABLE personal_tasks (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
                        title VARCHAR(255) NOT NULL,
                        description TEXT,
                        status VARCHAR(50) DEFAULT 'todo',
                        priority VARCHAR(50) DEFAULT 'medium',
                        project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
                        work_item_id INTEGER REFERENCES work_items(id) ON DELETE SET NULL,
                        estimated_hours INTEGER DEFAULT 0,
                        due_date TIMESTAMP,
                        tags JSON DEFAULT '[]',
                        is_converted BOOLEAN DEFAULT FALSE,
                        converted_at TIMESTAMP,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                conn.execute(text("CREATE INDEX idx_personal_tasks_user ON personal_tasks(user_id)"))
                conn.execute(text("CREATE INDEX idx_personal_tasks_status ON personal_tasks(status)"))
                conn.execute(text("CREATE INDEX idx_personal_tasks_project ON personal_tasks(project_id)"))
                conn.commit()
                print("[MIGRATION] personal_tasks table created!")
        except Exception as e:
            print(f"[MIGRATION ERROR] {e}")

        # Migration: Create project_links table if not exists
        try:
            result = conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_name = 'project_links'
            """))
            
            if not result.fetchone():
                print("[MIGRATION] Creating project_links table...")
                conn.execute(text("""
                    CREATE TABLE project_links (
                        id SERIAL PRIMARY KEY,
                        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
                        name VARCHAR(255) NOT NULL,
                        url VARCHAR(500) NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT fk_project_links_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
                    )
                """))
                conn.execute(text("CREATE INDEX idx_project_links_project ON project_links(project_id)"))
                conn.execute(text("CREATE INDEX idx_project_links_created ON project_links(created_at)"))
                conn.commit()
                print("[MIGRATION] project_links table created!")
        except Exception as e:
            print(f"[MIGRATION ERROR] {e}")

        # Migration: Increase role column size in users table
        try:
            result = conn.execute(text("""
                SELECT column_name, character_maximum_length
                FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'role'
            """))
            
            row = result.fetchone()
            if row and row[1] and row[1] < 255:
                print("[MIGRATION] Increasing role column size in users table...")
                conn.execute(text("""
                    ALTER TABLE users 
                    ALTER COLUMN role TYPE VARCHAR(255)
                """))
                conn.commit()
                print("[MIGRATION] role column size increased successfully!")
        except Exception as e:
            print(f"[MIGRATION ERROR] {e}")

        # Migration: Create custom_restrictions table if not exists
        try:
            result = conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_name = 'custom_restrictions'
            """))
            
            if not result.fetchone():
                print("[MIGRATION] Creating custom_restrictions table...")
                conn.execute(text("""
                    CREATE TABLE custom_restrictions (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(255) NOT NULL UNIQUE,
                        tab_name VARCHAR(100) NOT NULL,
                        subsection VARCHAR(100) NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT fk_custom_restrictions_name UNIQUE (name)
                    )
                """))
                conn.execute(text("CREATE INDEX idx_custom_restrictions_name ON custom_restrictions(name)"))
                conn.execute(text("CREATE INDEX idx_custom_restrictions_created ON custom_restrictions(created_at)"))
                conn.commit()
                print("[MIGRATION] custom_restrictions table created!")
        except Exception as e:
            print(f"[MIGRATION ERROR] {e}")

        # Migration: Create user_custom_restrictions junction table if not exists
        try:
            result = conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_name = 'user_custom_restrictions'
            """))
            
            if not result.fetchone():
                print("[MIGRATION] Creating user_custom_restrictions table...")
                conn.execute(text("""
                    CREATE TABLE user_custom_restrictions (
                        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                        custom_restriction_id INTEGER REFERENCES custom_restrictions(id) ON DELETE CASCADE,
                        PRIMARY KEY (user_id, custom_restriction_id)
                    )
                """))
                conn.execute(text("CREATE INDEX idx_user_custom_restrictions_user ON user_custom_restrictions(user_id)"))
                conn.execute(text("CREATE INDEX idx_user_custom_restrictions_restriction ON user_custom_restrictions(custom_restriction_id)"))
                conn.commit()
                print("[MIGRATION] user_custom_restrictions table created!")
        except Exception as e:
            print(f"[MIGRATION ERROR] {e}")

def init_db():
    """Initialize database tables"""
    from models import (
        project, task, persona, user_story, 
        market_insight, developer, work_item, sprint,
        architecture, user, time_entry, task_dependency,
        project_goal, project_milestone, activity_log, project_file,
        custom_restriction, personal_task
    )
    Base.metadata.create_all(bind=engine)
    
    # Run migrations for existing databases
    run_migrations()
