from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.greetings import schemas, service
from app.auth.dependencies import get_current_user
from app.core.email_service import send_greeting_notification_async
from app.guests import models as guest_models
import os
import uuid
from typing import Optional

# Greetings router with toggle-handled support
router = APIRouter(prefix="/greetings", tags=["Greetings"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/", response_model=schemas.GreetingOut)
def create_greeting(greeting: schemas.GreetingCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """יצירת ברכה חדשה"""
    try:
        return service.GreetingService.create_greeting(db, greeting)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/with-file", response_model=schemas.GreetingOut)
async def create_greeting_with_file(
    guest_id: int = Form(...),
    event_id: int = Form(...),
    content: str = Form(...),
    signer_name: str = Form(...),
    formatted_content: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """יצירת ברכה חדשה עם קובץ"""
    try:
        file_path = None
        file_name = None
        
        # שמירת קובץ אם קיים
        if file and file.filename:
            # יצירת תיקייה אם לא קיימת
            upload_dir = f"uploads/blessings/{event_id}"
            os.makedirs(upload_dir, exist_ok=True)
            
            # יצירת שם קובץ ייחודי
            file_ext = os.path.splitext(file.filename)[1]
            unique_filename = f"{uuid.uuid4().hex}{file_ext}"
            file_path = os.path.join(upload_dir, unique_filename)
            file_name = file.filename
            
            # שמירת הקובץ
            with open(file_path, "wb") as buffer:
                content_bytes = await file.read()
                buffer.write(content_bytes)
        
        greeting_data = schemas.GreetingCreate(
            guest_id=guest_id,
            event_id=event_id,
            content=content,
            formatted_content=formatted_content,
            signer_name=signer_name,
            file_path=file_path,
            file_name=file_name,
            phone=phone
        )
        
        result = service.GreetingService.create_or_update_greeting(db, greeting_data)
        
        # שליחת התראה במייל על ברכה חדשה (ברקע)
        try:
            guest = db.query(guest_models.Guest).filter(guest_models.Guest.id == guest_id).first()
            guest_name = f"{guest.first_name or ''} {guest.last_name or ''}".strip() if guest else "אורח"
            send_greeting_notification_async(
                guest_name=guest_name,
                signer_name=signer_name,
                content=content,
                phone=phone,
                file_path=file_path,
                file_name=file_name
            )
        except Exception as email_err:
            print(f"[Email] שגיאה בשליחת התראה: {email_err}")
        
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving file: {str(e)}")

@router.post("/create-or-update", response_model=schemas.GreetingOut)
def create_or_update_greeting(greeting: schemas.GreetingCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """יצירת ברכה חדשה או עדכון ברכה קיימת"""
    try:
        result = service.GreetingService.create_or_update_greeting(db, greeting)
        
        # שליחת התראה במייל על ברכה חדשה (ברקע)
        try:
            guest = db.query(guest_models.Guest).filter(guest_models.Guest.id == greeting.guest_id).first()
            guest_name = f"{guest.first_name or ''} {guest.last_name or ''}".strip() if guest else "אורח"
            send_greeting_notification_async(
                guest_name=guest_name,
                signer_name=greeting.signer_name,
                content=greeting.content,
                phone=greeting.phone,
                file_path=greeting.file_path,
                file_name=greeting.file_name
            )
        except Exception as email_err:
            print(f"[Email] שגיאה בשליחת התראה: {email_err}")
        
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/current/by-name-phone", response_model=schemas.PreviousGreetingOut)
def get_current_greeting_by_name_phone(
    event_id: int, 
    first_name: str = "", 
    last_name: str = "", 
    phone: str = "",
    db: Session = Depends(get_db), 
    current_user = Depends(get_current_user)
):
    """חיפוש ברכה באירוע הנוכחי לפי שם וטלפון"""
    try:
        result = service.GreetingService.get_greeting_by_name_and_phone(
            db, event_id, first_name, last_name, phone
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not result:
        raise HTTPException(status_code=404, detail="Greeting not found in current event")
    return result

@router.get("/previous/by-id", response_model=schemas.PreviousGreetingOut)
def get_previous_greeting(event_id: int, id_number: str, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """קבלת הברכה האחרונה של מוזמן מאירועים קודמים"""
    try:
        result = service.GreetingService.get_previous_greeting_for_event(db, event_id, id_number)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not result:
        raise HTTPException(status_code=404, detail="Previous greeting not found")
    return result

@router.get("/previous", response_model=schemas.PreviousGreetingOut, include_in_schema=False)
def get_previous_greeting_legacy(event_id: int, id_number: str, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """נתיב תאימות שמפנה ל-by-id (מניעת שגיאות 422 קיימות)"""
    return get_previous_greeting(event_id, id_number, db, current_user)

@router.post("/{greeting_id}/toggle-handled", response_model=schemas.GreetingOut)
def toggle_greeting_handled(greeting_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """החלפת סטטוס טופל של ברכה"""
    from app.greetings import models
    greeting = db.query(models.Greeting).filter(models.Greeting.id == greeting_id).first()
    if not greeting:
        raise HTTPException(status_code=404, detail="Greeting not found")
    
    # Toggle the is_handled status
    greeting.is_handled = not (greeting.is_handled or False)
    db.commit()
    db.refresh(greeting)
    return greeting

@router.get("/{greeting_id}", response_model=schemas.GreetingOut)
def get_greeting(greeting_id: int, db: Session = Depends(get_db)):
    """קבלת ברכה לפי מזהה"""
    greeting = service.GreetingService.get_greeting(db, greeting_id)
    if not greeting:
        raise HTTPException(status_code=404, detail="Greeting not found")
    return greeting

@router.get("/event/{event_id}", response_model=list[schemas.GreetingOut])
def get_greetings_by_event(event_id: int, db: Session = Depends(get_db)):
    """קבלת כל הברכות לאירוע"""
    return service.GreetingService.get_greetings_by_event(db, event_id)

@router.get("/event/{event_id}/list", response_model=list[schemas.BlessingListOut])
def get_greetings_by_event_list(event_id: int, db: Session = Depends(get_db)):
    """קבלת כל הברכות לאירוע עם פרטי מוזמן"""
    try:
        greetings = service.GreetingService.get_greetings_by_event_with_guest(db, event_id)
        result = []
        for greeting in greetings:
            guest = greeting.guest
            guest_full_name = None
            if guest:
                guest_full_name = f"{guest.first_name or ''} {guest.last_name or ''}".strip()
            
            result.append(schemas.BlessingListOut(
                id=greeting.id,
                guest_id=greeting.guest_id,
                event_id=greeting.event_id,
                content=greeting.content or "",
                formatted_content=getattr(greeting, 'formatted_content', None),
                signer_name=greeting.signer_name,
                file_path=getattr(greeting, 'file_path', None),
                file_name=getattr(greeting, 'file_name', None),
                phone=getattr(greeting, 'phone', None) or (guest.mobile_phone if guest else None),
                created_at=greeting.created_at,
                is_approved=greeting.is_approved,
                is_handled=getattr(greeting, 'is_handled', False) or False,
                guest_first_name=guest.first_name if guest else None,
                guest_last_name=guest.last_name if guest else None,
                guest_full_name=guest_full_name
            ))
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching blessings: {str(e)}")

@router.get("/guest/{guest_id}", response_model=schemas.GreetingOut)
def get_greeting_by_guest(guest_id: int, db: Session = Depends(get_db)):
    """קבלת ברכה של מוזמן"""
    greeting = service.GreetingService.get_greeting_by_guest(db, guest_id)
    if not greeting:
        raise HTTPException(status_code=404, detail="Greeting not found")
    return greeting

@router.put("/{greeting_id}", response_model=schemas.GreetingOut)
def update_greeting(greeting_id: int, greeting: schemas.GreetingUpdate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """עדכון ברכה"""
    try:
        result = service.GreetingService.update_greeting(db, greeting_id, greeting)
        if not result:
            raise HTTPException(status_code=404, detail="Greeting not found")
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{greeting_id}")
def delete_greeting(greeting_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """מחיקת ברכה"""
    result = service.GreetingService.delete_greeting(db, greeting_id)
    if not result:
        raise HTTPException(status_code=404, detail="Greeting not found")
    return {"message": "Greeting deleted"}

@router.post("/{greeting_id}/approve", response_model=schemas.GreetingOut)
def approve_greeting(greeting_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """אישור ברכה"""
    result = service.GreetingService.approve_greeting(db, greeting_id)
    if not result:
        raise HTTPException(status_code=404, detail="Greeting not found")
    return result

@router.get("/event/{event_id}/approved", response_model=list[schemas.GreetingOut])
def get_approved_greetings_by_event(event_id: int, db: Session = Depends(get_db)):
    """קבלת כל הברכות המאושרות לאירוע"""
    return service.GreetingService.get_approved_greetings_by_event(db, event_id) 