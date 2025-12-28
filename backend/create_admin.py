# -*- coding: utf-8 -*-
"""
Create initial admin user
Run with: python create_admin.py
"""
from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine, Base
from app.users.models import User
from app.auth.service import get_password_hash
import sys

def create_admin_user():
    """Create initial admin user in the system"""
    
    # Admin details
    admin_data = {
        "username": "admin",
        "full_name": "System Administrator",
        "email": "admin@example.com",
        "password": "admin123",  # Initial password - recommend changing after first login
        "role": "admin",
        "id_number": None
    }
    
    # Create all tables if they don't exist
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Check if admin already exists
        existing_user = db.query(User).filter(
            (User.username == admin_data["username"]) | 
            (User.email == admin_data["email"])
        ).first()
        
        if existing_user:
            print("WARNING: Admin user already exists!")
            print(f"   Username: {existing_user.username}")
            print(f"   Email: {existing_user.email}")
            print(f"   Role: {existing_user.role}")
            return
        
        # Create the user
        hashed_password = get_password_hash(admin_data["password"])
        new_admin = User(
            username=admin_data["username"],
            full_name=admin_data["full_name"],
            email=admin_data["email"],
            password_hash=hashed_password,
            role=admin_data["role"],
            id_number=admin_data["id_number"],
            is_active=True
        )
        
        db.add(new_admin)
        db.commit()
        db.refresh(new_admin)
        
        print("SUCCESS: Admin user created successfully!")
        print("\n" + "="*50)
        print("LOGIN CREDENTIALS:")
        print("="*50)
        print(f"Email:      {admin_data['email']}")
        print(f"Password:   {admin_data['password']}")
        print(f"Username:   {admin_data['username']}")
        print(f"Role:       {admin_data['role']}")
        print("="*50)
        print("\nIMPORTANT: Change the password after first login!")
        print("="*50)
        
    except Exception as e:
        db.rollback()
        print(f"ERROR creating admin user: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    create_admin_user()

