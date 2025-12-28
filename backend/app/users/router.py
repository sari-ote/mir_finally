from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.users import schemas, repository, models
from app.core.config import settings
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/users", tags=["Users"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/", response_model=schemas.UserOut)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    # רק admin יכול ליצור משתמשים
    if not current_user or current_user.role != "admin":
        raise HTTPException(status_code=403, detail="רק מנהל מערכת יכול להוסיף משתמשים")
    # מנע יצירת משתמש עם role=admin
    if user.role == "admin":
        raise HTTPException(status_code=400, detail="לא ניתן ליצור משתמש עם הרשאת מנהל מערכת")
    # בדוק אם שם משתמש כבר קיים
    existing_username = repository.get_user_by_username(db, user.username)
    if existing_username:
        raise HTTPException(status_code=400, detail="שם משתמש כבר קיים")
    # בדוק אם אימייל כבר קיים
    existing_email = repository.get_user_by_email(db, user.email)
    if existing_email:
        raise HTTPException(status_code=400, detail="אימייל כבר קיים")
    try:
        return repository.create_user(db, user, user_id=current_user.id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"שגיאה ביצירת משתמש: {str(e)}")

@router.get("/", response_model=list[schemas.UserOut])
def get_all_users(db: Session = Depends(get_db)):
    return repository.get_all_users(db)

@router.get("/{user_id}", response_model=schemas.UserOut)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = repository.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.put("/{user_id}", response_model=schemas.UserOut)
def update_user(user_id: int, user_update: schemas.UserUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    # רק admin יכול לעדכן משתמשים
    if not current_user or current_user.role != "admin":
        raise HTTPException(status_code=403, detail="רק מנהל מערכת יכול לעדכן משתמשים")
    user = repository.update_user(db, user_id, user_update, current_user_id=current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    try:
        user = repository.delete_user(db, user_id, current_user_id=current_user.id)
    except Exception as e:
        if "referenced by events" in str(e):
            raise HTTPException(status_code=400, detail="לא ניתן למחוק משתמש שמקושר לאירועים")
        raise
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted"}

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()
