from sqlalchemy.orm import Session
from app.users import models, schemas
from passlib.context import CryptContext
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from app.audit_log.repository import log_change

# Use CryptContext with pbkdf2_sha256 instead of bcrypt to avoid 72-byte limit
# pbkdf2_sha256 doesn't have the 72-byte limitation
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

def create_user(db: Session, user: schemas.UserCreate, user_id: int = None):
    # Only check for existing user by id_number if id_number is provided
    if user.id_number:
        existing_user = db.query(models.User).filter(models.User.id_number == user.id_number).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="User with this ID number already exists")
    try:
        # Hash the password using CryptContext with pbkdf2_sha256 (no 72-byte limit)
        hashed_password = pwd_context.hash(user.password)
        
        db_user = models.User(
            username=user.username,
            email=user.email,
            password_hash=hashed_password,
            role=user.role,
            id_number=user.id_number,
            full_name=user.full_name,
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="שגיאה ביצירת משתמש - ייתכן שהשם משתמש או האימייל כבר קיימים")
    except ValueError as e:
        db.rollback()
        error_msg = str(e)
        # Check if it's the bcrypt 72-byte error
        if "cannot be longer than 72 bytes" in error_msg or "72 bytes" in error_msg.lower():
            raise HTTPException(status_code=400, detail="הסיסמה ארוכה מדי. אנא השתמש בסיסמה קצרה יותר (מקסימום 72 תווים)")
        # Re-raise other ValueError exceptions (like from validator)
        raise HTTPException(status_code=400, detail=error_msg)
    except Exception as e:
        db.rollback()
        error_msg = str(e)
        # Check if it's the bcrypt 72-byte error
        if "cannot be longer than 72 bytes" in error_msg or "72 bytes" in error_msg.lower():
            raise HTTPException(status_code=400, detail="הסיסמה ארוכה מדי. אנא השתמש בסיסמה קצרה יותר (מקסימום 72 תווים)")
        raise HTTPException(status_code=400, detail=f"שגיאה ביצירת משתמש: {error_msg}")
    
    # Log the user creation
    log_change(
        db=db,
        user_id=user_id,
        entity_type="User",
        entity_id=db_user.id,
        action="create",
        field="user",
        old_value="",
        new_value=f"{db_user.full_name} ({db_user.username}) - {db_user.role}"
    )
    
    return db_user


def get_user_by_id(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def get_all_users(db: Session):
    return db.query(models.User).all()

def delete_user(db: Session, user_id: int, current_user_id: int = None):
    from app.permissions.models import UserEventPermission
    # מחק קודם את כל ההרשאות של המשתמש
    db.query(UserEventPermission).filter_by(user_id=user_id).delete()
    db.commit()
    user = get_user_by_id(db, user_id)
    if user:
        # Log the user deletion before deleting
        log_change(
            db=db,
            user_id=current_user_id,
            entity_type="User",
            entity_id=user.id,
            action="delete",
            field="user",
            old_value=f"{user.full_name} ({user.username}) - {user.role}",
            new_value=""
        )
        
        db.delete(user)
        try:
            db.commit()
        except IntegrityError as e:
            db.rollback()
            if "foreign key constraint" in str(e.orig).lower():
                raise Exception("Cannot delete user: user is referenced by events")
            else:
                raise
    return user

def deactivate_user(db: Session, user_id: int):
    user = db.query(models.User).get(user_id)
    if not user:
        return None

    user.is_active = False
    db.commit()
    db.refresh(user)
    return user

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def update_user(db: Session, user_id: int, user_update: schemas.UserUpdate, current_user_id: int = None):
    user = get_user_by_id(db, user_id)
    if not user:
        return None
    
    # Store old values for audit log
    old_values = {
        "username": user.username,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "id_number": user.id_number
    }
    
    # Update fields if provided
    if user_update.username is not None:
        # Check if username is already taken by another user
        existing = get_user_by_username(db, user_update.username)
        if existing and existing.id != user_id:
            raise HTTPException(status_code=400, detail="Username already exists")
        user.username = user_update.username
    
    if user_update.full_name is not None:
        user.full_name = user_update.full_name
    
    if user_update.email is not None:
        # Check if email is already taken by another user
        existing = get_user_by_email(db, user_update.email)
        if existing and existing.id != user_id:
            raise HTTPException(status_code=400, detail="Email already exists")
        user.email = user_update.email
    
    if user_update.role is not None:
        user.role = user_update.role
    
    if user_update.id_number is not None:
        user.id_number = user_update.id_number
    
    if user_update.password is not None and user_update.password.strip() != "":
        # Hash the password using CryptContext with pbkdf2_sha256 (no 72-byte limit)
        user.password_hash = pwd_context.hash(user_update.password)
    
    db.commit()
    db.refresh(user)
    
    # Log changes
    for field, old_value in old_values.items():
        new_value = getattr(user, field, "")
        if str(old_value) != str(new_value):
            log_change(
                db=db,
                user_id=current_user_id,
                entity_type="User",
                entity_id=user.id,
                action="update",
                field=field,
                old_value=str(old_value),
                new_value=str(new_value)
            )
    
    return user
