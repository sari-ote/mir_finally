from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.events import repository, schemas
from app.core.database import SessionLocal
from app.auth.dependencies import get_current_user  # ✅ הוספת current_user
from app.permissions.utils import check_event_permission
from app.core.config import settings

router = APIRouter(prefix="/events", tags=["Events"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ✅ יצירת אירוע – עם admin_id לפי המשתמש המחובר
@router.post("/", response_model=schemas.EventOut)
def create_event(
    event: schemas.EventCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # רק admin (superadmin) יכול ליצור אירועים
    if not current_user or (current_user.role != "admin" and (not hasattr(current_user, 'email') or current_user.email not in settings.SUPERADMINS)):
        raise HTTPException(status_code=403, detail="רק מנהל מערכת יכול ליצור אירועים")
    return repository.create_event(db, event, admin_id=current_user.id, user_id=current_user.id)

# ✅ שליפת כל האירועים של המשתמש המחובר
@router.get("/", response_model=list[schemas.EventOut])
def get_my_events(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # Check if user is admin or superadmin
        user_role = getattr(current_user, 'role', None)
        user_id = getattr(current_user, 'id', None)
        user_email = getattr(current_user, 'email', None)
        
        is_admin = user_role == 'admin'
        is_superadmin = user_email and user_email in settings.SUPERADMINS
        is_virtual_user = user_id == 0
        
        # Debug logging
        print(f"DEBUG: get_my_events - user role: {user_role}, id: {user_id}, email: {user_email}")
        print(f"DEBUG: is_admin: {is_admin}, is_superadmin: {is_superadmin}, is_virtual_user: {is_virtual_user}")
        
        # If user is admin, superadmin, or virtual user (id=0), return all events
        if is_admin or is_superadmin or is_virtual_user:
            events = repository.get_all_events(db)
            print(f"DEBUG: Found {len(events)} events in database")
            
            # Return events directly - FastAPI will serialize them using response_model
            print(f"DEBUG: Returning {len(events)} events directly from database")
            return events
        elif user_role == 'viewer':
            from app.permissions.models import UserEventPermission
            from app.events import models
            event_ids = [p.event_id for p in db.query(UserEventPermission).filter_by(user_id=user_id).all()]
            if not event_ids:
                return []
            return db.query(models.Event).filter(models.Event.id.in_(event_ids)).all()
        else:
            # For event_manager, return events by admin_id
            events = repository.get_events_by_admin(db, user_id)
            print(f"DEBUG: Returning {len(events)} events for admin_id={user_id}")
            return events
    except Exception as e:
        print(f"DEBUG: Error in get_my_events: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"שגיאה בטעינת אירועים: {str(e)}")

# ✅ שליפת אירוע לפי מזהה
@router.get("/{event_id}", response_model=schemas.EventOut)
def get_event(event_id: int, db: Session = Depends(get_db)):
    event = repository.get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event

# ✅ עדכון אירוע
@router.put("/{event_id}", response_model=schemas.EventOut)
def update_event(event_id: int, updated_event: schemas.EventUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    check_event_permission(db, current_user, event_id, required_roles=("event_admin",))
    event = repository.update_event(db, event_id, updated_event, user_id=current_user.id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event

# ✅ מחיקת אירוע
@router.delete("/{event_id}")
def delete_event(event_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    check_event_permission(db, current_user, event_id, required_roles=("event_admin",))
    event = repository.delete_event(db, event_id, user_id=current_user.id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"message": "Event deleted"}
