from datetime import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.config import settings
from app.guests import repository, schemas
from app.guests.constants import BASE_FORM_FIELDS
from app.guests.repository import get_form_field_id_by_label
from app.guests import models as guest_models
from app.payments import schemas as payment_schemas, repository as payment_repository
from app.tableHead import repository as tablehead_repository, schemas as tablehead_schemas
from app.greetings import service as greeting_service, schemas as greeting_schemas

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


@router.post("/forms/{token}/submit")
def submit_public_form(token: str, payload: schemas.PublicFormSubmission, db: Session = Depends(get_db)):
    share = _get_active_share_or_404(token, db)

    base = payload.base
    guest_data = schemas.GuestCreate(
        event_id=share.event_id,
        first_name=base.first_name.strip(),
        last_name=base.last_name.strip(),
        id_number=(base.id_number or "").strip(),
        address="",
        phone=(base.phone or "").strip() if base.phone else None,
        email=(base.email or "").strip() if base.email else None,
        referral_source=(base.referral_source or "").strip() if base.referral_source else None,
        gender=base.gender,
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
    }

    for key, label in mapping.items():
        value = extras.get(key)
        if value:
            _add_field_value_by_label(db, share.event_id, share.form_key, guest.id, label, value)

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


def _handle_new_donors_public_submission(db: Session, share, guest, base_data: schemas.PublicFormBaseData, extra_data: dict):
    # Reuse VIP logic for participation, blessing and extra guests handling
    _handle_vip_public_submission(db, share, guest, base_data, extra_data)


def _handle_women_seating_public_submission(db: Session, share, guest, base_data: schemas.PublicFormBaseData):
    extras = base_data.dict(exclude_unset=False)

    spouse_name = extras.get("spouse_name")
    if spouse_name:
        _add_field_value_by_label(db, share.event_id, share.form_key, guest.id, "שם בת זוג", spouse_name)

    if extras.get("participation_women"):
        _add_field_value_by_label(db, share.event_id, share.form_key, guest.id, 'עדכון השתתפות נשים דינר פ"נ *', extras.get("participation_women"))

    if extras.get("participation_men"):
        _add_field_value_by_label(db, share.event_id, share.form_key, guest.id, 'עדכון השתתפות גברים דינר פ"נ *', extras.get("participation_men"))

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

    for key, label in mapping.items():
        value = extras.get(key)
        if value:
            _add_field_value_by_label(db, share.event_id, share.form_key, guest.id, label, value)

    participation_men = extras.get("participation_men")
    participation_women = extras.get("participation_women")
    phone_value = extras.get("phone")
    email_value = extras.get("email")
    address_value = " ".join(filter(None, [extras.get("street"), extras.get("building_number"), extras.get("neighborhood"), extras.get("city")])).strip()
    donation_value = extras.get("donation_ability")
    remarks_value = extras.get("remarks")
    entered_by = extras.get("entered_by")

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
    }

    for key, label in mapping.items():
        value = extras.get(key)
        if value:
            _add_field_value_by_label(db, share.event_id, share.form_key, guest.id, label, value)

    extra_count = extras.get("extra_guests_count") or extra_data.get("extra_guests_count")
    if extra_count is not None:
        _add_field_value_by_label(db, share.event_id, share.form_key, guest.id, 'הבאת אורח/ת נוסף/ת *', extra_count)

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

