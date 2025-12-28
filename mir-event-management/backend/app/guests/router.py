from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from app.core.database import SessionLocal
from app.guests import schemas, repository, models
from app.guests.utils import decode_prefixed_name, encode_prefixed_name
from app.seatings import models as seating_models
from app.tables import models as table_models
from typing import Optional
from fastapi.responses import StreamingResponse
import pandas as pd
import io
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from app.auth.dependencies import get_current_user
from app.permissions.utils import check_event_permission

router = APIRouter(prefix="/guests", tags=["Guests"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Create guest
@router.post("/", response_model=schemas.GuestOut)
def create_guest(guest: schemas.GuestCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    try:
        result = repository.create_guest(db, guest, user_id=current_user.id)
        if result is None:
            print(f"Failed to create guest - duplicate ID: {guest.id_number} for event {guest.event_id}")
            raise HTTPException(status_code=400, detail="קיים כבר מוזמן עם אותה תעודת זהות באירוע זה")
        return result
    except Exception as e:
        print(f"Error creating guest: {e}")
        print(f"Guest data: {guest.dict()}")
        raise HTTPException(status_code=400, detail=f"Error creating guest: {str(e)}")

@router.put("/{guest_id}", response_model=schemas.GuestOut)
def update_guest(guest_id: int, guest: schemas.GuestUpdate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    result = repository.update_guest(db, guest_id, guest, user_id=current_user.id)
    if result is None:
        raise HTTPException(status_code=404, detail="Guest not found")
    return result

@router.delete("/{guest_id}")
def delete_guest(guest_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    result = repository.delete_guest(db, guest_id, user_id=current_user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Guest not found")
    return {"message": "Guest deleted"}

@router.delete("/custom-field/{field_id}")
def delete_custom_field(field_id: int, db: Session = Depends(get_db)):
    field = db.query(models.GuestCustomField).filter(models.GuestCustomField.id == field_id).first()
    if not field:
        raise HTTPException(status_code=404, detail="Custom field not found")

    db.delete(field)
    db.commit()
    return {"message": "Custom field deleted"}


# Get guests by event
@router.get("/event/{event_id}", response_model=list[schemas.GuestOut])
def get_guests(event_id: int, db: Session = Depends(get_db)):
    return repository.get_guests_by_event(db, event_id)

# Custom field endpoints
@router.post("/custom-field/", response_model=schemas.CustomFieldOut)
def create_custom_field(field: schemas.CustomFieldCreate, db: Session = Depends(get_db)):
    return repository.create_custom_field(db, field)

@router.get("/custom-field/{event_id}", response_model=list[schemas.CustomFieldOut])
def get_custom_fields(event_id: int, db: Session = Depends(get_db)):
    fields = repository.get_custom_fields(db, event_id)
    # פענוח prefix והחזרת שדות בפורמט הנכון
    result = []
    for f in fields:
        fk, oi, label, req = decode_prefixed_name(f.name)
        display_name = f"{label} *" if req else label
        try:
            result.append(schemas.CustomFieldOut(
                id=f.id,
                event_id=f.event_id,
                name=display_name,
                field_type=f.field_type,
                form_key=getattr(f, 'form_key', None) or fk
            ))
        except TypeError:
            result.append(schemas.CustomFieldOut(
                id=f.id,
                event_id=f.event_id,
                name=display_name,
                field_type=f.field_type
            ))
    return result

# Field values endpoints
@router.post("/field-value/", response_model=schemas.FieldValueOut)
def create_field_value(value: schemas.FieldValueCreate, db: Session = Depends(get_db)):
    return repository.create_field_value(db, value)

@router.get("/field-value/{guest_id}", response_model=list[schemas.FieldValueOut])
def get_field_values(guest_id: int, db: Session = Depends(get_db)):
    return repository.get_field_values_for_guest(db, guest_id)

@router.get("/", response_model=list[schemas.GuestOut])
def get_all_guests(db: Session = Depends(get_db)):
    return db.query(models.Guest).all()

@router.post("/events/{event_id}/guests/{guest_id}/field-values")
def add_field_value(event_id: int, guest_id: int, value: schemas.FieldValueInput, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    field = db.query(models.GuestCustomField).filter_by(event_id=event_id, name=value.field_name).first()
    if not field:
        # try with any prefix convention ([form] or [form|o=NNNN])
        field = db.query(models.GuestCustomField).filter(models.GuestCustomField.event_id == event_id, models.GuestCustomField.name.like(f"%] {value.field_name}")).first()
        if not field:
            raise HTTPException(status_code=404, detail="Custom field not found")
    
    # בדיקה אם יש ערך קיים
    existing_value = db.query(models.GuestFieldValue).filter(
        models.GuestFieldValue.guest_id == guest_id,
        models.GuestFieldValue.custom_field_id == field.id
    ).first()
    
    if existing_value:
        # עדכון ערך קיים
        existing_value.value = str(value.value) if value.value is not None else ""
        db.commit()
        db.refresh(existing_value)
        return existing_value
    else:
        # יצירת ערך חדש
        new_value = schemas.FieldValueCreate(
            guest_id=guest_id,
            custom_field_id=field.id,
            value=str(value.value) if value.value is not None else "",
        )
        return repository.create_field_value(db, new_value)


@router.get("/events/{event_id}/guests/by-id-number", response_model=schemas.GuestWithFields)
def get_guest_by_id_number(event_id: int, id_number: str, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    trimmed_id = (id_number or "").strip()
    normalized = "".join(ch for ch in trimmed_id if ch.isdigit())

    if not normalized:
        raise HTTPException(status_code=404, detail="תקלה בשליפת נתוני הלקוח. אנא הירשם למערכת.")

    print(f"[get_guest_by_id_number] event={event_id} id_number={repr(id_number)} normalized={normalized}")

    def _normalize(raw: str | None) -> str:
        if not raw:
            return ""
        return "".join(ch for ch in raw if ch.isdigit())

    guest = (
        db.query(models.Guest)
        .options(joinedload(models.Guest.field_values).joinedload(models.GuestFieldValue.custom_field))
        .filter(models.Guest.event_id == event_id)
        .all()
    )

    guest = next((g for g in guest if _normalize(g.id_number) == normalized), None)

    if guest:
        print(f"[get_guest_by_id_number] found guest id={guest.id}")
    else:
        print("[get_guest_by_id_number] no guest matched normalized id")

    if not guest:
        raise HTTPException(status_code=404, detail="תקלה בשליפת נתוני הלקוח. אנא הירשם למערכת.")

    fields: dict[str, Optional[str]] = {}
    for field_value in guest.field_values:
        custom_field = field_value.custom_field
        if custom_field and custom_field.name:
            label = custom_field.name
            try:
                fk, order_index, decoded_label, required_flag = decode_prefixed_name(label)
                if decoded_label:
                    label = f"{decoded_label} *" if required_flag and not decoded_label.endswith(" *") else decoded_label
            except Exception:
                pass
            fields[label] = field_value.value

    return schemas.GuestWithFields(
        guest=schemas.GuestOut.model_validate(guest),
        fields=fields
    )



@router.get("/filter", response_model=list[schemas.GuestOut])
def filter_guests(
    event_id: Optional[int] = None,
    name: Optional[str] = None,
    phone: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Guest)

    if event_id:
        query = query.filter(models.Guest.event_id == event_id)
    if name:
        query = query.filter(models.Guest.full_name.ilike(f"%{name}%"))
    if phone:
        query = query.filter(models.Guest.phone.ilike(f"%{phone}%"))

    return query.all()




@router.get("/export")
def export_guests_to_excel(
    event_id: Optional[int] = None,
    name: Optional[str] = None,
    gender: Optional[str] = None,
    confirmed_only: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Guest)
    
    # פילטרים
    if event_id:
        query = query.filter(models.Guest.event_id == event_id)
    if name:
        query = query.filter(models.Guest.first_name.ilike(f"%{name}%"))
    if gender:
        query = query.filter(models.Guest.gender == gender)
    if confirmed_only is not None:
        query = query.filter(models.Guest.confirmed_arrival == confirmed_only)

    guests = query.all()

    data = [
        {
            "שם פרטי": g.first_name,
            "שם משפחה": g.last_name,
            "טלפון": g.phone or "",
            "מייל": g.email or "",
            "תעודת זהות": g.id_number or "",
            "מין": g.gender,
            "אישור הגעה": "כן" if g.confirmed_arrival else "לא",
            "אירוע": g.event_id
        }
        for g in guests
    ]

    df = pd.DataFrame(data)
    stream = io.BytesIO()
    df.to_excel(stream, index=False, engine="openpyxl")
    stream.seek(0)

    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=guests.xlsx"}
    )

@router.get("/export-pdf")
def export_guests_to_pdf(
    event_id: Optional[int] = None,
    name: Optional[str] = None,
    gender: Optional[str] = None,
    confirmed_only: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Guest)
    
    # פילטרים
    if event_id:
        query = query.filter(models.Guest.event_id == event_id)
    if name:
        query = query.filter(models.Guest.first_name.ilike(f"%{name}%"))
    if gender:
        query = query.filter(models.Guest.gender == gender)
    if confirmed_only is not None:
        query = query.filter(models.Guest.confirmed_arrival == confirmed_only)

    guests = query.all()

    # יצירת PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    elements = []

    # כותרת
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=16,
        spaceAfter=30,
        alignment=1  # מרכז
    )
    
    title_text = f"Guest Report - Event {event_id}" if event_id else "Guest Report"
    title = Paragraph(title_text, title_style)
    elements.append(title)

    # נתונים לטבלה
    table_data = [["First Name", "Last Name", "Phone", "Email", "Gender", "Confirmed"]]
    
    for guest in guests:
        table_data.append([
            guest.first_name or "",
            guest.last_name or "",
            guest.phone or "",
            guest.email or "",
            guest.gender or "",
            "Yes" if guest.confirmed_arrival else "No"
        ])

    # יצירת טבלה
    table = Table(table_data)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), '#4f8cff'),
        ('TEXTCOLOR', (0, 0), (-1, 0), 'white'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), '#f8f9fa'),
        ('GRID', (0, 0), (-1, -1), 1, '#ddd'),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))

    elements.append(table)

    # בניית PDF
    doc.build(elements)
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=guests-{event_id or 'all'}.pdf"}
    )

@router.get("/export-seating-image")
def export_seating_image(
    event_id: int,
    gender: Optional[str] = None,
    show_empty_seats: Optional[bool] = True,
    show_occupied_seats: Optional[bool] = True,
    only_empty_tables: Optional[bool] = False,
    only_available_tables: Optional[bool] = False,
    db: Session = Depends(get_db)
):
    """
    ייצוא תמונה של מפת הישיבה עם פילטרים
    """
    # קביעת סוג אולם לפי מגדר (אם נשלח): גברים -> 'm', נשים -> 'w'
    hall_type_filter = None
    if gender:
        try:
            g = gender.lower()
            if g == 'male':
                hall_type_filter = 'm'
            elif g == 'female':
                hall_type_filter = 'w'
        except Exception:
            hall_type_filter = None

    # שליפת שולחנות לאירוע (ולפי סוג אולם אם צוין)
    tables_query = db.query(table_models.Table).filter(table_models.Table.event_id == event_id)
    if hall_type_filter:
        tables_query = tables_query.filter(table_models.Table.hall_type == hall_type_filter)
    tables = tables_query.all()
    
    # שליפת מוזמנים לאירוע
    guests_query = db.query(models.Guest).filter(models.Guest.event_id == event_id)
    if gender:
        guests_query = guests_query.filter(models.Guest.gender == gender)
    guests = guests_query.all()
    
    # שליפת מקומות ישיבה - מוגבלים לשולחנות שנבחרו
    table_ids = [t.id for t in tables]
    seatings = []
    if table_ids:
        seatings = db.query(seating_models.Seating).filter(
            seating_models.Seating.event_id == event_id,
            seating_models.Seating.table_id.in_(table_ids)
        ).all()
    
    # Debug info
    print(f"Found {len(tables)} tables for event {event_id}")
    print(f"Found {len(guests)} guests for event {event_id}")
    print(f"Found {len(seatings)} seatings for event {event_id}")
    
    # בדיקה אם יש מוזמנים
    if len(guests) == 0:
        # אם אין מוזמנים, נציג הודעה
        img_width = 800
        img_height = 400
        img = Image.new('RGB', (img_width, img_height), color='white')
        draw = ImageDraw.Draw(img)
        
        draw.text((img_width//2, img_height//2), f"No guests found for event {event_id}", 
                 fill='red', anchor='mm')
        
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        
        return StreamingResponse(
            buffer,
            media_type="image/png",
            headers={"Content-Disposition": f"attachment; filename=seating-map-{event_id}.png"}
        )
    
    # יצירת תמונה
    from PIL import Image, ImageDraw, ImageFont
    import os
    
    # גודל התמונה
    img_width = 1800
    img_height = 1200
    img = Image.new('RGB', (img_width, img_height), color='white')
    draw = ImageDraw.Draw(img)
    
    # ניסיון לטעון פונט גדול יותר
    try:
        # ניסיון לטעון פונט מערכת
        font = ImageFont.truetype("arial.ttf", 16)
        title_font = ImageFont.truetype("arial.ttf", 20)
    except:
        # אם לא מצליח, נשתמש בפונט ברירת מחדל
        font = ImageFont.load_default()
        title_font = ImageFont.load_default()
    
    # כותרת
    title = f"Seating Map - Event {event_id}"
    if gender:
        title += f" ({gender})"
    draw.text((img_width//2, 50), title, fill='black', anchor='mm', font=title_font)
    
    # קנה מידה לפי x,y אם קיימים
    margin_x = 120
    margin_y = 160
    default_table_size = 110
    has_positions = any(t.x is not None and t.y is not None for t in tables)

    if has_positions:
        xs = [t.x for t in tables if t.x is not None]
        ys = [t.y for t in tables if t.y is not None]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        span_x = max(1.0, max_x - min_x)
        span_y = max(1.0, max_y - min_y)
        scale_x = (img_width - 2 * margin_x) / span_x
        scale_y = (img_height - 2 * margin_y) / span_y
        scale = min(scale_x, scale_y)
    
    for i, table in enumerate(tables):
        # מיקום
        if has_positions and table.x is not None and table.y is not None:
            x = margin_x + (table.x - min_x) * scale
            y = margin_y + (table.y - min_y) * scale
        else:
            # פריסה רשתית אם אין קואורדינטות
            row = i // 6
            col = i % 6
            x = margin_x + col * (default_table_size + 140)
            y = margin_y + row * (default_table_size + 120)

        size = default_table_size
        # חישוב תפוסה לפני ציור כדי שנוכל לפלטר שולחנות
        table_seatings = [s for s in seatings if s.table_id == table.id]
        occupied = 0
        for seating in table_seatings:
            guest = db.query(models.Guest).filter(models.Guest.id == seating.guest_id).first()
            if guest and (gender is None or guest.gender == gender):
                occupied += 1
        capacity = getattr(table, 'size', len(table_seatings) or 0)
        empty = max(0, capacity - occupied)

        # סינון: רק שולחנות ריקים (אפס תפוסים)
        if only_empty_tables and occupied > 0:
            continue
        # סינון: רק שולחנות עם מקומות פנויים (לא מלאים)
        if only_available_tables and empty == 0:
            continue

        # ציור שולחן לפי צורה (אחרי הסינון)
        if getattr(table, 'shape', 'circular') == 'rectangular':
            w = size * 1.4
            h = size * 0.8
            draw.rectangle([x - w/2, y - h/2, x + w/2, y + h/2], outline='blue', width=3)
  
        else:
            draw.ellipse([x - size/2, y - size/2, x + size/2, y + size/2], outline='blue', width=3)

        # מספר שולחן
        draw.text((x, y), f"Table {table.table_number}", fill='blue', anchor='mm')

        # טקסט סטטיסטי ליד השולחן
        info = f"{occupied}/{capacity}"
        draw.text((x, y + size/2 + 16), info, fill='darkgreen', anchor='mm', font=font)
        if show_empty_seats:
            draw.text((x, y + size/2 + 34), f"Empty: {empty}", fill='red', anchor='mm', font=font)
    
    # שמירת התמונה
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="image/png",
        headers={"Content-Disposition": f"attachment; filename=seating-map-{event_id}.png"}
    )

@router.get("/event/{event_id}/with-fields")
def get_guests_with_fields(
    event_id: int, 
    db: Session = Depends(get_db),
    limit: Optional[int] = Query(None, description="Maximum number of guests to return"),
    offset: int = Query(0, description="Number of guests to skip")
):
    return repository.get_guests_with_fields(db, event_id, limit=limit, offset=offset)

@router.get("/event/{event_id}/count")
def get_guests_count(event_id: int, db: Session = Depends(get_db)):
    """מחזיר את מספר המוזמנים הכולל לאירוע"""
    count = db.query(models.Guest).filter(models.Guest.event_id == event_id).count()
    return {"count": count}

@router.post("/update-gender-defaults/{event_id}")
def update_guests_with_default_gender_endpoint(event_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """עדכון מוזמנים קיימים עם מגדר ברירת מחדל"""
    updated_count = repository.update_guests_with_default_gender(db, event_id)
    return {"message": f"עודכנו {updated_count} מוזמנים עם מגדר ברירת מחדל", "updated_count": updated_count}

@router.post("/events/{event_id}/ensure-all-fields")
def ensure_all_fields(event_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """יוצר את כל השדות הדינמיים מהרשימה, גם אם הם ריקים"""
    print(f"ensure_all_fields called for event_id: {event_id}")
    # רשימת כל השדות שהמשתמש רוצה
    all_required_fields = [
        "שם פרטי", "שם משפחה", "מספר נייד", "מייל", "תאריך", "קבוצות", "סטטוס זכאות ללידים",
        "מזהה", "מזהה יבוא", "טלפון בית", "ת.ז./ח.פ.", "טלפון נוסף", "עיר", "כתובת למשלוח דואר",
        "ביקש לחזור בתאריך", "מיקוד", "שם לקבלה", "רחוב", "מספר בניין", "מספר דירה", "הערות",
        "קישור למשתמש", "מזהה שגריר", "סוג תצוגה", "שיוך לטלפנית", "שיחה אחרונה עם טלפנית",
        "תרומה אחרונה דרך טלפנית", "האם הוק פעיל", "סכום הוק חודשי ₪ - תרומה", "סכום הוק חודשי ₪ - תשלום",
        "ריכוז שליחת הקבלות בהוראת קבע", "תאריך תשלום אחרון", "סכום תשלום אחרון", "תאריך עסקה אחרונה",
        "סכום עסקה אחרונה", "סכום תרומות ותשלומים בשקלים בשנה האחרונה", "סכום תרומות ותשלומים סהכ",
        "הסכום הגבוה ביותר של תרומה חד פעמית", "הסכום הגבוה ביותר של תרומה בהוראות קבע", "בנק", "סניף",
        "מספר חשבון", "שם בבנק", "סטטוס שיחה אחרונה", "מסומן כשגריר", "שפה", "CardID", "מספר אישי מניג'ר",
        "קטגוריה", "הושבה דינר פב", "סטאטוס טיפול", "סטאטוס חסות/ברכה", "התחיבות לתרומה", "אופן אישור הגעה",
        "הושבה גברים פד", "הושבה נשים פד", "הושבה זמני גברים פד", "הושבה זמני נשים פד", "סגנון שולחן",
        "סטאטוס תורם", "סגנון תורם", "סגנון עיסוק", "מספר כרטיס אשראי", "שם רכז איש קשר דינר",
        "שם מלא איש קשר דינר", "מקור הגעה", "שם אמצעי", "תואר אחרי", "תואר לפני", "שם בן/בת הזוג",
        "שכונה", "סוג כרטיס", "דינרים משתתפים", "משוייך לדינרים", "דינר 2024 מוזמנים לפי סכום",
        "דינר 2022 מוזמנים", "השתתפות דינר פב", "כמות הוק 05/2024", "סהכ תרומות 2021", "סהכ תרומות 2022",
        "סהכ תרומות 2023", "סהכ תרומות 2024", "סכום הוק חודשי 05-24", "הושבה דינר 2019", "שם פרטי מחולק",
        "שם משפחה מחולק", "שם פרטי ללא אשה", "קבוצה מייל", "סיווג להזמנה", "סה תרומות", "לא שייך לדינר",
        "מספר החשבון", "שגריר", "לא משתתף", "אישור הגעה", "השתתפות זוגית", "השתתפות נשים דינר פד",
        "השתתפות גברים דינר פד", "הערות תשלום דינר פד", "ליד מי תרצו לשבת?", "ליד מי תרצו לשבת (משתתף 1)",
        "ליד מי תרצו לשבת (משתתף 2)", "תוכן הברכה בדינר תשפד", "שם חותם הברכה בדינר תשפד",
        "הוספת לוגו בדינר תשפד", "יכולת תרומה", "טלפון אשה", "מספר שולחן נשים", "קטגוריה נשים",
        "הושבה שולחן זמני דינר פד", "מספר שולחן גברים", "Email 2", "תואר לפני נשים", "הגיע לדינר פד גברים",
        "הגיע לדינר פד נשים", "שם אישה לדינר פד", "יונתן", "הוק פעיל", "תרמו השנה 2024", "סטטוס גביה דינר פד",
        "בדיקה טפסים", "סטטוס לשגריר", "בית כנסת", "לוחית רישוי - כניסה לחניה", "RAF", "שם האישה", "כינוי",
        "Line2", "Line3", "מדינה", "תרומות 2019", "תרומות 2020", "תרומות 2021", "תרומות 2022", "תרומות 2023",
        "סהכ תרומות 2019-2023", "Values spread over 4 years", "מייל עבודה", "ID ממערכת קודמת", "ערכי 4 השנים",
        "מייל נוסף", "Master Flags", "כתובת שונה 2", "תאור סטטוס", "כתובת שונה 3", "ארץ", "כתובת חדשה רחוב",
        "כתובת חדשה עיר", "כתובת חדשה מיקוד", "כתובת חדשה ארץ", "כתובת חדשה מספר בית", "הערה כתובת",
        "הערה כתובת 2", "הערה כתובת 3", "הערות טלפניות", "כתובת נכונה", "כתובת לא רלוונטית", "כתובת עודכנה",
        "כתובת נכונה 2", "כתובת עודכנה 2", "כתובת לא רלוונטית 2", "כתובת עודכנה 3", "כתובת לא רלוונטית 3",
        "כתובת נכונה 3", "טלפון נוסף 2", "רחוב 2", "רחוב 3", "עיר 2", "עיר 3", "מס' בית 2", "מס' בית 3",
        "ארץ 2", "ארץ 3", "מיקוד 2", "מיקוד 3", "טלפונים עודכנו", "טלפונים נכונים", "שם המשתמשת שעדכנה כתובת",
        "סוג כתובת 3", "סוג כתובת 2", "סוג כתובת", "סוג כתובת חדשה", "עדכון טלפנית", "גיל", "תאריך לידה", "קוד תלמיד נ_י"
    ]
    
    existing_fields = repository.get_custom_fields(db, event_id)
    existing_field_names = set()
    # אופטימיזציה: פענוח מהיר יותר - רק אם יש שדות קיימים
    if existing_fields:
        for f in existing_fields:
            try:
                _, _, display_name, _ = decode_prefixed_name(f.name)
                existing_field_names.add(display_name)
            except:
                # אם יש בעיה בפענוח, נשתמש בשם המקורי
                existing_field_names.add(f.name)
    
    created_count = 0
    order_index = 1
    print(f"Total required fields: {len(all_required_fields)}, Existing fields: {len(existing_field_names)}")
    
    # אם יש כבר יותר שדות קיימים מאשר נדרשים, כנראה שכבר הכל קיים
    if len(existing_field_names) >= len(all_required_fields):
        print("All required fields already exist, skipping creation")
        return {"message": f"כל השדות כבר קיימים", "created_count": 0}
    
    for field_name in all_required_fields:
        if field_name not in existing_field_names:
            try:
                stored_name = encode_prefixed_name(None, order_index, field_name, False)
                field = schemas.CustomFieldCreate(event_id=event_id, name=stored_name, field_type="text")
                repository.create_custom_field(db, field)
                created_count += 1
                existing_field_names.add(field_name)  # הוסף ל-set כדי למנוע כפילויות
                if created_count <= 5:  # הדפס רק את הראשונים
                    print(f"Created field: {field_name}")
            except Exception as e:
                print(f"Error creating field {field_name}: {e}")
        order_index += 1
    
    print(f"Total created: {created_count} fields")
    return {"message": f"נוצרו {created_count} שדות חדשים", "created_count": created_count}

@router.post("/events/{event_id}/form-fields", response_model=schemas.CustomFieldOut)
def create_form_field(event_id: int, body: dict, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    name = body.get("field_name")
    field_type = body.get("field_type", "text")
    form_key = body.get("form_key")
    if not name:
        raise HTTPException(status_code=400, detail="field_name is required")
    required_flag = bool(body.get("required"))
    # determine next order for this form
    existing = repository.get_custom_fields(db, event_id)
    # filter existing for this form by decoding
    same_form = []
    for f in existing:
        fk, oi, _, _ = decode_prefixed_name(f.name)
        # if model has real form_key, prefer it
        if hasattr(f, 'form_key') and getattr(f, 'form_key'):
            if form_key is None or getattr(f, 'form_key') == form_key:
                same_form.append(f)
        else:
            if form_key is None or fk == form_key:
                same_form.append(f)
    # next order index
    max_order = 0
    for f in same_form:
        _, oi, _, _ = decode_prefixed_name(f.name)
        if oi and oi > max_order:
            max_order = oi
    next_order = max_order + 1

    # Encode name with prefix to persist order (even if DB has form_key column)
    stored_name = encode_prefixed_name(form_key, next_order, name, required_flag)
    try:
        field = schemas.CustomFieldCreate(event_id=event_id, name=stored_name, field_type=field_type, form_key=form_key)
    except TypeError:
        field = schemas.CustomFieldCreate(event_id=event_id, name=stored_name, field_type=field_type)
    created = repository.create_custom_field(db, field)
    # Response without prefix
    fk, oi, label, req = decode_prefixed_name(created.name)
    try:
        # append star to name if required
        display_name = f"{label} *" if req else label
        return schemas.CustomFieldOut(id=created.id, event_id=created.event_id, name=display_name, field_type=created.field_type, form_key=form_key or fk)
    except TypeError:
        return schemas.CustomFieldOut(id=created.id, event_id=created.event_id, name=display_name, field_type=created.field_type)

@router.get("/events/{event_id}/form-fields", response_model=list[schemas.CustomFieldOut])
def list_form_fields(event_id: int, form_key: str | None = Query(None), db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    fields = repository.get_custom_fields(db, event_id)
    # Build normalized list with decoded info and filter/sort
    normalized = []
    for f in fields:
        fk, oi, label, req = decode_prefixed_name(f.name)
        real_fk = getattr(f, 'form_key', None) or fk
        if form_key and real_fk != form_key:
            continue
        normalized.append({
            'id': f.id,
            'event_id': f.event_id,
            'name': f"{label} *" if req else label,
            'field_type': f.field_type,
            'form_key': real_fk,
            'order_index': oi or 0
        })
    normalized.sort(key=lambda x: x['order_index'])
    out = []
    for n in normalized:
        try:
            out.append(schemas.CustomFieldOut(id=n['id'], event_id=n['event_id'], name=n['name'], field_type=n['field_type'], form_key=n['form_key']))
        except TypeError:
            out.append(schemas.CustomFieldOut(id=n['id'], event_id=n['event_id'], name=n['name'], field_type=n['field_type']))
    return out

@router.post("/events/{event_id}/form-fields/reorder")
def reorder_form_fields(event_id: int, body: dict, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    form_key = body.get('form_key')
    ordered_ids = body.get('ordered_ids') or []
    if not form_key:
        raise HTTPException(status_code=400, detail="form_key is required")
    if not isinstance(ordered_ids, list) or not all(isinstance(x, int) for x in ordered_ids):
        raise HTTPException(status_code=400, detail="ordered_ids must be a list of integers")

    # Load all fields for event
    fields = repository.get_custom_fields(db, event_id)
    # Map id->model
    id_to_field = {f.id: f for f in fields}
    # Filter only ids that exist and belong to this form
    filtered = []
    for fid in ordered_ids:
        f = id_to_field.get(fid)
        if not f:
            continue
        fk, _, label, req = decode_prefixed_name(f.name)
        real_fk = getattr(f, 'form_key', None) or fk
        if real_fk == form_key:
            filtered.append((fid, f, label))
    # Apply new order indexes by updating stored name prefixes
    order_counter = 1
    for fid, f, label in filtered:
        # preserve existing required flag
        _, _, _, req = decode_prefixed_name(f.name)
        new_name = encode_prefixed_name(form_key, order_counter, label, req)
        # direct update
        f.name = new_name
        db.add(f)
        order_counter += 1
    db.commit()
    return {"message": "order updated", "count": len(filtered)}

@router.post("/events/{event_id}/form-shares", response_model=schemas.FormShareOut)
def create_form_share_endpoint(
    event_id: int,
    body: schemas.FormShareCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    check_event_permission(db, current_user, event_id, required_roles=("event_admin", "manager", "admin"))
    return repository.create_form_share(
        db,
        event_id=event_id,
        form_key=body.form_key,
        expires_at=body.expires_at,
        allow_submissions=body.allow_submissions,
        deactivate_existing=body.deactivate_existing,
    )


@router.get("/events/{event_id}/form-shares", response_model=list[schemas.FormShareOut])
def list_form_shares_endpoint(
    event_id: int,
    form_key: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    check_event_permission(db, current_user, event_id, required_roles=("event_admin", "manager", "admin"))
    return repository.list_form_shares(db, event_id=event_id, form_key=form_key)


@router.post("/events/{event_id}/form-shares/{share_id}/deactivate", response_model=schemas.FormShareOut)
def deactivate_form_share_endpoint(
    event_id: int,
    share_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    check_event_permission(db, current_user, event_id, required_roles=("event_admin", "manager", "admin"))
    share = repository.deactivate_form_share(db, share_id=share_id, event_id=event_id)
    if not share:
        raise HTTPException(status_code=404, detail="Form share not found")
    return share
