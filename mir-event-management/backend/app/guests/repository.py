from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.guests import models, schemas
from app.guests.utils import decode_prefixed_name, encode_prefixed_name
from app.tableStructure import models as table_structure_models
from app.seatings import models as seating_models
from sqlalchemy.exc import IntegrityError
from app.audit_log.repository import log_change
from secrets import token_urlsafe
from typing import Optional, List

# מספר השדות הדינמיים שנשמרים בטבלה הראשית
MAX_INLINE_FIELDS = 15

def get_field_position_in_table(db: Session, event_id: int, custom_field_id: int) -> Optional[int]:
    """
    מחזיר את המיקום של השדה בטבלה הראשית (1-15) או None אם הוא מעבר ל-15.
    השדות ממוינים לפי order_index ואז לפי id.
    """
    all_fields = db.query(models.GuestCustomField).filter(
        models.GuestCustomField.event_id == event_id
    ).all()
    
    # מיון לפי order_index ואז לפי id
    def get_order_index(field):
        _, order_index, _, _ = decode_prefixed_name(field.name)
        return (order_index if order_index is not None else 0, field.id)
    
    sorted_fields = sorted(all_fields, key=get_order_index)
    
    # מצא את המיקום של השדה
    for index, field in enumerate(sorted_fields[:MAX_INLINE_FIELDS], start=1):
        if field.id == custom_field_id:
            return index
    
    return None  # השדה מעבר ל-15 הראשונים

def find_guest_by_id_number(db: Session, event_id: int, id_number: str) -> Optional[models.Guest]:
    """
    מחפש מוזמן לפי תעודת זהות (עם נרמול).
    מחזיר את המוזמן אם נמצא, אחרת None.
    """
    if not id_number or not id_number.strip():
        return None
    
    def _normalize(raw: str | None) -> str:
        if not raw:
            return ""
        return "".join(ch for ch in str(raw) if ch.isdigit())
    
    normalized_id = _normalize(id_number)
    if not normalized_id or len(normalized_id) < 6:  # לפחות 6 ספרות
        return None
    
    # שליפת מוזמנים עם id_number שמכיל את הספרות (לא מדויק אבל יותר יעיל)
    # נשתמש ב-query שמחפש id_number שמכיל את הספרות המנורמלות
    # זה לא מושלם אבל יותר יעיל מלטעון את כל המוזמנים
    candidates = db.query(models.Guest).filter(
        models.Guest.event_id == event_id,
        models.Guest.id_number.isnot(None),
        models.Guest.id_number != ""
    ).all()
    
    # חיפוש לפי תעודת זהות מנורמלת
    for guest in candidates:
        if guest.id_number and _normalize(guest.id_number) == normalized_id:
            return guest
    
    return None


def _normalize_phone_number(raw: str) -> str:
    """
    מנרמל מספרי טלפון להשוואה:
    - משאיר רק ספרות
    - אם מתחיל ב-972 מוסיף 0 בהתחלה (972545... -> 0545...)
    - משאיר רק 9–10 הספרות האחרונות (כדי להתעלם מקידומת מדינה)
    """
    if not raw:
        return ""
    digits = "".join(ch for ch in raw if ch.isdigit())
    if not digits:
        return ""

    # הפלה למקרה של +97254... -> 97254...
    if digits.startswith("972"):
        local = digits[3:]
        if local and not local.startswith("0"):
            digits = "0" + local
        else:
            digits = local

    # נשמור רק 10 ספרות אחרונות (או 9 אם קצר יותר)
    if len(digits) > 10:
        digits = digits[-10:]
    return digits


def find_guest_by_phone_and_last_name(
    db: Session,
    event_id: int,
    phone: str,
    last_name: Optional[str] = None,
) -> Optional[models.Guest]:
    """
    מחפש מוזמן לפי טלפון (ובהעדפה גם שם משפחה) עבור טפסי עדכון ציבוריים.
    ההיגיון:
    - קודם מחפש את כל המוזמנים באירוע עם אותו טלפון (אחרי נרמול, בכל שדות הטלפון הרלוונטיים)
    - אם אין התאמות -> מחזיר None
    - אם יש התאמות:
        * אם סופק שם משפחה, מעדיף התאמות עם אותו last_name (ללא רווחים)
        * אם עדיין יש כמה, בוחר את המוזמן האחרון לפי id
    כך נמנעים משגיאות 400 גם כשיש כפילויות, אבל עדיין נותנים עדיפות לשם משפחה תואם.
    """
    phone = (phone or "").strip()
    if not phone:
        return None

    normalized_target = _normalize_phone_number(phone)
    if not normalized_target:
        return None

    # שליפת כל המוזמנים לאירוע (לא מסננים לפי שם משפחה בשלב הזה)
    candidates: List[models.Guest] = db.query(models.Guest).filter(
        models.Guest.event_id == event_id
    ).all()
    matched: List[models.Guest] = []

    for guest in candidates:
        # ננסה להשוות מול כמה שדות טלפון רלוונטיים
        phone_candidates = [
            getattr(guest, "mobile_phone", "") or "",
            getattr(guest, "home_phone", "") or "",
            getattr(guest, "alt_phone_1", "") or "",
            getattr(guest, "alt_phone_2", "") or "",
            getattr(guest, "wife_phone", "") or "",
        ]
        for candidate_phone in phone_candidates:
            guest_phone_norm = _normalize_phone_number(candidate_phone)
            if guest_phone_norm and guest_phone_norm == normalized_target:
                matched.append(guest)
                break

    if not matched:
        return None

    # נתחיל מקבוצת ההתאמות הבסיסית
    candidate_set: List[models.Guest] = matched

    # אם ניתן שם משפחה – נעדיף התאמה עם שם משפחה זהה (עם נרמול רווחים)
    if last_name and last_name.strip():
        ln = last_name.strip()
        same_last = [
            g for g in matched if (getattr(g, "last_name", "") or "").strip() == ln
        ]
        if same_last:
            candidate_set = same_last

    # מתוך הקבוצה שנבחרה, נעדיף מוזמן שעדיין אין לו spouse_name
    candidates_no_spouse = [
        g for g in candidate_set
        if not (getattr(g, "spouse_name", None) or "").strip()
    ]
    if candidates_no_spouse:
        # נבחר את הוותיק ביותר (id הכי קטן)
        return sorted(candidates_no_spouse, key=lambda g: g.id)[0]

    # אם לכולם כבר יש spouse_name – נבחר את הוותיק מתוך הקבוצה (id הכי קטן)
    return sorted(candidate_set, key=lambda g: g.id)[0]


def find_guest_by_name_and_phone_or_email(
    db: Session,
    event_id: int,
    first_name: str,
    last_name: str,
    phone: str = None,
    email: str = None,
) -> Optional[models.Guest]:
    """
    מחפש מוזמן לפי שם + טלפון או שם + אימייל.
    מחזיר את המוזמן אם נמצא, אחרת None.
    """
    if not first_name or not last_name:
        return None
    
    # נרמול שמות
    first_name_norm = (first_name or "").strip().lower()
    last_name_norm = (last_name or "").strip().lower()
    
    if not first_name_norm or not last_name_norm:
        return None
    
    # שליפת מוזמנים עם אותו שם
    candidates = db.query(models.Guest).filter(
        models.Guest.event_id == event_id,
        func.lower(func.trim(models.Guest.first_name)) == first_name_norm,
        func.lower(func.trim(models.Guest.last_name)) == last_name_norm
    ).all()
    
    if not candidates:
        return None
    
    # אם יש רק מוזמן אחד - החזר אותו
    if len(candidates) == 1:
        return candidates[0]
    
    # אם יש כמה - נבדוק לפי טלפון או אימייל
    if phone:
        phone_norm = _normalize_phone_number(phone)
        if phone_norm and len(phone_norm) >= 7:
            for guest in candidates:
                # בדוק בכל שדות הטלפון
                guest_phones = [
                    _normalize_phone_number(guest.mobile_phone or ""),
                    _normalize_phone_number(guest.home_phone or ""),
                    _normalize_phone_number(guest.alt_phone_1 or ""),
                    _normalize_phone_number(guest.alt_phone_2 or ""),
                ]
                if phone_norm in guest_phones:
                    return guest
    
    if email:
        email_norm = (email or "").strip().lower()
        if email_norm and "@" in email_norm:
            for guest in candidates:
                guest_email = (guest.email or "").strip().lower()
                if guest_email == email_norm:
                    return guest
    
    # אם לא מצאנו התאמה לפי טלפון/אימייל - נחזיר את הוותיק ביותר
    return sorted(candidates, key=lambda g: g.id)[0]


# Guests
def create_guest(db: Session, guest: schemas.GuestCreate, user_id: int = None):
    """
    יוצר מוזמן חדש עם בדיקת כפילות מפורשת.
    בודק אם כבר קיים מוזמן עם אותו event_id + id_number לפני יצירה.
    """
    # בדיקת כפילות מפורשת לפני יצירה
    if guest.id_number and guest.id_number.strip():
        existing_guest = find_guest_by_id_number(db, guest.event_id, guest.id_number)
        if existing_guest:
            print(f"Duplicate guest detected: id_number={guest.id_number}, event_id={guest.event_id}, existing_guest_id={existing_guest.id}")
            return None
    
    try:
        db_guest = models.Guest(**guest.dict())
        db.add(db_guest)
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
    except IntegrityError as e:
        db.rollback()
        print(f"IntegrityError creating guest: {e}")
        print(f"Guest data: first_name={guest.first_name}, last_name={guest.last_name}, id_number={guest.id_number}, event_id={guest.event_id}")
        return None
    except Exception as e:
        db.rollback()
        print(f"Error creating guest: {e}")
        print(f"Guest data: {guest.dict()}")
        raise


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

def get_guests_with_fields(db: Session, event_id: int, limit: int = None, offset: int = 0):
    # אופטימיזציה: טען את כל הנתונים בבת אחת עם joinedload
    from sqlalchemy.orm import joinedload
    
    # שליפת כל האורחים לאירוע עם field_values
    query = db.query(models.Guest).filter(models.Guest.event_id == event_id).options(
        joinedload(models.Guest.field_values).joinedload(models.GuestFieldValue.custom_field)
    )
    
    # הוסף limit ו-offset אם צוינו
    if limit is not None:
        query = query.limit(limit).offset(offset)
    
    guests = query.all()
    
    # שליפת כל השדות הדינמיים של האירוע
    custom_fields = db.query(models.GuestCustomField).filter(models.GuestCustomField.event_id == event_id).all()
    
    # מיון השדות הדינמיים לפי order_index (אם יש) כדי לשמור על הסדר מהאקסל
    def get_order_index(field):
        _, order_index, _, _ = decode_prefixed_name(field.name)
        return (order_index if order_index is not None else 0, field.id)
    
    custom_fields_sorted = sorted(custom_fields, key=get_order_index)

    # שליפת מבנה הטבלה הגלובלי כדי להבטיח שהעמודות מהאקסל יופיעו גם אם ריקות
    ts_fields = db.query(table_structure_models.TableStructure).order_by(table_structure_models.TableStructure.display_order).all()
    ts_field_names = [t.column_name.strip() for t in ts_fields if t.column_name]
    
    # יצירת מיפוי בין custom_field_id למיקום בטבלה (1-15 או None)
    field_position_map = {}
    for index, field in enumerate(custom_fields_sorted[:MAX_INLINE_FIELDS], start=1):
        field_position_map[field.id] = index
    
    # אופטימיזציה: טען את כל ה-field values בבת אחת (רק לשדות מעבר ל-15)
    guest_ids = [g.id for g in guests]
    custom_field_ids_over_15 = [f.id for f in custom_fields_sorted[MAX_INLINE_FIELDS:]]
    
    # טען את כל ה-field values בבת אחת (רק לשדות מעבר ל-15)
    all_field_values = {}
    if guest_ids and custom_field_ids_over_15:
        field_values = db.query(models.GuestFieldValue).filter(
            models.GuestFieldValue.guest_id.in_(guest_ids),
            models.GuestFieldValue.custom_field_id.in_(custom_field_ids_over_15)
        ).all()
        
        # צור dictionary לזיהוי מהיר: (guest_id, custom_field_id) -> value
        for fv in field_values:
            key = (fv.guest_id, fv.custom_field_id)
            all_field_values[key] = fv.value

    # רשימה להחזרה - אופטימיזציה: השתמש ב-dict comprehension במקום לולאה
    # הגדר את כל השדות הקבועים פעם אחת - רק השדות שהמשתמש רוצה
    base_field_names = [
        "id", "שם", "שם פרטי", "שם משפחה", "טלפון", "אימייל", "תעודת זהות",
        "table_head_id", "gender", "confirmed_arrival",
        # פרטים אישיים
        "שם אמצעי", "תואר לפני", "תואר אחרי", "תואר בן זוג", "תואר אחרי בן זוג", "שם אישה",
        "גיל", "תאריך לידה", "ת.ז./ח.פ.", "שפה", "מאפיינים",
        # פרטי קשר
        "מספר נייד", "טלפון בית", "טלפון נוסף", "טלפון נוסף 2", "Email", "2 Email", "טלפון אשה",
        # מזהים
        "מספר חשבון", "מספר אישי מניג'ר", "CardID",
        # שיוך וניהול
        "קבוצה", "קבוצה מייל", "קישור למשתמש", "מזהה שגריר", "שגריר", "שיוך לטלפנית", "בית כנסת",
        # טלפניות ושיחות
        "סטטוס זכאות ללידים", "ביקש לחזור בתאריך", "שיחה אחרונה עם טלפנית",
        "סטטוס שיחה אחרונה", "הערות", "הערות טלפניות", "תאור סטטוס",
        # כתובת ראשית
        "רחוב", "מספר בניין", "מספר דירה", "עיר", "שכונה", "מיקוד", "מדינה",
        "ארץ", "כתובת למשלוח דואר", "שם לקבלה",
        # בנקים ותשלומים
        "שם בנק", "סניף", "מספר כרטיס אשראי",
        # תרומות
        "האם הוק פעיל", "סכום הוק חודשי בש\"ח", "סכום תשלום אחרון",
        "סכום תרומות ותשלומים בשנה האחרונה", "סכום תרומות ותשלומים סהכ",
        "התחייבות לתרומה", "יכולת תרומה", "תרומות בשנה האחרונה",
        # אירועים ודינרים
        "דינרים משתתפים", "סטטוס חסות/ברכה", "תוכן הברכה דינר קודם",
        # הושבות גברים
        "הושבה גברים קודמת", "הושבה זמני גברים", "מספר שולחן", "ליד מי תרצו לשבת",
        # הושבות נשים
        "הושבה נשים קודמת", "הושבה זמני נשים", "מספר שולחן נשים", "השתתפות", "ליד מי תרצו לשבת",
        # כללי
        "הערות", "מאפיינים"
    ]
    
    # מיפוי בין שם השדה ב-dict לשם העמודה ב-Guest model
    field_mapping = {
        "id": "id",
        "שם": "first_name",
        "שם פרטי": "first_name",  # מיפוי נוסף ל"שם פרטי"
        "שם משפחה": "last_name",
        "טלפון": "mobile_phone",
        "אימייל": "email",
        "Email": "email",
        "תעודת זהות": "id_number",
        "ת.ז./ח.פ.": "id_number",
        "table_head_id": "table_head_id",
        "gender": "gender",
        "confirmed_arrival": "confirmed_arrival",
        "שם אמצעי": "middle_name",
        "תואר לפני": "title_before",
        "תואר אחרי": "title_after",
        "שם בן/בת הזוג": "spouse_name",
        "תואר בן זוג": "spouse_name",
        "תואר אחרי בן זוג": "title_after",
        "שם האישה": "wife_name",
        "שם אישה": "wife_name",
        "גיל": "age",
        "תאריך לידה": "birth_date",
        "ת.ז./ח.פ.": "id_number",
        "שפה": "language",
        "מאפיינים": "notes",  # מאפיינים זה אותו שדה כמו הערות
        "מספר נייד": "mobile_phone",
        "טלפון בית": "home_phone",
        "טלפון נוסף": "alt_phone_1",
        "טלפון נוסף 2": "alt_phone_2",
        "Email 2": "email_2",
        "2 Email": "email_2",
        "טלפון אשה": "wife_phone",
        "מספר אישי מניג'ר": "manager_personal_number",
        "מספר אישי מניגר": "manager_personal_number",  # גרסה ללא גרש
        "CardID": "card_id",
        "קבוצות": "groups",
        "קבוצה": "groups",
        "קבוצה מייל": "email_group",
        "קישור למשתמש": "user_link",
        "מזהה שגריר": "ambassador_id",
        "שגריר": "ambassador",
        "שיוך לטלפנית": "telephonist_assignment",
        "בית כנסת": "synagogue",
        "סטטוס זכאות ללידים": "eligibility_status_for_leads",
        "ביקש לחזור בתאריך": "requested_return_date",
        "שיחה אחרונה עם טלפנית": "last_telephonist_call",
        "סטטוס שיחה אחרונה": "last_call_status",
        "הערות": "notes",
        "הערות טלפניות": "telephonist_notes",
        "תאור סטטוס": "status_description",
        "רחוב": "street",
        "מספר בניין": "building_number",
        "מספר דירה": "apartment_number",
        "עיר": "city",
        "שכונה": "neighborhood",
        "מיקוד": "postal_code",
        "מדינה": "country",
        "ארץ": "state",
        "כתובת למשלוח דואר": "mailing_address",
        "שם לקבלה": "recipient_name",
        "בנק": "bank",
        "שם בנק": "bank",
        "סניף": "branch",
        "מספר חשבון": "account_number",
        "מספר כרטיס אשראי": "credit_card_number",
        "האם הוק פעיל": "is_hok_active",
        "סכום הוק חודשי בש\"ח": "monthly_hok_amount_nis",
        "סכום תשלום אחרון": "last_payment_amount",
        "סכום תרומות ותשלומים בשנה האחרונה": "donations_payments_last_year",
        "תרומות בשנה האחרונה": "donations_payments_last_year",
        "סכום תרומות ותשלומים סהכ": "total_donations_payments",
        "התחייבות לתרומה": "donation_commitment",
        "יכולת תרומה": "donation_ability",
        "דינרים משתתפים": "dinners_participated",
        "סטטוס חסות/ברכה": "sponsorship_blessing_status",
        "תוכן הברכה דינר קודם": "blessing_content_dinner_2024",
        "הושבה גברים קודמת": "men_seating_feb",
        "הושבה זמני גברים": "men_temporary_seating_feb",
        "מספר שולחן": "men_table_number",
        "ליד מי תרצו לשבת": "seat_near_main",
        "הושבה נשים קודמת": "women_seating_feb",
        "הושבה זמני נשים": "women_temporary_seating_feb",
        "מספר שולחן נשים": "women_table_number",
        "השתתפות": "women_participation_dinner_feb",
    }
    
    # רשימה להחזרה - אופטימיזציה: השתמש ב-field_mapping לבניית ה-dict
    result = []
    for guest in guests:
        # כל השדות הקבועים תמיד (גם אם ריקים) - כדי שהטבלה תציג את כל העמודות
        guest_data = {}
        
        # טיפול מיוחד בשדות מיוחדים
        guest_data["id"] = guest.id
        guest_data["table_head_id"] = guest.table_head_id
        guest_data["gender"] = guest.gender or ""
        guest_data["confirmed_arrival"] = guest.confirmed_arrival
        
        # שדות בסיסיים שצריך להציג תמיד (גם אם ריקים)
        first_name_value = guest.first_name or ""
        
        guest_data["שם פרטי"] = first_name_value  # רק "שם פרטי"
        guest_data["שם משפחה"] = guest.last_name or ""
        
        # Add base fields with English keys (CRITICAL: before dynamic fields to prevent override)
        guest_data["first_name"] = first_name_value
        guest_data["last_name"] = guest.last_name or ""
        guest_data["phone"] = guest.mobile_phone or ""
        guest_data["email"] = guest.email or ""
        guest_data["city"] = guest.city or ""
        guest_data["home_phone"] = guest.home_phone or ""
        guest_data["alt_phone_1"] = guest.alt_phone_1 or ""
        guest_data["alt_phone_2"] = guest.alt_phone_2 or ""
        guest_data["email_2"] = guest.email_2 or ""
        guest_data["wife_phone"] = guest.wife_phone or ""
        guest_data["card_id"] = guest.card_id or ""
        guest_data["credit_card_number"] = guest.credit_card_number or ""
        guest_data["account_number"] = guest.account_number or ""
        guest_data["manager_personal_number"] = guest.manager_personal_number or ""
        guest_data["מספר אישי מניג'ר"] = guest.manager_personal_number or ""  # גם עם מפתח עברי
        guest_data["street"] = guest.street or ""
        guest_data["building_number"] = guest.building_number or ""
        guest_data["apartment_number"] = guest.apartment_number or ""
        # פרטים אישיים נוספים
        guest_data["title_before"] = guest.title_before or ""
        guest_data["title_after"] = guest.title_after or ""
        guest_data["middle_name"] = guest.middle_name or ""
        guest_data["wife_name"] = guest.wife_name or ""
        guest_data["spouse_name"] = guest.spouse_name or ""
        guest_data["age"] = guest.age if guest.age is not None else ""
        guest_data["language"] = guest.language or ""
        guest_data["id_number"] = guest.id_number or ""
        # כתובת נוספת
        guest_data["neighborhood"] = guest.neighborhood or ""
        guest_data["postal_code"] = guest.postal_code or ""
        guest_data["country"] = guest.country or ""
        guest_data["state"] = guest.state or ""
        guest_data["mailing_address"] = guest.mailing_address or ""
        guest_data["recipient_name"] = guest.recipient_name or ""
        # שיוך וניהול
        guest_data["groups"] = guest.groups or ""
        guest_data["email_group"] = guest.email_group or ""
        guest_data["user_link"] = guest.user_link or ""
        guest_data["ambassador_id"] = guest.ambassador_id or ""
        guest_data["ambassador"] = guest.ambassador or ""
        guest_data["telephonist_assignment"] = guest.telephonist_assignment or ""
        guest_data["synagogue"] = guest.synagogue or ""
        # בנקים
        guest_data["bank"] = guest.bank or ""
        guest_data["branch"] = guest.branch or ""
        # הערות וסטטוס
        guest_data["notes"] = guest.notes or ""
        guest_data["telephonist_notes"] = guest.telephonist_notes or ""
        guest_data["status_description"] = guest.status_description or ""
        guest_data["last_call_status"] = guest.last_call_status or ""
        guest_data["eligibility_status_for_leads"] = guest.eligibility_status_for_leads or ""
        # תרומות ותשלומים
        guest_data["monthly_hok_amount_nis"] = guest.monthly_hok_amount_nis or ""
        guest_data["last_payment_amount"] = guest.last_payment_amount or ""
        guest_data["donations_payments_last_year"] = guest.donations_payments_last_year or ""
        guest_data["total_donations_payments"] = guest.total_donations_payments or ""
        guest_data["donation_commitment"] = guest.donation_commitment or ""
        guest_data["donation_ability"] = guest.donation_ability or ""
        guest_data["dinners_participated"] = guest.dinners_participated or ""
        guest_data["sponsorship_blessing_status"] = guest.sponsorship_blessing_status or ""
        guest_data["blessing_content_dinner_2024"] = guest.blessing_content_dinner_2024 or ""
        guest_data["seat_near_main"] = guest.seat_near_main or ""
        # שדות DateTime שצריך להמיר ל-string
        datetime_fields = {
            "תאריך לידה": "birth_date",
            "ביקש לחזור בתאריך": "requested_return_date",
            "שיחה אחרונה עם טלפנית": "last_telephonist_call",
        }
        # הוסף תאריכים גם עם מפתחות באנגלית
        if guest.birth_date:
            guest_data["birth_date"] = str(guest.birth_date)
        else:
            guest_data["birth_date"] = ""
        if guest.requested_return_date:
            guest_data["requested_return_date"] = str(guest.requested_return_date)
        else:
            guest_data["requested_return_date"] = ""
        if guest.last_telephonist_call:
            guest_data["last_telephonist_call"] = str(guest.last_telephonist_call)
        else:
            guest_data["last_telephonist_call"] = ""
        # שדות Boolean
        boolean_fields = {
            "האם הוק פעיל": "is_hok_active",
        }
        # הוסף Boolean עם מפתח אנגלי
        guest_data["is_hok_active"] = guest.is_hok_active if guest.is_hok_active is not None else ""
        
        # בנה את ה-dictionary באמצעות field_mapping
        # אופטימיזציה: שולח רק שדות שיש להם ערך (לא ריקים) כדי להקטין את ה-payload
        # שדות בסיסיים שאסור שדות דינמיים ידרסו אותם (נשתמש בהם למטה בסיבוב של השדות הדינמיים)
        base_field_keys = {
            # מפתחות באנגלית (עמודות בטבלת guests)
            "id", "table_head_id", "gender", "confirmed_arrival",
            "first_name", "last_name", "phone", "email", "city",
            "home_phone", "alt_phone_1", "alt_phone_2", "email_2", "wife_phone",
            "card_id", "credit_card_number", "account_number", "manager_personal_number",
            "street", "building_number", "apartment_number",
            "middle_name", "title_before", "title_after",
            "spouse_name", "wife_name", "age", "language", "id_number",
            "neighborhood", "postal_code", "country", "state", "mailing_address", "recipient_name",
            "groups", "email_group", "user_link", "ambassador_id", "ambassador", "telephonist_assignment", "synagogue",
            "bank", "branch",
            "notes", "telephonist_notes", "status_description", "last_call_status", "eligibility_status_for_leads",
            "monthly_hok_amount_nis", "last_payment_amount", "donations_payments_last_year", "total_donations_payments",
            "donation_commitment", "donation_ability", "dinners_participated", "sponsorship_blessing_status",
            "blessing_content_dinner_2024", "seat_near_main", "is_hok_active",
            "birth_date", "requested_return_date", "last_telephonist_call",
            # שמות בעברית כפי שמופיעים בטבלה / במבנה
            "שם", "שם פרטי", "שם משפחה",
            "שם אמצעי", "תואר לפני", "תואר אחרי",
            "שם בן/בת הזוג", "שם האישה",
            "מספר נייד", "טלפון בית", "טלפון נוסף", "טלפון נוסף 2",
            "2 Email", "Email 2", "טלפון אשה",
            "CardID", "מספר כרטיס אשראי", "מספר חשבון", "מספר אישי מניג'ר", "מספר אישי מניגר",
            "רחוב", "מספר בניין", "מספר דירה",
            "גיל", "ת.ז./ח.פ.", "תעודת זהות", "שפה",
            "שכונה", "מיקוד", "מדינה", "ארץ", "כתובת למשלוח דואר", "שם לקבלה",
            "קבוצה", "קבוצות", "קבוצה מייל", "קישור למשתמש", "מזהה שגריר", "שגריר", "שיוך לטלפנית", "בית כנסת",
            "שם בנק", "בנק", "סניף",
            "הערות", "מאפיינים", "הערות טלפניות", "תאור סטטוס", "סטטוס שיחה אחרונה", "סטטוס זכאות ללידים",
            "ליד מי תרצו לשבת", "האם הוק פעיל", "סכום הוק חודשי בש\"ח", "סכום תשלום אחרון",
            "סכום תרומות ותשלומים בשנה האחרונה", "תרומות בשנה האחרונה", "סכום תרומות ותשלומים סהכ",
            "התחייבות לתרומה", "יכולת תרומה", "דינרים משתתפים", "סטטוס חסות/ברכה", "תוכן הברכה דינר קודם",
            "תאריך לידה", "ביקש לחזור בתאריך", "שיחה אחרונה עם טלפנית",
        }

        # שדות שכבר טיפלנו בהם ידנית למעלה (id, table_head_id, gender, confirmed_arrival, שם פרטי/משפחה)
        # אותם לא נרצה להוסיף שוב מה-field_mapping
        skip_in_field_mapping = {
            "id",
            "table_head_id",
            "gender",
            "confirmed_arrival",
            "שם",
            "שם פרטי",
            "שם משפחה",
        }

        for display_name, model_field in field_mapping.items():
            # דלג רק על השדות שטופלו ידנית קודם
            if display_name in skip_in_field_mapping:
                continue
            
            if display_name in datetime_fields:
                val = getattr(guest, model_field, None)
                if val:  # רק אם יש ערך
                    guest_data[display_name] = str(val)
            elif display_name in boolean_fields:
                val = getattr(guest, model_field, None)
                if val is not None:  # רק אם יש ערך (גם False נחשב ערך)
                    guest_data[display_name] = val
            else:
                val = getattr(guest, model_field, None)
                if val and str(val).strip():  # רק אם יש ערך ולא ריק
                    guest_data[display_name] = str(val).strip()
        
        # עוברת על כל שדה דינמי ומוסיפה ערך רק אם יש ערך (לא ריק)
        # השדות הדינמיים מוצגים רק אם יש להם ערך - כדי לא להגדיל את ה-payload
        # IMPORTANT: Only add dynamic fields if they don't override base fields (base_field_keys)
        for field in custom_fields_sorted:
            field_position = field_position_map.get(field.id)
            if field_position is not None:
                # קרא מהטבלה הראשית
                field_name = f"custom_field_{field_position}"
                value = getattr(guest, field_name) or ""
            else:
                # קרא מ-guest_field_values
                key = (guest.id, field.id)
                value = all_field_values.get(key, "")
            
            # תמיד הוסף את השדה (גם אם ערך ריק) כדי שכל העמודות מהאקסל יוצגו
            _, _, display_name, _ = decode_prefixed_name(field.name)
            # Only add if it's not a base field key (prevent override)
            if display_name not in base_field_keys:
                guest_data[display_name] = value

        # ודא שכל שדות מבנה הטבלה קיימים (גם אם ריקים)
        for col_name in ts_field_names:
            key = col_name.strip()
            if key and key not in guest_data:
                guest_data[key] = ""
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
    """
    יוצר ערך שדה. אם השדה הוא אחד מ-15 הראשונים, שומר בטבלה הראשית.
    אחרת, שומר ב-guest_field_values.
    """
    # בדוק אם השדה הוא אחד מ-15 הראשונים
    guest = db.query(models.Guest).filter(models.Guest.id == value.guest_id).first()
    if not guest:
        raise ValueError(f"Guest {value.guest_id} not found")
    
    field_position = get_field_position_in_table(db, guest.event_id, value.custom_field_id)
    
    if field_position is not None:
        # שמור בטבלה הראשית
        # מחק ערך קיים מ-guest_field_values אם יש (למקרה שהיה שם קודם)
        existing_value = db.query(models.GuestFieldValue).filter(
            models.GuestFieldValue.guest_id == value.guest_id,
            models.GuestFieldValue.custom_field_id == value.custom_field_id
        ).first()
        if existing_value:
            db.delete(existing_value)
        
        field_name = f"custom_field_{field_position}"
        setattr(guest, field_name, value.value)
        db.commit()
        db.refresh(guest)
        # מחזיר אובייקט מדומה כדי לשמור על תאימות
        class InlineFieldValue:
            def __init__(self, guest_id, custom_field_id, value):
                self.guest_id = guest_id
                self.custom_field_id = custom_field_id
                self.value = value
                self.id = None
        return InlineFieldValue(value.guest_id, value.custom_field_id, value.value)
    else:
        # שמור ב-guest_field_values
        # בדוק אם יש ערך קיים (update במקום create)
        existing_value = db.query(models.GuestFieldValue).filter(
            models.GuestFieldValue.guest_id == value.guest_id,
            models.GuestFieldValue.custom_field_id == value.custom_field_id
        ).first()
        
        if existing_value:
            existing_value.value = value.value
            db.commit()
            db.refresh(existing_value)
            return existing_value
        else:
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
        
        # מחיקת רשומות קשורות בטבלת guest_field_values
        field_values = db.query(models.GuestFieldValue).filter(models.GuestFieldValue.guest_id == guest_id).all()
        for field_value in field_values:
            db.delete(field_value)
        
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
