from datetime import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
import os
import uuid

from app.core.database import SessionLocal
from app.core.config import settings
from app.guests import repository, schemas
from app.guests.constants import BASE_FORM_FIELDS
from app.guests.repository import get_form_field_id_by_label
from app.guests import models as guest_models
from app.payments import schemas as payment_schemas, repository as payment_repository
from app.tableHead import repository as tablehead_repository, schemas as tablehead_schemas
from app.greetings import service as greeting_service, schemas as greeting_schemas
from app.core.email_service import send_greeting_notification_async

router = APIRouter(prefix="/public", tags=["Public Forms"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_active_share_or_404(token: str, db: Session):
    share = repository.get_form_share_by_token(db, token)
    if not share or not share.is_active:
        raise HTTPException(status_code=404, detail="Form not found")
    if share.expires_at and share.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="This form link has expired")
    if not share.allow_submissions:
        raise HTTPException(status_code=403, detail="Submissions are disabled for this form")
    return share


@router.get("/forms/{token}", response_model=schemas.PublicFormResponse)
def get_public_form(token: str, db: Session = Depends(get_db)):
    share = _get_active_share_or_404(token, db)

    custom_fields = repository.get_form_fields_for_form(db, share.event_id, share.form_key)
    return schemas.PublicFormResponse(
        event_id=share.event_id,
        event_name=share.event.name if share.event else "",
        form_key=share.form_key,
        share_token=share.token,
        base_fields=[schemas.PublicBaseField(**field) for field in BASE_FORM_FIELDS],
        custom_fields=[
            schemas.PublicCustomField(
                id=item["id"],
                label=item["label"],
                field_type=item["field_type"],
                required=item["required"],
                options=item.get("options"),
            )
            for item in custom_fields
        ],
    )


@router.get("/forms/{token}/previous-greeting", response_model=greeting_schemas.PreviousGreetingOut)
def get_public_previous_greeting(token: str, id_number: str, db: Session = Depends(get_db)):
    """החזרת הברכה האחרונה של מוזמן המצוי בקישור הציבורי."""
    share = _get_active_share_or_404(token, db)
    try:
        result = greeting_service.GreetingService.get_previous_greeting_for_event(db, share.event_id, id_number)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not result:
        raise HTTPException(status_code=404, detail="Previous greeting not found")
    return result


@router.post("/forms/{token}/upload-blessing-file")
async def upload_blessing_file(
    token: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """העלאת קובץ ברכה לטפסים ציבוריים"""
    share = _get_active_share_or_404(token, db)
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="קובץ לא נבחר")
    
    try:
        # יצירת תיקייה אם לא קיימת
        upload_dir = f"uploads/blessings/{share.event_id}"
        os.makedirs(upload_dir, exist_ok=True)
        
        # יצירת שם קובץ ייחודי
        file_ext = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4().hex}{file_ext}"
        file_path = os.path.join(upload_dir, unique_filename)
        
        # שמירת הקובץ
        with open(file_path, "wb") as buffer:
            content_bytes = await file.read()
            buffer.write(content_bytes)
        
        return {
            "file_path": file_path,
            "file_name": file.filename,
            "message": "קובץ נשמר בהצלחה"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"שגיאה בשמירת קובץ: {str(e)}")

@router.post("/forms/{token}/submit")
def submit_public_form(token: str, payload: schemas.PublicFormSubmission, db: Session = Depends(get_db)):
    share = _get_active_share_or_404(token, db)

    base = payload.base
    raw_id_number = (base.id_number or "").strip()
    # אם לא מולאה תעודת זהות – נייצר מזהה טכני ייחודי כדי להימנע מהתנגשות על (event_id, id_number)
    if not raw_id_number:
        id_number = f"TEMP-{uuid.uuid4().hex}"
    else:
        id_number = raw_id_number
    
    # הגדרת טפסי רישום ראשוניים (לא מאפשרים כפילות)
    registration_forms = ["vip-registration", "new-donors", "add-guests"]
    # הגדרת טפסי עדכון (מאפשרים עדכון מוזמן קיים)
    update_forms = ["women-seating-update", "increase-sdd"]
    
    # בדיקה אם יש מוזמן קיים לפי תעודת זהות
    existing_guest = None
    if id_number:
        existing_guest = repository.find_guest_by_id_number(db, share.event_id, id_number)
    
    # טיפול בטפסי רישום ראשוניים
    if share.form_key in registration_forms:
        if existing_guest:
            raise HTTPException(
                status_code=400, 
                detail="מוזמן עם תעודת זהות זו כבר רשום לאירוע זה. לא ניתן להירשם פעמיים."
            )
        # יצירת מוזמן חדש
        guest_data = schemas.GuestCreate(
            event_id=share.event_id,
            first_name=base.first_name.strip(),
            last_name=base.last_name.strip(),
            id_number=id_number,
            address="",
            phone=(base.phone or "").strip() if base.phone else None,
            email=(base.email or "").strip() if base.email else None,
            referral_source=(base.referral_source or "").strip() if base.referral_source else None,
            gender=base.gender,
            registration_source="form",  # מקור הרשמה: טופס ציבורי
        )
        guest = repository.create_guest(db, guest_data)
        if guest is None:
            raise HTTPException(status_code=400, detail="Guest already exists for this event")
    
    # טיפול בטפסי עדכון
    elif share.form_key in update_forms:
        # בטופס עדכון הושבה נשים אין שדה ת.ז, נשתמש בטלפון + שם משפחה כדי לנסות לאתר מוזמן קיים
        if not existing_guest and share.form_key == "women-seating-update":
            phone_value = (base.phone or "").strip() if base.phone else ""
            last_name_value = (base.last_name or "").strip() if base.last_name else ""
            if phone_value:
                existing_guest = repository.find_guest_by_phone_and_last_name(
                    db,
                    share.event_id,
                    phone_value,
                    last_name_value or None,
                )

        if existing_guest:
            # עדכון מוזמן קיים
            guest = existing_guest
            # עדכון פרטים בסיסיים אם נשלחו
            if base.first_name and base.first_name.strip():
                guest.first_name = base.first_name.strip()
            if base.last_name and base.last_name.strip():
                guest.last_name = base.last_name.strip()
            if base.phone and base.phone.strip():
                guest.phone = base.phone.strip()
            if base.email and base.email.strip():
                guest.email = base.email.strip()
            if base.referral_source and base.referral_source.strip():
                guest.referral_source = base.referral_source.strip()
            
            db.commit()
            db.refresh(guest)
        else:
            # בטופס עדכון הושבה נשים לא יוצרים מוזמן חדש – מחזירים שגיאה ברורה
            if share.form_key == "women-seating-update":
                raise HTTPException(
                    status_code=400,
                    detail="לא נמצא מוזמן קיים לעדכון לפי הפרטים שנמסרו (טלפון/שם משפחה).",
                )

            # בטפסי עדכון אחרים: יצירת מוזמן חדש (אם אין קיים)
            guest_data = schemas.GuestCreate(
                event_id=share.event_id,
                first_name=base.first_name.strip(),
                last_name=base.last_name.strip(),
                id_number=id_number,
                address="",
                phone=(base.phone or "").strip() if base.phone else None,
                email=(base.email or "").strip() if base.email else None,
                referral_source=(base.referral_source or "").strip() if base.referral_source else None,
                gender=base.gender,
                registration_source="form",  # מקור הרשמה: טופס ציבורי
            )
            guest = repository.create_guest(db, guest_data)
            if guest is None:
                raise HTTPException(status_code=400, detail="Error creating guest")
    
    else:
        # טופס אחר - התנהגות ברירת מחדל (יצירה חדשה)
        guest_data = schemas.GuestCreate(
            event_id=share.event_id,
            first_name=base.first_name.strip(),
            last_name=base.last_name.strip(),
            id_number=id_number,
            address="",
            phone=(base.phone or "").strip() if base.phone else None,
            email=(base.email or "").strip() if base.email else None,
            referral_source=(base.referral_source or "").strip() if base.referral_source else None,
            gender=base.gender,
            registration_source="form",  # מקור הרשמה: טופס ציבורי
        )
        guest = repository.create_guest(db, guest_data)
        if guest is None:
            raise HTTPException(status_code=400, detail="Guest already exists for this event")

    allowed_fields = {
        f["id"] for f in repository.get_form_fields_for_form(db, share.event_id, share.form_key)
    }
    for item in payload.custom:
        if item.field_id not in allowed_fields:
            continue
        repository.create_field_value(
            db,
            schemas.FieldValueCreate(
                guest_id=guest.id,
                custom_field_id=item.field_id,
                value="" if item.value is None else str(item.value),
            ),
        )

    if share.form_key == "vip-registration":
        _handle_vip_public_submission(db, share, guest, base, payload.extra or {})
    elif share.form_key == "new-donors":
        _handle_new_donors_public_submission(db, share, guest, base, payload.extra or {})
    elif share.form_key == "women-seating-update":
        _handle_women_seating_public_submission(db, share, guest, base)
    elif share.form_key == "add-guests":
        _handle_add_guests_public_submission(db, share, guest, base)
    elif share.form_key == "increase-sdd":
        _handle_increase_sdd_public_submission(db, share, guest, base, payload.extra or {})

    return {"status": "ok", "guest_id": guest.id}


@router.get(
    "/forms/{token}/payments/config",
    response_model=payment_schemas.NedarimPlusConfig,
)
def get_public_payment_config(token: str, db: Session = Depends(get_db)):
    share = _get_active_share_or_404(token, db)
    if share.form_key != "new-donors":
        raise HTTPException(status_code=400, detail="Payment configuration not available for this form")
    return payment_schemas.NedarimPlusConfig(
        mosad_id=settings.NEDARIM_PLUS_MOSAD_ID,
        api_valid=settings.NEDARIM_PLUS_API_VALID,
        iframe_url="https://matara.pro/nedarimplus/iframe",
    )


@router.post(
    "/forms/{token}/payments",
    response_model=payment_schemas.Payment,
)
def create_public_payment(
    token: str,
    payment: payment_schemas.PaymentCreate,
    db: Session = Depends(get_db),
):
    share = _get_active_share_or_404(token, db)
    if share.form_key != "new-donors":
        raise HTTPException(status_code=400, detail="Payments are not enabled for this form")

    # וודא שהאורח קשור לאירוע הנכון
    if payment.guest_id:
        guest = repository.get_guest_by_id(db, payment.guest_id)
        if not guest or guest.event_id != share.event_id:
            raise HTTPException(status_code=400, detail="Guest does not belong to this event")

    payload_dict = payment.model_dump()
    payload_dict["event_id"] = share.event_id

    sanitized_payload = payment_schemas.PaymentCreate(**payload_dict)
    created_payment = payment_repository.create_payment(db, sanitized_payload)
    return created_payment


@router.get("/forms/{token}/table-heads", response_model=list[tablehead_schemas.TableHeadOut])
def list_public_table_heads(token: str, db: Session = Depends(get_db)):
    share = _get_active_share_or_404(token, db)
    heads = tablehead_repository.get_table_heads_by_event(db, share.event_id)
    return heads


def _add_field_value_by_label(db: Session, event_id: int, form_key: str, guest_id: int, label: str, value: str | None):
    if not value:
        return
    field_id = get_form_field_id_by_label(db, event_id, form_key, label)
    if not field_id:
        return
    repository.create_field_value(
        db,
        schemas.FieldValueCreate(
            guest_id=guest_id,
            custom_field_id=field_id,
            value=str(value),
        ),
    )


def _update_guest_field_directly(guest: guest_models.Guest, field_name: str, value: str | None):
    """
    מעדכן שדה ישירות בטבלת guests לפי שם השדה.
    מיפוי בין שמות מהטפסים לשדות בטבלה.
    """
    if not value or not isinstance(value, str):
        return False
    
    value = value.strip()
    if not value:
        return False
    
    # מיפוי בין שמות מהטפסים לשדות בטבלה
    field_mapping = {
        "spouse_name": "spouse_name",  # שם בת הזוג
        "wife_name": "wife_name",  # שם האישה
        "city": "city",  # עיר
        "street": "street",  # רחוב
        "neighborhood": "neighborhood",  # שכונה
        "building_number": "building_number",  # מספר בנין
        "apartment": "apartment_number",  # מספר דירה
        "occupation": "occupation_style",  # עיסוק (סגנון עיסוק)
        "donation_ability": "donation_ability",  # יכולת תרומה
        "participation_men": "men_participation_dinner_feb",  # השתתפות גברים דינר פד
        "participation_women": "women_participation_dinner_feb",  # השתתפות נשים דינר פד
        "seat_near_main": "seat_near_main",  # ליד מי תרצו לשבת? (משתתף ראשי)
        "couple_participation": "couple_participation",  # השתתפות זוגית
        "alt_phone": "alt_phone_1",  # טלפון נוסף
    }
    
    db_field_name = field_mapping.get(field_name)
    if db_field_name and hasattr(guest, db_field_name):
        setattr(guest, db_field_name, value)
        return True
    
    return False


def _handle_vip_public_submission(db: Session, share, guest, base_data: schemas.PublicFormBaseData, extra_data: dict):
    extras = base_data.dict(exclude_unset=False)
    mapping = {
        "spouse_name": "שם בת הזוג",
        "city": "עיר",
        "street": "רחוב",
        "neighborhood": "שכונה",
        "building_number": "מספר בנין",
        "apartment": "מספר דירה",
        "occupation": "עיסוק",
        "entered_by": 'הוכנס למערכת ע"י *',
        "donation_ability": "יכולת תרומה",
        "participation_men": 'השתתפות גברים דינר פ"נ *',
        "participation_women": 'עדכון השתתפות נשים דינר פ"נ *',
        "blessing_option": "ברכה בספר הברכות",
        "blessing_signer": "ברכה - חותם",
        "blessing_content": "ברכה - תוכן",
        "seat_near_main": 'ליד מי תרצו לשבת? (משתתף ראשי)',
        "remarks": "הערות",
    }

    # עדכון שדות ישירות בטבלת guests וגם ב-custom fields
    for key, label in mapping.items():
        value = extras.get(key)
        if value:
            # עדכון ישירות בטבלת guests (אם יש מיפוי)
            _update_guest_field_directly(guest, key, value)
            # גם ב-custom field (לסינכרון)
            _add_field_value_by_label(db, share.event_id, share.form_key, guest.id, label, value)
    
    # עדכון כתובת מלאה
    address_parts = []
    if extras.get("street"):
        address_parts.append(extras.get("street"))
    if extras.get("building_number"):
        address_parts.append(extras.get("building_number"))
    if extras.get("apartment"):
        address_parts.append(extras.get("apartment"))
    if extras.get("neighborhood"):
        address_parts.append(extras.get("neighborhood"))
    if extras.get("city"):
        address_parts.append(extras.get("city"))
    
    if address_parts:
        full_address = " ".join(address_parts).strip()
        if full_address:
            guest.address = full_address
    
    # שמירת השינויים בטבלת guests
    db.commit()
    db.refresh(guest)

    extra_count = extra_data.get("extra_guests_count") or extras.get("extra_guests_count")
    if extra_count is not None:
        _add_field_value_by_label(db, share.event_id, share.form_key, guest.id, 'הבאת אורח/ת נוסף/ת *', extra_count)

    extra_guests = extra_data.get("extra_guests") or []
    for index, extra_guest in enumerate(extra_guests, start=1):
        first = (extra_guest.get("first_name") or "").strip()
        last = (extra_guest.get("last_name") or "").strip()
        if not first and not last:
            continue
        eg_payload = schemas.GuestCreate(
            event_id=share.event_id,
            first_name=first or "אורח",
            last_name=last or "נוסף",
            id_number=(extra_guest.get("id_number") or "").strip(),
            address="",
            phone=None,
            email=None,
            referral_source="vip_registration_extra_guest",
            gender="male" if extra_guest.get("gender") == "זכר" else "female" if extra_guest.get("gender") == "נקבה" else "male",
            registration_source="form",  # מקור הרשמה: טופס ציבורי
        )
        new_guest = repository.create_guest(db, eg_payload)
        if not new_guest:
            continue
        seat_label = f'ליד מי תרצו לשבת? (משתתף {index})'
        seat_value = (extra_guest.get("seat_near") or "").strip()
        if seat_value:
            _add_field_value_by_label(db, share.event_id, share.form_key, new_guest.id, seat_label, seat_value)

    # Auto create spouse entries similar to the internal flow
    participation_women = extras.get("participation_women")
    participation_men = extras.get("participation_men")
    phone_value = extras.get("phone")
    email_value = extras.get("email")
    address_value = " ".join(filter(None, [extras.get("street"), extras.get("building_number"), extras.get("apartment"), extras.get("neighborhood"), extras.get("city")])).strip()

    if participation_women == "השתתפות יחידה נשים":
        spouse_payload = schemas.GuestCreate(
            event_id=share.event_id,
            first_name="הרב",
            last_name=extras.get("last_name", guest.last_name),
            id_number="",
            address=address_value,
            phone=phone_value,
            email=email_value,
            referral_source="vip_registration_spouse",
            gender="male",
            registration_source="form",  # מקור הרשמה: טופס ציבורי
        )
        spouse_guest = repository.create_guest(db, spouse_payload)
        if spouse_guest:
            _add_field_value_by_label(db, share.event_id, share.form_key, spouse_guest.id, 'עדכון השתתפות גברים דינר פ"נ *', "השתתפות יחיד")
            if extras.get("occupation"):
                _add_field_value_by_label(db, share.event_id, share.form_key, spouse_guest.id, "עיסוק", extras.get("occupation"))
            if extras.get("donation_ability"):
                _add_field_value_by_label(db, share.event_id, share.form_key, spouse_guest.id, "יכולת תרומה", extras.get("donation_ability"))
            if extras.get("entered_by"):
                _add_field_value_by_label(db, share.event_id, share.form_key, spouse_guest.id, 'הוכנס למערכת ע"י *', extras.get("entered_by"))

    if participation_men == "השתתפות יחיד":
        spouse_payload = schemas.GuestCreate(
            event_id=share.event_id,
            first_name="גברת",
            last_name=extras.get("last_name", guest.last_name),
            id_number="",
            address=address_value,
            phone=phone_value,
            email=email_value,
            referral_source="vip_registration_spouse",
            gender="female",
            registration_source="form",  # מקור הרשמה: טופס ציבורי
        )
        spouse_guest = repository.create_guest(db, spouse_payload)
        if spouse_guest:
            _add_field_value_by_label(db, share.event_id, share.form_key, spouse_guest.id, 'עדכון השתתפות נשים דינר פ"נ *', "השתתפות יחידה נשים")
            if extras.get("occupation"):
                _add_field_value_by_label(db, share.event_id, share.form_key, spouse_guest.id, "עיסוק", extras.get("occupation"))
            if extras.get("donation_ability"):
                _add_field_value_by_label(db, share.event_id, share.form_key, spouse_guest.id, "יכולת תרומה", extras.get("donation_ability"))
            if extras.get("entered_by"):
                _add_field_value_by_label(db, share.event_id, share.form_key, spouse_guest.id, 'הוכנס למערכת ע"י *', extras.get("entered_by"))
    
    # שמירת ברכה במודל Greeting אם קיימת
    blessing_content = extras.get("blessing_content")
    blessing_signer = extras.get("blessing_signer")
    blessing_option = extras.get("blessing_option")
    blessing_file_path = extras.get("blessing_file_path")  # נתיב קובץ אם הועלה
    blessing_file_name = extras.get("blessing_logo_name") or extras.get("blessing_file_name")
    
    if blessing_content and blessing_signer and (
        blessing_option == "הוספת פרטים עכשיו" or 
        blessing_option == "שימוש בברכה של הדינר הקודם"
    ):
        try:
            phone_value = extras.get("phone") or guest.mobile_phone
            greeting_data = greeting_schemas.GreetingCreate(
                guest_id=guest.id,
                event_id=share.event_id,
                content=blessing_content,
                formatted_content=blessing_content,  # נשמור גם את התוכן כ-formatted
                signer_name=blessing_signer,
                phone=phone_value,
                file_path=blessing_file_path,  # נתיב קובץ אם הועלה
                file_name=blessing_file_name
            )
            greeting_service.GreetingService.create_or_update_greeting(db, greeting_data)
            
            # שליחת התראה במייל על ברכה חדשה (ברקע)
            guest_name = f"{guest.first_name or ''} {guest.last_name or ''}".strip() or "אורח"
            send_greeting_notification_async(
                guest_name=guest_name,
                signer_name=blessing_signer,
                content=blessing_content,
                phone=phone_value,
                file_path=blessing_file_path,
                file_name=blessing_file_name
            )
        except Exception as e:
            # לא נכשיל את כל הטופס אם יש בעיה בשמירת ברכה
            print(f"Error saving greeting: {e}")


def _handle_new_donors_public_submission(db: Session, share, guest, base_data: schemas.PublicFormBaseData, extra_data: dict):
    # Reuse VIP logic for participation, blessing and extra guests handling
    _handle_vip_public_submission(db, share, guest, base_data, extra_data)


def _handle_women_seating_public_submission(db: Session, share, guest, base_data: schemas.PublicFormBaseData):
    extras = base_data.dict(exclude_unset=False)

    # עדכון שדות ישירות בטבלת guests
    spouse_name = extras.get("spouse_name")
    if spouse_name:
        # עדכון ישירות בטבלת guests
        _update_guest_field_directly(guest, "spouse_name", spouse_name)
        # גם ב-custom field (לסינכרון) תחת השם כפי שמופיע בטבלה
        _add_field_value_by_label(db, share.event_id, share.form_key, guest.id, "שם בן/בת הזוג", spouse_name)

    participation_women = extras.get("participation_women")
    if participation_women:
        # עדכון ישירות בטבלת guests
        _update_guest_field_directly(guest, "participation_women", participation_women)
        # גם ב-custom field (לסינכרון)
        _add_field_value_by_label(db, share.event_id, share.form_key, guest.id, 'עדכון השתתפות נשים דינר פ"נ *', participation_women)

    participation_men = extras.get("participation_men")
    if participation_men:
        # עדכון ישירות בטבלת guests
        _update_guest_field_directly(guest, "participation_men", participation_men)
        # גם ב-custom field (לסינכרון)
        _add_field_value_by_label(db, share.event_id, share.form_key, guest.id, 'עדכון השתתפות גברים דינר פ"נ *', participation_men)
    
    # שמירת השינויים בטבלת guests
    db.commit()
    db.refresh(guest)

    phone_value = extras.get("phone")
    email_value = extras.get("email")

    if extras.get("participation_men") == "השתתפות יחיד":
        spouse_payload = schemas.GuestCreate(
            event_id=share.event_id,
            first_name="הרב",
            last_name=extras.get("last_name", guest.last_name),
            id_number=uuid.uuid4().hex,
            address="",
            phone=phone_value,
            email=email_value,
            referral_source="women_seating_update_spouse",
            gender="male",
            registration_source="form",  # מקור הרשמה: טופס ציבורי
        )
        spouse_guest = repository.create_guest(db, spouse_payload)
        if spouse_guest:
            _add_field_value_by_label(db, share.event_id, share.form_key, spouse_guest.id, 'עדכון השתתפות גברים דינר פ"נ *', "השתתפות יחיד")

    elif extras.get("participation_women") == "השתתפות יחידה נשים":
        spouse_payload = schemas.GuestCreate(
            event_id=share.event_id,
            first_name="גברת",
            last_name=extras.get("last_name", guest.last_name),
            id_number=uuid.uuid4().hex,
            address="",
            phone=phone_value,
            email=email_value,
            referral_source="women_seating_update_spouse",
            gender="female",
            registration_source="form",  # מקור הרשמה: טופס ציבורי
        )
        spouse_guest = repository.create_guest(db, spouse_payload)
        if spouse_guest:
            _add_field_value_by_label(db, share.event_id, share.form_key, spouse_guest.id, 'עדכון השתתפות נשים דינר פ"נ *', "השתתפות יחידה נשים")


def _handle_add_guests_public_submission(db: Session, share, guest, base_data: schemas.PublicFormBaseData):
    extras = base_data.dict(exclude_unset=False)

    mapping = {
        "spouse_name": "שם בת הזוג",
        "alt_phone": "טלפון נוסף",
        "street": "רחוב",
        "city": "עיר",
        "neighborhood": "שכונה",
        "building_number": "מספר בנין",
        "occupation": "עיסוק",
        "participation_men": 'השתתפות גברים דינר פ"נ *',
        "participation_women": 'עדכון השתתפות נשים דינר פ"נ *',
        "donation_ability": "יכולת תרומה",
        "entered_by": 'הוכנס למערכת ע"י *',
        "group_association": 'דרך קבוצה (שדה רשות)',
        "remarks": "הערות",
    }

    # עדכון שדות ישירות בטבלת guests וגם ב-custom fields
    for key, label in mapping.items():
        value = extras.get(key)
        if value:
            # עדכון ישירות בטבלת guests (אם יש מיפוי)
            _update_guest_field_directly(guest, key, value)
            # גם ב-custom field (לסינכרון)
            _add_field_value_by_label(db, share.event_id, share.form_key, guest.id, label, value)

    participation_men = extras.get("participation_men")
    participation_women = extras.get("participation_women")
    phone_value = extras.get("phone")
    email_value = extras.get("email")
    address_value = " ".join(filter(None, [extras.get("street"), extras.get("building_number"), extras.get("neighborhood"), extras.get("city")])).strip()
    donation_value = extras.get("donation_ability")
    remarks_value = extras.get("remarks")
    entered_by = extras.get("entered_by")
    
    # עדכון כתובת מלאה
    if address_value:
        guest.address = address_value
    
    # עדכון טלפון נוסף
    alt_phone = extras.get("alt_phone")
    if alt_phone:
        guest.alt_phone_1 = alt_phone.strip()
    
    # שמירת השינויים בטבלת guests
    db.commit()
    db.refresh(guest)

    if participation_men == "השתתפות יחיד":
        spouse_payload = schemas.GuestCreate(
            event_id=share.event_id,
            first_name="גברת",
            last_name=extras.get("last_name", guest.last_name),
            id_number=uuid.uuid4().hex,
            address=address_value,
            phone=phone_value,
            email=email_value,
            referral_source="add_guests_public_spouse",
            gender="female",
            registration_source="form",  # מקור הרשמה: טופס ציבורי
        )
        spouse_guest = repository.create_guest(db, spouse_payload)
        if spouse_guest:
            _add_field_value_by_label(db, share.event_id, share.form_key, spouse_guest.id, 'עדכון השתתפות נשים דינר פ"נ *', "השתתפות יחידה נשים")
            if donation_value:
                _add_field_value_by_label(db, share.event_id, share.form_key, spouse_guest.id, "יכולת תרומה", donation_value)
            if entered_by:
                _add_field_value_by_label(db, share.event_id, share.form_key, spouse_guest.id, 'הוכנס למערכת ע"י *', entered_by)
            if remarks_value:
                _add_field_value_by_label(db, share.event_id, share.form_key, spouse_guest.id, "הערות", remarks_value)
            if extras.get("street"):
                _add_field_value_by_label(db, share.event_id, share.form_key, spouse_guest.id, "רחוב", extras.get("street"))
            if extras.get("city"):
                _add_field_value_by_label(db, share.event_id, share.form_key, spouse_guest.id, "עיר", extras.get("city"))
            if extras.get("neighborhood"):
                _add_field_value_by_label(db, share.event_id, share.form_key, spouse_guest.id, "שכונה", extras.get("neighborhood"))
            if extras.get("building_number"):
                _add_field_value_by_label(db, share.event_id, share.form_key, spouse_guest.id, "מספר בנין", extras.get("building_number"))

    if participation_women == "השתתפות יחידה נשים":
        spouse_payload = schemas.GuestCreate(
            event_id=share.event_id,
            first_name="הרב",
            last_name=extras.get("last_name", guest.last_name),
            id_number=uuid.uuid4().hex,
            address=address_value,
            phone=phone_value,
            email=email_value,
            referral_source="add_guests_public_spouse",
            gender="male",
            registration_source="form",  # מקור הרשמה: טופס ציבורי
        )
        spouse_guest = repository.create_guest(db, spouse_payload)
        if spouse_guest:
            _add_field_value_by_label(db, share.event_id, share.form_key, spouse_guest.id, 'השתתפות גברים דינר פ"נ *', "השתתפות יחיד")
            if donation_value:
                _add_field_value_by_label(db, share.event_id, share.form_key, spouse_guest.id, "יכולת תרומה", donation_value)
            if entered_by:
                _add_field_value_by_label(db, share.event_id, share.form_key, spouse_guest.id, 'הוכנס למערכת ע"י *', entered_by)
            if remarks_value:
                _add_field_value_by_label(db, share.event_id, share.form_key, spouse_guest.id, "הערות", remarks_value)
            if extras.get("street"):
                _add_field_value_by_label(db, share.event_id, share.form_key, spouse_guest.id, "רחוב", extras.get("street"))
            if extras.get("city"):
                _add_field_value_by_label(db, share.event_id, share.form_key, spouse_guest.id, "עיר", extras.get("city"))
            if extras.get("neighborhood"):
                _add_field_value_by_label(db, share.event_id, share.form_key, spouse_guest.id, "שכונה", extras.get("neighborhood"))
            if extras.get("building_number"):
                _add_field_value_by_label(db, share.event_id, share.form_key, spouse_guest.id, "מספר בנין", extras.get("building_number"))


def _handle_increase_sdd_public_submission(db: Session, share, guest, base_data: schemas.PublicFormBaseData, extra_data: dict):
    extras = base_data.dict(exclude_unset=False)

    mapping = {
        "spouse_name": "שם בת הזוג",
        "street": "רחוב",
        "city": "עיר",
        "neighborhood": "שכונה",
        "building_number": "מספר בנין",
        "apartment": "מספר דירה",
        "occupation": "עיסוק",
        "sdd_increase": 'הגדלת הו"ק חודשית ב:',
        "participation_men": 'השתתפות גברים דינר פ"נ *',
        "participation_women": 'עדכון השתתפות נשים דינר פ"נ *',
        "donation_ability": "יכולת תרומה",
        "entered_by": 'הוכנס למערכת ע"י *',
        "blessing_option": "ברכה בספר הברכות",
        "blessing_signer": "ברכה - חותם",
        "blessing_content": "ברכה - תוכן",
        "seat_near_main": 'ליד מי תרצו לשבת? (משתתף ראשי)',
        "remarks": "הערות",
    }

    # עדכון שדות ישירות בטבלת guests וגם ב-custom fields
    for key, label in mapping.items():
        value = extras.get(key)
        if value:
            # עדכון ישירות בטבלת guests (אם יש מיפוי)
            _update_guest_field_directly(guest, key, value)
            # גם ב-custom field (לסינכרון)
            _add_field_value_by_label(db, share.event_id, share.form_key, guest.id, label, value)

    extra_count = extras.get("extra_guests_count") or extra_data.get("extra_guests_count")
    if extra_count is not None:
        _add_field_value_by_label(db, share.event_id, share.form_key, guest.id, 'הבאת אורח/ת נוסף/ת *', extra_count)
    
    # עדכון כתובת מלאה
    address_parts = []
    if extras.get("street"):
        address_parts.append(extras.get("street"))
    if extras.get("building_number"):
        address_parts.append(extras.get("building_number"))
    if extras.get("apartment"):
        address_parts.append(extras.get("apartment"))
    if extras.get("neighborhood"):
        address_parts.append(extras.get("neighborhood"))
    if extras.get("city"):
        address_parts.append(extras.get("city"))
    
    if address_parts:
        full_address = " ".join(address_parts).strip()
        if full_address:
            guest.address = full_address
    
    # שמירת השינויים בטבלת guests
    db.commit()
    db.refresh(guest)

    blessing_logo = extras.get("blessing_logo_name")
    if blessing_logo:
        _add_field_value_by_label(db, share.event_id, share.form_key, guest.id, "ברכה - לוגו", blessing_logo)

    extra_guests = extra_data.get("extra_guests") or []
    for index, extra_guest in enumerate(extra_guests, start=1):
        first = (extra_guest.get("first_name") or "").strip()
        last = (extra_guest.get("last_name") or "").strip()
        if not first and not last:
            continue
        eg_payload = schemas.GuestCreate(
            event_id=share.event_id,
            first_name=first or "אורח",
            last_name=last or "נוסף",
            id_number=(extra_guest.get("id_number") or "").strip(),
            address="",
            phone=None,
            email=None,
            referral_source="increase_sdd_extra_guest",
            gender="male" if extra_guest.get("gender") == "זכר" else "female" if extra_guest.get("gender") == "נקבה" else "male",
            registration_source="form",  # מקור הרשמה: טופס ציבורי
        )
        new_guest = repository.create_guest(db, eg_payload)
        if not new_guest:
            continue
        seat_value = (extra_guest.get("seat_near") or "").strip()
        if seat_value:
            _add_field_value_by_label(db, share.event_id, share.form_key, new_guest.id, f'ליד מי תרצו לשבת? (משתתף {index})', seat_value)

    phone_value = extras.get("phone")
    email_value = extras.get("email")
    address_value = " ".join(filter(None, [extras.get("street"), extras.get("building_number"), extras.get("apartment"), extras.get("neighborhood"), extras.get("city")])).strip()
    donation_value = extras.get("donation_ability")
    entered_by = extras.get("entered_by")

    if extras.get("participation_women") == "השתתפות יחידה נשים":
        spouse_payload = schemas.GuestCreate(
            event_id=share.event_id,
            first_name="הרב",
            last_name=extras.get("last_name", guest.last_name),
            id_number=uuid.uuid4().hex,
            address=address_value,
            phone=phone_value,
            email=email_value,
            referral_source="increase_sdd_public_spouse",
            gender="male",
            registration_source="form",  # מקור הרשמה: טופס ציבורי
        )
        spouse_guest = repository.create_guest(db, spouse_payload)
        if spouse_guest:
            _add_field_value_by_label(db, share.event_id, share.form_key, spouse_guest.id, 'עדכון השתתפות גברים דינר פ"נ *', "השתתפות יחיד")
            if occupation := extras.get("occupation"):
                _add_field_value_by_label(db, share.event_id, share.form_key, spouse_guest.id, "עיסוק", occupation)
            if donation_value:
                _add_field_value_by_label(db, share.event_id, share.form_key, spouse_guest.id, "יכולת תרומה", donation_value)
            if entered_by:
                _add_field_value_by_label(db, share.event_id, share.form_key, spouse_guest.id, 'הוכנס למערכת ע"י *', entered_by)

    if extras.get("participation_men") == "השתתפות יחיד":
        spouse_payload = schemas.GuestCreate(
            event_id=share.event_id,
            first_name="גברת",
            last_name=extras.get("last_name", guest.last_name),
            id_number=uuid.uuid4().hex,
            address=address_value,
            phone=phone_value,
            email=email_value,
            referral_source="increase_sdd_public_spouse",
            gender="female",
            registration_source="form",  # מקור הרשמה: טופס ציבורי
        )
        spouse_guest = repository.create_guest(db, spouse_payload)
        if spouse_guest:
            _add_field_value_by_label(db, share.event_id, share.form_key, spouse_guest.id, 'עדכון השתתפות נשים דינר פ"נ *', "השתתפות יחידה נשים")
            if occupation := extras.get("occupation"):
                _add_field_value_by_label(db, share.event_id, share.form_key, spouse_guest.id, "עיסוק", occupation)
            if donation_value:
                _add_field_value_by_label(db, share.event_id, share.form_key, spouse_guest.id, "יכולת תרומה", donation_value)
            if entered_by:
                _add_field_value_by_label(db, share.event_id, share.form_key, spouse_guest.id, 'הוכנס למערכת ע"י *', entered_by)
    
    # שמירת ברכה במודל Greeting אם קיימת
    blessing_content = extras.get("blessing_content")
    blessing_signer = extras.get("blessing_signer")
    blessing_option = extras.get("blessing_option")
    blessing_file_path = extras.get("blessing_file_path")  # נתיב קובץ אם הועלה
    blessing_file_name = extras.get("blessing_logo_name") or extras.get("blessing_file_name")
    
    if blessing_content and blessing_signer and (
        blessing_option == "הוספת פרטים עכשיו" or 
        blessing_option == "שימוש בברכה של הדינר הקודם"
    ):
        try:
            phone_value = extras.get("phone") or guest.mobile_phone
            greeting_data = greeting_schemas.GreetingCreate(
                guest_id=guest.id,
                event_id=share.event_id,
                content=blessing_content,
                formatted_content=blessing_content,  # נשמור גם את התוכן כ-formatted
                signer_name=blessing_signer,
                phone=phone_value,
                file_path=blessing_file_path,  # נתיב קובץ אם הועלה
                file_name=blessing_file_name
            )
            greeting_service.GreetingService.create_or_update_greeting(db, greeting_data)
            
            # שליחת התראה במייל על ברכה חדשה (ברקע)
            guest_name = f"{guest.first_name or ''} {guest.last_name or ''}".strip() or "אורח"
            send_greeting_notification_async(
                guest_name=guest_name,
                signer_name=blessing_signer,
                content=blessing_content,
                phone=phone_value,
                file_path=blessing_file_path,
                file_name=blessing_file_name
            )
        except Exception as e:
            # לא נכשיל את כל הטופס אם יש בעיה בשמירת ברכה
            print(f"Error saving greeting: {e}")

