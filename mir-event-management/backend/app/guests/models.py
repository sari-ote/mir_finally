from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint, Boolean, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class Guest(Base):
    __tablename__ = "guests"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    id_number = Column(String, nullable=True)
    table_head_id = Column(Integer, ForeignKey("table_heads.id"), nullable=True)
    email = Column(String, nullable=True)
    gender = Column(String, nullable=False)
    confirmed_arrival = Column(Boolean, default=False)  # שדה חדש לאישור הגעה
    qr_code = Column(String, nullable=True)  # NEW: Unique QR code for each guest
    check_in_time = Column(DateTime, nullable=True)  # NEW: Time of check-in
    check_out_time = Column(DateTime, nullable=True)  # NEW: Time of check-out
    is_overbooked = Column(Boolean, default=False)  # NEW: If assigned to an overbooked spot
    last_scan_time = Column(DateTime, nullable=True)  # NEW: Last scan time
    
    # 15 שדות דינמיים - השדות הראשונים נשמרים כאן, מעבר לזה ב-guest_field_values
    custom_field_1 = Column(String, nullable=True)
    custom_field_2 = Column(String, nullable=True)
    custom_field_3 = Column(String, nullable=True)
    custom_field_4 = Column(String, nullable=True)
    custom_field_5 = Column(String, nullable=True)
    custom_field_6 = Column(String, nullable=True)
    custom_field_7 = Column(String, nullable=True)
    custom_field_8 = Column(String, nullable=True)
    custom_field_9 = Column(String, nullable=True)
    custom_field_10 = Column(String, nullable=True)
    custom_field_11 = Column(String, nullable=True)
    custom_field_12 = Column(String, nullable=True)
    custom_field_13 = Column(String, nullable=True)
    custom_field_14 = Column(String, nullable=True)
    custom_field_15 = Column(String, nullable=True)
    
    # פרטים אישיים
    middle_name = Column(String, nullable=True)  # שם אמצעי
    title_before = Column(String, nullable=True)  # תואר לפני
    title_after = Column(String, nullable=True)  # תואר אחרי
    spouse_name = Column(String, nullable=True)  # תואר בן זוג
    wife_name = Column(String, nullable=True)  # שם אישה
    age = Column(Integer, nullable=True)  # גיל
    birth_date = Column(DateTime, nullable=True)  # תאריך לידה
    language = Column(String, nullable=True)  # שפה

    # פרטי קשר
    mobile_phone = Column(String, nullable=True)  # מספר נייד
    home_phone = Column(String, nullable=True)  # טלפון בית
    alt_phone_1 = Column(String, nullable=True)  # טלפון נוסף
    alt_phone_2 = Column(String, nullable=True)  # טלפון נוסף 2
    email_2 = Column(String, nullable=True)  # 2 Email
    wife_phone = Column(String, nullable=True)  # טלפון אשה

    # מזהים
    account_number = Column(String, nullable=True)  # מספר חשבון
    manager_personal_number = Column(String, nullable=True)  # מספר אישי מניג'ר
    card_id = Column(String, nullable=True)  # CardID

    # שיוך וניהול
    groups = Column(String, nullable=True)  # קבוצה
    email_group = Column(String, nullable=True)  # קבוצה מייל
    user_link = Column(String, nullable=True)  # קישור למשתמש
    ambassador_id = Column(String, nullable=True)  # מזהה שגריר
    ambassador = Column(String, nullable=True)  # שגריר
    telephonist_assignment = Column(String, nullable=True)  # שיוך לטלפנית
    synagogue = Column(String, nullable=True)  # בית כנסת

    # טלפניות ושיחות
    eligibility_status_for_leads = Column(String, nullable=True)  # סטטוס זכאות ללידים
    requested_return_date = Column(DateTime, nullable=True)  # ביקש לחזור בתאריך
    last_telephonist_call = Column(DateTime, nullable=True)  # שיחה אחרונה עם טלפנית
    last_call_status = Column(String, nullable=True)  # סטטוס שיחה אחרונה
    notes = Column(String, nullable=True)  # הערות
    telephonist_notes = Column(String, nullable=True)  # הערות טלפניות
    status_description = Column(String, nullable=True)  # תאור סטטוס
    
    # מקור הרשמה
    registration_source = Column(String, nullable=True)  # מקור הרשמה: bot / form / manual / import

    # כתובת ראשית
    street = Column(String, nullable=True)  # רחוב
    building_number = Column(String, nullable=True)  # מספר בניין
    apartment_number = Column(String, nullable=True)  # מספר דירה
    city = Column(String, nullable=True)  # עיר
    neighborhood = Column(String, nullable=True)  # שכונה
    postal_code = Column(String, nullable=True)  # מיקוד
    country = Column(String, nullable=True)  # מדינה
    state = Column(String, nullable=True)  # ארץ
    mailing_address = Column(String, nullable=True)  # כתובת למשלוח דואר
    recipient_name = Column(String, nullable=True)  # שם לקבלה

    # בנקים ותשלומים
    bank = Column(String, nullable=True)  # שם בנק
    branch = Column(String, nullable=True)  # סניף
    credit_card_number = Column(String, nullable=True)  # מספר כרטיס אשראי

    # תרומות
    is_hok_active = Column(Boolean, nullable=True)  # האם הוק פעיל
    monthly_hok_amount_nis = Column(String, nullable=True)  # סכום הוק חודשי בש"ח
    last_payment_amount = Column(String, nullable=True)  # סכום תשלום אחרון
    donations_payments_last_year = Column(String, nullable=True)  # סכום תרומות ותשלומים בשנה האחרונה / תרומות בשנה האחרונה
    total_donations_payments = Column(String, nullable=True)  # סכום תרומות ותשלומים סהכ
    donation_commitment = Column(String, nullable=True)  # התחייבות לתרומה
    donation_ability = Column(String, nullable=True)  # יכולת תרומה


    # אירועים ודינרים
    dinners_participated = Column(String, nullable=True)  # דינרים משתתפים
    sponsorship_blessing_status = Column(String, nullable=True)  # סטטוס חסות/ברכה
    blessing_content_dinner_2024 = Column(String, nullable=True)  # תוכן הברכה דינר קודם

    # הושבות גברים
    men_seating_feb = Column(String, nullable=True)  # הושבה גברים קודמת
    men_temporary_seating_feb = Column(String, nullable=True)  # הושבה זמני גברים
    men_table_number = Column(String, nullable=True)  # מספר שולחן
    seat_near_main = Column(String, nullable=True)  # ליד מי תרצו לשבת

    # הושבות נשים
    women_seating_feb = Column(String, nullable=True)  # הושבה נשים קודמת
    women_temporary_seating_feb = Column(String, nullable=True)  # הושבה זמני נשים
    women_table_number = Column(String, nullable=True)  # מספר שולחן נשים
    women_participation_dinner_feb = Column(String, nullable=True)  # השתתפות

    
    # קשרים
    event = relationship("Event", back_populates="guests")
    seating = relationship("Seating", foreign_keys="[Seating.guest_id]", back_populates="guest", uselist=False)
    field_values = relationship("GuestFieldValue", back_populates="guest")
    greeting = relationship("Greeting", back_populates="guest", uselist=False)
    attendance_logs = relationship("AttendanceLog", back_populates="guest")
    realtime_notifications = relationship("RealTimeNotification", back_populates="guest")
    payments = relationship("Payment", back_populates="guest")

    __table_args__ = (UniqueConstraint('event_id', 'id_number', name='uq_event_guest'),)


class GuestCustomField(Base):
    __tablename__ = "guest_custom_fields"

    id = Column(Integer, primary_key=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    name = Column(String, nullable=False)
    field_type = Column(String, nullable=False)  # למשל: text, checkbox, select
    form_key = Column(String, nullable=True)

    # קשרים
    event = relationship("Event", back_populates="custom_fields")
    values = relationship("GuestFieldValue", back_populates="custom_field")


class GuestFieldValue(Base):
    __tablename__ = "guest_field_values"

    id = Column(Integer, primary_key=True)
    guest_id = Column(Integer, ForeignKey("guests.id"), nullable=False)
    custom_field_id = Column(Integer, ForeignKey("guest_custom_fields.id"), nullable=False)
    value = Column(String, nullable=True)

    # קשרים
    guest = relationship("Guest", back_populates="field_values")
    custom_field = relationship("GuestCustomField", back_populates="values")

class GuestFormShare(Base):
    __tablename__ = "guest_form_shares"

    id = Column(Integer, primary_key=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False, index=True)
    form_key = Column(String, nullable=False, index=True)
    token = Column(String, nullable=False, unique=True, index=True)
    is_active = Column(Boolean, nullable=False, default=True)
    allow_submissions = Column(Boolean, nullable=False, default=True)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    event = relationship("Event", back_populates="form_shares")
