from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from pydantic import validator
from datetime import datetime

# ---------- Guests ----------
class GuestBase(BaseModel):
    event_id: int
    first_name: str
    last_name: str
    id_number: str
    email: Optional[str] = None
    table_head_id: Optional[int] = None
    gender: str  # חובה
    confirmed_arrival: Optional[bool] = False
    qr_code: Optional[str] = None  # NEW: Unique QR code for each guest
    check_in_time: Optional[datetime] = None  # NEW: Time of check-in
    check_out_time: Optional[datetime] = None  # NEW: Time of check-out
    is_overbooked: Optional[bool] = False  # NEW: If assigned to an overbooked spot
    last_scan_time: Optional[datetime] = None  # NEW: Last scan time
    
    # 15 שדות דינמיים - השדות הראשונים נשמרים כאן
    custom_field_1: Optional[str] = None
    custom_field_2: Optional[str] = None
    custom_field_3: Optional[str] = None
    custom_field_4: Optional[str] = None
    custom_field_5: Optional[str] = None
    custom_field_6: Optional[str] = None
    custom_field_7: Optional[str] = None
    custom_field_8: Optional[str] = None
    custom_field_9: Optional[str] = None
    custom_field_10: Optional[str] = None
    custom_field_11: Optional[str] = None
    custom_field_12: Optional[str] = None
    custom_field_13: Optional[str] = None
    custom_field_14: Optional[str] = None
    custom_field_15: Optional[str] = None
    
    # פרטים אישיים
    middle_name: Optional[str] = None
    title_before: Optional[str] = None
    title_after: Optional[str] = None
    spouse_name: Optional[str] = None
    wife_name: Optional[str] = None
    age: Optional[int] = None
    birth_date: Optional[datetime] = None
    language: Optional[str] = None

    # פרטי קשר
    mobile_phone: Optional[str] = None
    home_phone: Optional[str] = None
    alt_phone_1: Optional[str] = None
    alt_phone_2: Optional[str] = None
    email_2: Optional[str] = None
    wife_phone: Optional[str] = None

    # מזהים
    account_number: Optional[str] = None
    manager_personal_number: Optional[str] = None
    card_id: Optional[str] = None

    # שיוך וניהול
    groups: Optional[str] = None
    email_group: Optional[str] = None
    user_link: Optional[str] = None
    ambassador_id: Optional[str] = None
    ambassador: Optional[str] = None
    telephonist_assignment: Optional[str] = None
    synagogue: Optional[str] = None

    # טלפניות ושיחות
    eligibility_status_for_leads: Optional[str] = None
    requested_return_date: Optional[datetime] = None
    last_telephonist_call: Optional[datetime] = None
    last_call_status: Optional[str] = None
    notes: Optional[str] = None
    telephonist_notes: Optional[str] = None
    status_description: Optional[str] = None

    # כתובת ראשית
    street: Optional[str] = None
    building_number: Optional[str] = None
    apartment_number: Optional[str] = None
    city: Optional[str] = None
    neighborhood: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    mailing_address: Optional[str] = None
    recipient_name: Optional[str] = None

    # בנקים ותשלומים
    bank: Optional[str] = None
    branch: Optional[str] = None
    credit_card_number: Optional[str] = None

    # תרומות
    is_hok_active: Optional[bool] = None
    monthly_hok_amount_nis: Optional[str] = None
    last_payment_amount: Optional[str] = None
    donations_payments_last_year: Optional[str] = None
    total_donations_payments: Optional[str] = None
    donation_commitment: Optional[str] = None
    donation_ability: Optional[str] = None

    # אירועים ודינרים
    dinners_participated: Optional[str] = None
    sponsorship_blessing_status: Optional[str] = None
    blessing_content_dinner_2024: Optional[str] = None

    # הושבות גברים
    men_seating_feb: Optional[str] = None
    men_temporary_seating_feb: Optional[str] = None
    men_table_number: Optional[str] = None
    seat_near_main: Optional[str] = None

    # הושבות נשים
    women_seating_feb: Optional[str] = None
    women_temporary_seating_feb: Optional[str] = None
    women_table_number: Optional[str] = None
    women_participation_dinner_feb: Optional[str] = None

    @validator('gender')
    def validate_gender(cls, v):
        if not v or not str(v).strip():
            return 'male'  # ברירת מחדל
        v = str(v).strip().lower()
        if v in ['male', 'female']:
            return v
        if v == 'זכר':
            return 'male'
        if v == 'נקבה':
            return 'female'
        # אם הערך לא מזוהה, נחזיר male כברירת מחדל
        return 'male'

class GuestCreate(GuestBase):
    pass

class GuestUpdate(BaseModel):
    first_name: str
    last_name: str
    id_number: str
    email: Optional[str] = None
    table_head_id: Optional[int] = None
    gender: str  # חובה
    confirmed_arrival: Optional[bool] = None
    qr_code: Optional[str] = None
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    is_overbooked: Optional[bool] = None
    last_scan_time: Optional[datetime] = None
    
    # 15 שדות דינמיים
    custom_field_1: Optional[str] = None
    custom_field_2: Optional[str] = None
    custom_field_3: Optional[str] = None
    custom_field_4: Optional[str] = None
    custom_field_5: Optional[str] = None
    custom_field_6: Optional[str] = None
    custom_field_7: Optional[str] = None
    custom_field_8: Optional[str] = None
    custom_field_9: Optional[str] = None
    custom_field_10: Optional[str] = None
    custom_field_11: Optional[str] = None
    custom_field_12: Optional[str] = None
    custom_field_13: Optional[str] = None
    custom_field_14: Optional[str] = None
    custom_field_15: Optional[str] = None
    
    # פרטים אישיים
    middle_name: Optional[str] = None
    title_before: Optional[str] = None
    title_after: Optional[str] = None
    spouse_name: Optional[str] = None
    wife_name: Optional[str] = None
    age: Optional[int] = None
    birth_date: Optional[datetime] = None
    language: Optional[str] = None

    # פרטי קשר
    mobile_phone: Optional[str] = None
    home_phone: Optional[str] = None
    alt_phone_1: Optional[str] = None
    alt_phone_2: Optional[str] = None
    email_2: Optional[str] = None
    wife_phone: Optional[str] = None

    # מזהים
    account_number: Optional[str] = None
    manager_personal_number: Optional[str] = None
    card_id: Optional[str] = None

    # שיוך וניהול
    groups: Optional[str] = None
    email_group: Optional[str] = None
    user_link: Optional[str] = None
    ambassador_id: Optional[str] = None
    ambassador: Optional[str] = None
    telephonist_assignment: Optional[str] = None
    synagogue: Optional[str] = None

    # טלפניות ושיחות
    eligibility_status_for_leads: Optional[str] = None
    requested_return_date: Optional[datetime] = None
    last_telephonist_call: Optional[datetime] = None
    last_call_status: Optional[str] = None
    notes: Optional[str] = None
    telephonist_notes: Optional[str] = None
    status_description: Optional[str] = None

    # כתובת ראשית
    street: Optional[str] = None
    building_number: Optional[str] = None
    apartment_number: Optional[str] = None
    city: Optional[str] = None
    neighborhood: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    mailing_address: Optional[str] = None
    recipient_name: Optional[str] = None

    # בנקים ותשלומים
    bank: Optional[str] = None
    branch: Optional[str] = None
    credit_card_number: Optional[str] = None

    # תרומות
    is_hok_active: Optional[bool] = None
    monthly_hok_amount_nis: Optional[str] = None
    last_payment_amount: Optional[str] = None
    donations_payments_last_year: Optional[str] = None
    total_donations_payments: Optional[str] = None
    donation_commitment: Optional[str] = None
    donation_ability: Optional[str] = None

    # אירועים ודינרים
    dinners_participated: Optional[str] = None
    sponsorship_blessing_status: Optional[str] = None
    blessing_content_dinner_2024: Optional[str] = None

    # הושבות גברים
    men_seating_feb: Optional[str] = None
    men_temporary_seating_feb: Optional[str] = None
    men_table_number: Optional[str] = None
    seat_near_main: Optional[str] = None

    # הושבות נשים
    women_seating_feb: Optional[str] = None
    women_temporary_seating_feb: Optional[str] = None
    women_table_number: Optional[str] = None
    women_participation_dinner_feb: Optional[str] = None

    @validator('gender')
    def validate_gender(cls, v):
        if not v or not str(v).strip():
            return 'male'
        v = str(v).strip().lower()
        if v in ['male', 'female']:
            return v
        if v == 'זכר':
            return 'male'
        if v == 'נקבה':
            return 'female'
        return 'male'

class GuestOut(GuestBase):
    id: int

    class Config:
        from_attributes = True


class GuestWithFields(BaseModel):
    guest: GuestOut
    fields: Dict[str, Optional[str]] = {}



# ---------- Custom Fields ----------
class CustomFieldBase(BaseModel):
    event_id: int
    name: str
    field_type: str  # "text", "checkbox", "select"

class CustomFieldCreate(CustomFieldBase):
    form_key: Optional[str] = None

class CustomFieldOut(CustomFieldBase):
    id: int
    form_key: Optional[str] = None

    class Config:
        from_attributes = True


# ---------- Field Values ----------
class FieldValueBase(BaseModel):
    guest_id: int
    custom_field_id: int
    value: str



class FieldValueOut(FieldValueBase):
    id: int

    class Config:
        from_attributes = True
        

# נשלח מהפרונט
class FieldValueInput(BaseModel):
    # guest_id עובר ב-URL ולכן לא חובה בגוף הבקשה
    guest_id: Optional[int] = None
    field_name: str
    value: str

# לשימוש פנימי בלבד
class FieldValueCreate(BaseModel):
    guest_id: int
    custom_field_id: int
    value: str

class FormShareCreate(BaseModel):
    form_key: str
    expires_at: Optional[datetime] = None
    allow_submissions: bool = True
    deactivate_existing: bool = True


class FormShareOut(BaseModel):
    id: int
    event_id: int
    form_key: str
    token: str
    is_active: bool
    allow_submissions: bool
    expires_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class PublicBaseField(BaseModel):
    key: str
    label: str
    field_type: str
    required: bool = False
    options: Optional[List[dict]] = None


class PublicCustomField(BaseModel):
    id: int
    label: str
    field_type: str
    required: bool = False
    options: Optional[List[dict]] = None


class PublicFormResponse(BaseModel):
    event_id: int
    event_name: str
    form_key: str
    share_token: str
    base_fields: List[PublicBaseField]
    custom_fields: List[PublicCustomField]


class PublicCustomFieldSubmission(BaseModel):
    field_id: int
    value: Optional[str] = None


class PublicFormBaseData(BaseModel):
    first_name: str
    last_name: str
    id_number: str = ""
    phone: Optional[str] = None
    email: Optional[str] = None
    referral_source: Optional[str] = None
    gender: str
    
    # שדות נוספים לטפסי עדכון ציבוריים (למשל women-seating-update)
    spouse_name: Optional[str] = None
    participation_women: Optional[str] = None
    participation_men: Optional[str] = None
    dial_code: Optional[str] = None

    class Config:
        # לאפשר שדות נוספים במידת הצורך (לצורך גמישות בטפסים ציבוריים)
        extra = "allow"


class PublicFormSubmission(BaseModel):
    base: PublicFormBaseData
    custom: List[PublicCustomFieldSubmission] = []
    extra: Optional[Dict[str, Any]] = None
