"""
Create initial admin user
Run this script to create the first admin account
"""
import os
import sys
import secrets
import string
from passlib.context import CryptContext

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import all models first to ensure proper registration
from models import project, task, persona, user_story, market_insight, developer, work_item, sprint, architecture, user
from database import SessionLocal
from models.user import User, UserRole

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_admin_user():
    db = SessionLocal()
    
    try:
        # Check if admin already exists
        existing = db.query(User).filter(User.email == "manikya.shetty@arsenalai.com").first()
        if existing:
            print(f"Admin user already exists: {existing.email}")
            return
        
        # Generate a secure password
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        temp_password = ''.join(secrets.choice(alphabet) for _ in range(12))
        
        # Create admin user
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
        db.refresh(admin)
        
        print("=" * 60)
        print("ADMIN USER CREATED SUCCESSFULLY!")
        print("=" * 60)
        print(f"Email: {admin.email}")
        print(f"Name: {admin.name}")
        print(f"Temporary Password: {temp_password}")
        print("=" * 60)
        print("IMPORTANT: Change this password after first login!")
        print("=" * 60)
        
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_admin_user()
