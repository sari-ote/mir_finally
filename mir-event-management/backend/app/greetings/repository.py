from sqlalchemy import desc, or_
from sqlalchemy.orm import Session, joinedload

from app.events import models as event_models
from app.greetings import models, schemas
from app.guests import models as guest_models

def create_greeting(db: Session, greeting: schemas.GreetingCreate):
    """יצירת ברכה חדשה"""
    db_greeting = models.Greeting(
        guest_id=greeting.guest_id,
        event_id=greeting.event_id,
        content=greeting.content,
        formatted_content=greeting.formatted_content,
        signer_name=greeting.signer_name,
        file_path=greeting.file_path,
        file_name=greeting.file_name,
        phone=greeting.phone
    )
    db.add(db_greeting)
    db.commit()
    db.refresh(db_greeting)
    return db_greeting

def get_greeting(db: Session, greeting_id: int):
    """קבלת ברכה לפי מזהה"""
    return db.query(models.Greeting).filter(models.Greeting.id == greeting_id).first()

def get_greetings_by_event(db: Session, event_id: int):
    """קבלת כל הברכות לאירוע"""
    return db.query(models.Greeting).filter(models.Greeting.event_id == event_id).all()

def get_greetings_by_event_with_guest(db: Session, event_id: int):
    """קבלת כל הברכות לאירוע עם פרטי מוזמן (join)"""
    return (
        db.query(models.Greeting)
        .options(joinedload(models.Greeting.guest))
        .filter(models.Greeting.event_id == event_id)
        .order_by(desc(models.Greeting.created_at))
        .all()
    )

def get_greeting_by_guest(db: Session, guest_id: int):
    """קבלת ברכה של מוזמן"""
    return db.query(models.Greeting).filter(models.Greeting.guest_id == guest_id).first()

def update_greeting(db: Session, greeting_id: int, greeting: schemas.GreetingUpdate):
    """עדכון ברכה"""
    db_greeting = db.query(models.Greeting).filter(models.Greeting.id == greeting_id).first()
    if not db_greeting:
        return None
    
    update_data = greeting.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_greeting, field, value)
    
    db.commit()
    db.refresh(db_greeting)
    return db_greeting

def delete_greeting(db: Session, greeting_id: int):
    """מחיקת ברכה"""
    db_greeting = db.query(models.Greeting).filter(models.Greeting.id == greeting_id).first()
    if not db_greeting:
        return False
    
    db.delete(db_greeting)
    db.commit()
    return True 


def get_previous_greeting_by_id_number(db: Session, *, current_event_id: int, id_number: str):
    """
    מאתר את הברכה האחרונה של מוזמן עם ת"ז נתונה מאירועים קודמים.
    מוחזר האיבר העדכני ביותר לפי תאריך אירוע ולאחר מכן תאריך יצירת הברכה.
    """
    if not id_number:
        return None

    return (
        db.query(models.Greeting)
        .join(guest_models.Guest, models.Greeting.guest_id == guest_models.Guest.id)
        .join(event_models.Event, models.Greeting.event_id == event_models.Event.id)
        .options(
            joinedload(models.Greeting.event),
            joinedload(models.Greeting.guest),
        )
        .filter(guest_models.Guest.id_number == id_number)
        .filter(models.Greeting.event_id != current_event_id)
        .order_by(
            desc(event_models.Event.date),
            desc(models.Greeting.created_at),
        )
        .first()
    )


def get_greeting_by_name_and_phone(db: Session, *, event_id: int, first_name: str, last_name: str, phone: str):
    """
    מאתר ברכה באירוע מסוים לפי שם פרטי, שם משפחה וטלפון.
    מחזיר את הברכה הראשונה שנמצאה אם קיימת.
    """
    if not first_name and not last_name:
        return None
    
    query = (
        db.query(models.Greeting)
        .join(guest_models.Guest, models.Greeting.guest_id == guest_models.Guest.id)
        .options(joinedload(models.Greeting.guest))
        .filter(models.Greeting.event_id == event_id)
    )
    
    # חיפוש לפי שם
    if first_name:
        query = query.filter(guest_models.Guest.first_name.ilike(f"%{first_name.strip()}%"))
    if last_name:
        query = query.filter(guest_models.Guest.last_name.ilike(f"%{last_name.strip()}%"))
    
    # חיפוש לפי טלפון - גם בטלפון של הברכה וגם בטלפון של המוזמן
    if phone:
        phone_clean = phone.strip().replace('-', '').replace(' ', '').replace('(', '').replace(')', '')
        # חיפוש בטלפון של הברכה
        phone_filter = or_(
            models.Greeting.phone.ilike(f"%{phone_clean}%"),
            models.Greeting.phone.ilike(f"%{phone.strip()}%")
        )
        # חיפוש בטלפון של המוזמן
        guest_phone_filter = or_(
            guest_models.Guest.mobile_phone.ilike(f"%{phone_clean}%"),
            guest_models.Guest.mobile_phone.ilike(f"%{phone.strip()}%")
        )
        query = query.filter(or_(phone_filter, guest_phone_filter))
    
    return query.order_by(desc(models.Greeting.created_at)).first()