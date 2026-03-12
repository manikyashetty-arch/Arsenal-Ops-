"""
Migration script to add logged_hours column to work_items table
Run this on Render to update the database schema
"""
import os
import sys
sys.path.append('.')

from sqlalchemy import create_engine, text
from database import DATABASE_URL

def migrate():
    print("Connecting to database...")
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        # Check if column exists
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'work_items' AND column_name = 'logged_hours'
        """))
        
        if result.fetchone():
            print("Column 'logged_hours' already exists. Skipping migration.")
            return
        
        print("Adding 'logged_hours' column to work_items table...")
        conn.execute(text("""
            ALTER TABLE work_items 
            ADD COLUMN logged_hours INTEGER DEFAULT 0
        """))
        conn.commit()
        print("Migration completed successfully!")

if __name__ == "__main__":
    migrate()
