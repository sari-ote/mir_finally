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
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    referral_source: Optional[str] = None
    table_head_id: Optional[int] = None
    gender: str  # חובה
    confirmed_arrival: Optional[bool] = False
    whatsapp_number: Optional[str] = None  # מספר וואטסאפ לבוט
    qr_code: Optional[str] = None  # NEW: Unique QR code for each guest
    check_in_time: Optional[datetime] = None  # NEW: Time of check-in
    check_out_time: Optional[datetime] = None  # NEW: Time of check-out
    is_overbooked: Optional[bool] = False  # NEW: If assigned to an overbooked spot
    last_scan_time: Optional[datetime] = None  # NEW: Last scan time

    @validator('gender')
    def validate_gender(cls, v):
        v = v.lower()
        if v in ['male', 'female']:
            return v
        if v == 'זכר':
            return 'male'
        if v == 'נקבה':
            return 'female'
        raise ValueError("gender must be 'male', 'female', 'זכר' או 'נקבה'")

class GuestCreate(GuestBase):
    pass

class GuestUpdate(BaseModel):
    first_name: str
    last_name: str
    id_number: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    referral_source: Optional[str] = None
    table_head_id: Optional[int] = None
    gender: str  # חובה
    confirmed_arrival: Optional[bool] = None
    whatsapp_number: Optional[str] = None  # מספר וואטסאפ לבוט
    qr_code: Optional[str] = None  # NEW: Unique QR code for each guest
    check_in_time: Optional[datetime] = None  # NEW: Time of check-in
    check_out_time: Optional[datetime] = None  # NEW: Time of check-out
    is_overbooked: Optional[bool] = None  # NEW: If assigned to an overbooked spot
    last_scan_time: Optional[datetime] = None  # NEW: Last scan time

    @validator('gender')
    def validate_gender(cls, v):
        v = v.lower()
        if v in ['male', 'female']:
            return v
        if v == 'זכר':
            return 'male'
        if v == 'נקבה':
            return 'female'
        raise ValueError("gender must be 'male', 'female', 'זכר' או 'נקבה'")

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
    guest_id: int
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

    class Config:
        extra = "allow"


class PublicFormSubmission(BaseModel):
    base: PublicFormBaseData
    custom: List[PublicCustomFieldSubmission] = []
    extra: Optional[Dict[str, Any]] = None
