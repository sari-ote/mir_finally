from sqlalchemy import desc
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
        signer_name=greeting.signer_name
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