from datetime import datetime
from sqlalchemy.orm import Session
from app.guests import models, schemas
from app.guests.utils import decode_prefixed_name, encode_prefixed_name
from app.seatings import models as seating_models
from sqlalchemy.exc import IntegrityError
from app.audit_log.repository import log_change
from secrets import token_urlsafe
from typing import Optional

# Guests
def create_guest(db: Session, guest: schemas.GuestCreate, user_id: int = None):
    db_guest = models.Guest(**guest.dict())
    db.add(db_guest)
    try:
        db.commit()
        db.refresh(db_guest)
        # תיעוד בלוג
        log_change(
            db=db,
            user_id=user_id,
            action="create",
            entity_type="Guest",
            entity_id=db_guest.id,
            field="first_name",
            old_value="",
            new_value=f"מוזמן חדש: {db_guest.first_name} {db_guest.last_name}",
            event_id=guest.event_id
        )
        return db_guest
    except IntegrityError:
        db.rollback()
        return None


def get_guests_by_event(db: Session, event_id: int):
    return db.query(models.Guest).filter(models.Guest.event_id == event_id).all()

def get_guest_by_id(db: Session, guest_id: int):
    return db.query(models.Guest).filter(models.Guest.id == guest_id).first()

# Custom Fields
def create_custom_field(db: Session, field: schemas.CustomFieldCreate):
    db_field = models.GuestCustomField(**field.dict())
    db.add(db_field)
    db.commit()
    db.refresh(db_field)
    return db_field

def get_guests_with_fields(db: Session, event_id: int):
    # שליפת כל האורחים לאירוע
    guests = db.query(models.Guest).filter(models.Guest.event_id == event_id).all()
    # שליפת כל השדות הדינמיים של האירוע
    custom_fields = db.query(models.GuestCustomField).filter(models.GuestCustomField.event_id == event_id).all()

    # רשימה להחזרה
    result = []
    for guest in guests:
        guest_data = {
            "id": guest.id,
            "שם": guest.first_name,
            "שם משפחה": guest.last_name,
            "טלפון": guest.phone,
            "אימייל": guest.email,
            "תעודת זהות": guest.id_number,
            "table_head_id": guest.table_head_id, 
            # תוסיפי פה כל שדה קבוע שתרצי להציג
            "gender": guest.gender,
            "confirmed_arrival": guest.confirmed_arrival,
        }
        # עוברת על כל שדה דינמי ומוסיפה ערך (אם קיים)
        for field in custom_fields:
            value_obj = db.query(models.GuestFieldValue).filter_by(
                guest_id=guest.id,
                custom_field_id=field.id
            ).first()
            guest_data[field.name] = value_obj.value if value_obj else ""
        result.append(guest_data)
    return result

def get_custom_fields(db: Session, event_id: int, form_key: str | None = None):
    query = db.query(models.GuestCustomField).filter(models.GuestCustomField.event_id == event_id)
    fields = query.all()
    if not form_key:
        return fields
    filtered = []
    for field in fields:
        current_key = getattr(field, "form_key", None)
        if current_key is None:
            current_key = decode_prefixed_name(field.name)[0]
        if current_key == form_key:
            filtered.append(field)
    return filtered


def get_form_fields_for_form(db: Session, event_id: int, form_key: str):
    fields = get_custom_fields(db, event_id, form_key)
    normalized = []
    for field in fields:
        fk, order_index, label, required = decode_prefixed_name(field.name)
        normalized.append(
            {
                "id": field.id,
                "label": label,
                "field_type": field.field_type,
                "required": required,
                "order": order_index or 0,
                "options": getattr(field, "options", None),
            }
        )
    normalized.sort(key=lambda item: item["order"])
    return normalized


def get_form_field_id_by_label(db: Session, event_id: int, form_key: Optional[str], label: str) -> Optional[int]:
    """Locate a custom field id by its display label for the given form."""
    normalized_label = label.strip()
    alternatives = {
        normalized_label,
        f"{normalized_label} *",
    }

    query = db.query(models.GuestCustomField).filter(models.GuestCustomField.event_id == event_id)
    if form_key:
        query = query.filter(models.GuestCustomField.form_key == form_key)

    for field in query.all():
        decoded_form_key, _, decoded_label, _ = decode_prefixed_name(field.name)
        possible_labels = {
            field.name.strip(),
            decoded_label.strip() if decoded_label else "",
        }
        if normalized_label in possible_labels or any(option in possible_labels for option in alternatives):
            if not form_key or (decoded_form_key or field.form_key or "") == form_key:
                return field.id

    return None


def create_form_share(
    db: Session,
    event_id: int,
    form_key: str,
    expires_at: datetime | None,
    allow_submissions: bool,
    deactivate_existing: bool,
):
    if deactivate_existing:
        db.query(models.GuestFormShare).filter(
            models.GuestFormShare.event_id == event_id,
            models.GuestFormShare.form_key == form_key,
            models.GuestFormShare.is_active.is_(True),
        ).update({"is_active": False}, synchronize_session=False)

    share = models.GuestFormShare(
        event_id=event_id,
        form_key=form_key,
        token=token_urlsafe(32),
        expires_at=expires_at,
        allow_submissions=allow_submissions,
    )
    db.add(share)
    db.commit()
    db.refresh(share)
    return share


def list_form_shares(db: Session, event_id: int, form_key: str | None = None):
    query = db.query(models.GuestFormShare).filter(models.GuestFormShare.event_id == event_id)
    if form_key:
        query = query.filter(models.GuestFormShare.form_key == form_key)
    return query.order_by(models.GuestFormShare.created_at.desc()).all()


def get_form_share_by_token(db: Session, token: str):
    return db.query(models.GuestFormShare).filter(models.GuestFormShare.token == token).first()


def deactivate_form_share(db: Session, share_id: int, event_id: int):
    share = (
        db.query(models.GuestFormShare)
        .filter(models.GuestFormShare.id == share_id, models.GuestFormShare.event_id == event_id)
        .first()
    )
    if not share:
        return None
    share.is_active = False
    db.commit()
    db.refresh(share)
    return share

# Field Values
def create_field_value(db: Session, value: schemas.FieldValueCreate):
    db_value = models.GuestFieldValue(**value.dict())
    db.add(db_value)
    db.commit()
    db.refresh(db_value)
    return db_value

def get_field_values_for_guest(db: Session, guest_id: int):
    return db.query(models.GuestFieldValue).filter(models.GuestFieldValue.guest_id == guest_id).all()

def update_guest(db: Session, guest_id: int, guest: schemas.GuestUpdate, user_id: int):
    db_guest = db.query(models.Guest).filter(models.Guest.id == guest_id).first()
    if not db_guest:
        return None
    
    # עדכון כל השדות שנשלחו
    for key, value in guest.dict(exclude_unset=True).items():
        if value is not None:  # עדכן רק אם הערך לא None
            old_value = getattr(db_guest, key)
            setattr(db_guest, key, value)
            log_change(
                db=db,
                user_id=user_id,
                action="update",
                entity_type="Guest",
                entity_id=guest_id,
                field=key,
                old_value=str(old_value) if old_value is not None else "",
                new_value=str(value) if value is not None else "",
                event_id=db_guest.event_id
            )
    
    db.commit()
    db.refresh(db_guest)
    return db_guest

def delete_guest(db: Session, guest_id: int, user_id: int = None):
    db_guest = db.query(models.Guest).filter(models.Guest.id == guest_id).first()
    if db_guest:
        # מחיקת רשומות קשורות בטבלת seatings
        seatings = db.query(seating_models.Seating).filter(seating_models.Seating.guest_id == guest_id).all()
        for seating in seatings:
            db.delete(seating)
        
        # תיעוד בלוג לפני המחיקה
        log_change(
            db=db,
            user_id=user_id,
            action="delete",
            entity_type="Guest",
            entity_id=guest_id,
            field="first_name",
            old_value=f"מוזמן נמחק: {db_guest.first_name} {db_guest.last_name}",
            new_value="",
            event_id=db_guest.event_id
        )
        db.delete(db_guest)
        db.commit()
    return db_guest

def update_guests_with_default_gender(db: Session, event_id: int):
    """עדכון מוזמנים קיימים עם מגדר ברירת מחדל"""
    guests = db.query(models.Guest).filter(models.Guest.event_id == event_id).all()
    updated_count = 0
    
    for guest in guests:
        if not guest.gender:
            # נסה לנחש לפי השם
            first_name = guest.first_name.lower()
            if any(name in first_name for name in ['יהודית', 'אילה', 'שרה', 'רחל', 'לאה', 'מרים', 'חנה', 'דבורה', 'רות', 'אסתר']):
                guest.gender = 'female'
            elif any(name in first_name for name in ['יעקב', 'חיים', 'דוד', 'משה', 'אברהם', 'יצחק', 'יוסף', 'בנימין', 'שמעון', 'לוי']):
                guest.gender = 'male'
            else:
                # ברירת מחדל - נקבה (לפי הסטטיסטיקות)
                guest.gender = 'female'
            updated_count += 1
    
    if updated_count > 0:
        db.commit()
        print(f"עודכנו {updated_count} מוזמנים עם מגדר ברירת מחדל")
    
    return updated_count
