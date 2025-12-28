import csv
import os
import tempfile
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from typing import Optional, List, Dict, Any, Set

import pandas as pd
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError

from app.core.database import SessionLocal
from app.imports import repository
from app.guests import models as guest_models
from app.guests import repository as guests_repo
from app.tableStructure import repository as table_structure_repo

# Executor קטן לעיבוד ברקע
executor = ThreadPoolExecutor(max_workers=2)


def _safe_update(db, job_id: int, **kwargs):
    try:
        repository.update_job_status(db, job_id, **kwargs)
    except Exception as e:
        print(f"[import-job] failed to update job {job_id}: {e}")


def _process_file(job_id: int, event_id: int, file_path: str, created_by: Optional[int] = None, batch_size: int = 500):
    db = SessionLocal()
    try:
        _safe_update(db, job_id, status="running", started_at=datetime.utcnow())

        # המרה ל-CSV אם XLSX
        work_path = file_path
        cleanup_path = None
        if file_path.lower().endswith((".xlsx", ".xls")):
            # קרא את כל השורות, כולל שורות ריקות
            # חשוב: na_values=[] ו-keep_default_na=False מונעים מ-pandas להפסיק לקרוא שורות ריקות
            engine = 'openpyxl' if file_path.lower().endswith('.xlsx') else 'xlrd'
            print(f"[import-job] Reading Excel file with engine={engine}")
            df = pd.read_excel(file_path, engine=engine, keep_default_na=False, na_values=[])
            print(f"[import-job] Excel file read: {len(df)} rows, {len(df.columns)} columns")
            cleanup_path = tempfile.NamedTemporaryFile(delete=False, suffix=".csv").name
            df.to_csv(cleanup_path, index=False, na_rep='')
            print(f"[import-job] CSV saved to {cleanup_path}")
            work_path = cleanup_path

        total_rows = 0
        processed_rows = 0
        success_count = 0
        error_count = 0
        errors = []

        # קרא את כל השורות קודם כדי לדעת כמה יש
        print(f"[import-job] Starting to read file: {work_path}")
        all_rows = []
        try:
            with open(work_path, "r", encoding="utf-8", newline="") as f:
                reader = csv.DictReader(f)
                print(f"[import-job] Reading CSV file...")
                all_rows = list(reader)
                total_rows = len(all_rows)
                print(f"[import-job] Read {total_rows} rows from file")
        except UnicodeDecodeError:
            # נסה עם encoding אחר
            print(f"[import-job] UTF-8 failed, trying UTF-8-sig...")
            try:
                with open(work_path, "r", encoding="utf-8-sig", newline="") as f:
                    reader = csv.DictReader(f)
                    all_rows = list(reader)
                    total_rows = len(all_rows)
                    print(f"[import-job] Read {total_rows} rows from file (UTF-8-sig)")
            except Exception as e:
                print(f"[import-job] failed to read file {work_path}: {e}")
                raise
        except Exception as e:
            print(f"[import-job] failed to read file {work_path}: {e}")
            raise

        # עדכן את total_rows מיד
        if total_rows == 0:
            print(f"[import-job] File is empty, marking as failed")
            _safe_update(db, job_id, status="failed", finished_at=datetime.utcnow())
            return

        # עדכן את מבנה הטבלה הגלובלי לפי העמודות של הקובץ
        if all_rows:
            column_names = list(all_rows[0].keys())  # שמות העמודות מהקובץ
            base_fields = ["id", "table_head_id", "confirmed_arrival"]
            print(f"[import-job] Updating global table structure with {len(column_names)} columns")
            try:
                table_structure_repo.update_table_structure_from_columns(db, column_names, base_fields)
                print(f"[import-job] Global table structure updated successfully")
            except Exception as e:
                print(f"[import-job] Warning: Failed to update table structure: {e}")

        print(f"[import-job] Updating job {job_id} with total_rows={total_rows}")
        _safe_update(db, job_id, total_rows=total_rows)
        print(f"[import-job] Starting to process {total_rows} rows in batches of {batch_size}")

        # עבד את השורות בבאצ'ים
        rows_buffer = []
        batch_count = 0
        for idx, row in enumerate(all_rows):
            rows_buffer.append(row)

            if len(rows_buffer) >= batch_size:
                batch_count += 1
                print(f"[import-job] Processing batch {batch_count} ({len(rows_buffer)} rows)...")
                try:
                    ok, err, batch_errors = _process_batch(db, rows_buffer, event_id, job_id, processed_rows)
                    processed_rows += len(rows_buffer)
                    success_count += ok
                    error_count += err
                    errors.extend(batch_errors)
                except Exception as batch_e:
                    import traceback
                    error_msg = f"[import-job] Batch {batch_count} failed: {batch_e}\n{traceback.format_exc()}"
                    print(error_msg)
                    # Mark all rows in this batch as errors
                    processed_rows += len(rows_buffer)
                    error_count += len(rows_buffer)
                    for row in rows_buffer:
                        errors.append({
                            "first_name": row.get("שם", row.get("first_name", "")),
                            "last_name": row.get("שם משפחה", row.get("last_name", "")),
                            "error": f"Batch processing failed: {str(batch_e)}"
                        })
                finally:
                    rows_buffer = []
                
                # עדכן את הסטטוס אחרי כל batch
                _safe_update(
                    db,
                    job_id,
                    processed_rows=processed_rows,
                    success_count=success_count,
                    error_count=error_count,
                )
                print(f"[import-job] Batch {batch_count} completed: {processed_rows}/{total_rows} rows processed")
            
            # עדכן כל 100 שורות גם אם לא סיימנו batch (למעקב התקדמות)
            if (idx + 1) % 100 == 0 and len(rows_buffer) < batch_size:
                _safe_update(db, job_id, processed_rows=processed_rows)

        # שאריות
        if rows_buffer:
            try:
                ok, err, batch_errors = _process_batch(db, rows_buffer, event_id, job_id, processed_rows)
                processed_rows += len(rows_buffer)
                success_count += ok
                error_count += err
                errors.extend(batch_errors)
            except Exception as batch_e:
                import traceback
                error_msg = f"[import-job] Final batch failed: {batch_e}\n{traceback.format_exc()}"
                print(error_msg)
                # Mark all rows in this batch as errors
                processed_rows += len(rows_buffer)
                error_count += len(rows_buffer)
                for row in rows_buffer:
                    errors.append({
                        "first_name": row.get("שם", row.get("first_name", "")),
                        "last_name": row.get("שם משפחה", row.get("last_name", "")),
                        "error": f"Batch processing failed: {str(batch_e)}"
                    })

        error_log_path = None
        if errors:
            os.makedirs("uploads/imports", exist_ok=True)
            error_log_path = os.path.join("uploads", "imports", f"import_job_{job_id}_errors.csv")
            _write_errors_csv(error_log_path, errors)

        status = "success" if error_count == 0 else "partial"
        _safe_update(
            db,
            job_id,
            status=status,
            total_rows=total_rows,
            processed_rows=processed_rows,
            success_count=success_count,
            error_count=error_count,
            error_log_path=error_log_path,
            finished_at=datetime.utcnow(),
        )
    except Exception as e:
        import traceback
        error_msg = f"[import-job] job {job_id} failed: {e}\n{traceback.format_exc()}"
        print(error_msg)
        try:
            _safe_update(
                db,
                job_id,
                status="failed",
                total_rows=total_rows if 'total_rows' in locals() else 0,
                processed_rows=processed_rows if 'processed_rows' in locals() else 0,
                success_count=success_count if 'success_count' in locals() else 0,
                error_count=error_count if 'error_count' in locals() else 0,
                error_log_path=None,
                finished_at=datetime.utcnow(),
            )
        except Exception as update_error:
            print(f"[import-job] failed to update job {job_id} status: {update_error}")
    finally:
        db.close()
        if cleanup_path and os.path.exists(cleanup_path):
            try:
                os.remove(cleanup_path)
            except Exception:
                pass


def _normalize_id(raw: str) -> str:
    return "".join(ch for ch in (raw or "") if ch.isdigit())


def _get_all_field_mappings() -> Dict[str, str]:
    """מיפוי מלא של כל השדות בטבלת guests - מכל שם אפשרי לעמודה ב-DB"""
    return {
        # שדות בסיסיים
        "שם": "first_name",
        "first_name": "first_name",
        "שם פרטי": "first_name",
        "שם_פרטי": "first_name",
        "שם משפחה": "last_name",
        "last_name": "last_name",
        "שם_משפחה": "last_name",
        "gender": "gender",
        "מגדר": "gender",
        "מין": "gender",
        "תעודת זהות": "id_number",
        "id_number": "id_number",
        "ת.ז": "id_number",
        "תז": "id_number",
        "ת.ז./ח.פ.": "id_number",
        "מספר זהות": "id_number",
        "מזהה": "id_number",
        "טלפון": "phone",
        "phone": "phone",
        "טלפון נייד": "phone",
        "מספר טלפון": "phone",
        # "מספר נייד" ממופה בשורה 290 ל-mobile_phone (השדה הנכון במודל)
        "אימייל": "email",
        "email": "email",
        "מייל": "email",
        "דואר אלקטרוני": "email",
        "כתובת": "address",
        "address": "address",
        "כתובת מגורים": "address",
        "מקור הפניה": "referral_source",
        "referral_source": "referral_source",
        "מקור": "referral_source",
        "מספר וואטסאפ": "whatsapp_number",
        "whatsapp_number": "whatsapp_number",
        "וואטסאפ": "whatsapp_number",
        "whatsapp": "whatsapp_number",
        
        # פרטים אישיים
        "שם אמצעי": "middle_name",
        "middle_name": "middle_name",
        "שם פרטי מחולק": "first_name_split",
        "first_name_split": "first_name_split",
        "שם משפחה מחולק": "last_name_split",
        "last_name_split": "last_name_split",
        "שם פרטי ללא אשה": "first_name_without_wife",
        "first_name_without_wife": "first_name_without_wife",
        "תואר לפני": "title_before",
        "title_before": "title_before",
        "תואר אחרי": "title_after",
        "title_after": "title_after",
        "כינוי": "nickname",
        "nickname": "nickname",
        "שם בן/בת הזוג": "spouse_name",
        "spouse_name": "spouse_name",
        "שם האישה": "wife_name",
        "wife_name": "wife_name",
        "שם אישה לדינר פד": "wife_name_dinner",
        "wife_name_dinner": "wife_name_dinner",
        "גיל": "age",
        "age": "age",
        "תאריך לידה": "birth_date",
        "birth_date": "birth_date",
        "קוד תלמיד": "student_code",
        "student_code": "student_code",
        "שפה": "language",
        "language": "language",
        
        # פרטי קשר
        "מספר נייד": "mobile_phone",
        "mobile_phone": "mobile_phone",
        "טלפון בית": "home_phone",
        "home_phone": "home_phone",
        "טלפון_בית": "home_phone",  # עם קו תחתון
        "טלפון ביתי": "home_phone",  # וריאציה
        "טלפון נוסף": "alt_phone_1",
        "alt_phone_1": "alt_phone_1",
        "טלפון נוסף 2": "alt_phone_2",
        "alt_phone_2": "alt_phone_2",
        "Email 2": "email_2",
        "email_2": "email_2",
        "מייל נוסף": "alt_email",
        "alt_email": "alt_email",
        "מייל עבודה": "work_email",
        "work_email": "work_email",
        "טלפון אשה": "wife_phone",
        "wife_phone": "wife_phone",
        
        # מזהים
        "מזהה": "identifier",
        "identifier": "identifier",
        "מזהה יבוא": "import_identifier",
        "import_identifier": "import_identifier",
        "מספר אישי מניג'ר": "manager_personal_number",
        "מספר אישי מניגר": "manager_personal_number",  # גרסה ללא גרש (אחרי _clean_key)
        "manager_personal_number": "manager_personal_number",
        "CardID": "card_id",
        "card_id": "card_id",
        "Card ID": "card_id",  # עם רווח (אחרי _clean_key)
        "CARDID": "card_id",  # באותיות גדולות
        "CARD_ID": "card_id",  # עם קו תחתון
        "Card_Id": "card_id",  # וריאציה
        "RAF": "raf",
        "raf": "raf",
        "ID ממערכת קודמת": "previous_system_id",
        "previous_system_id": "previous_system_id",
        
        # שיוך וניהול
        "קבוצות": "groups",
        "groups": "groups",
        "קבוצה מייל": "email_group",
        "email_group": "email_group",
        "קישור למשתמש": "user_link",
        "user_link": "user_link",
        "מזהה שגריר": "ambassador_id",
        "ambassador_id": "ambassador_id",
        "שגריר": "ambassador",
        "ambassador": "ambassador",
        "מסומן כשגריר": "marked_as_ambassador",
        "marked_as_ambassador": "marked_as_ambassador",
        "סטטוס לשגריר": "ambassador_status",
        "ambassador_status": "ambassador_status",
        "סוג תצוגה": "display_type",
        "display_type": "display_type",
        "שיוך לטלפנית": "telephonist_assignment",
        "telephonist_assignment": "telephonist_assignment",
        "עדכון טלפנית": "telephonist_update",
        "telephonist_update": "telephonist_update",
        "קטגוריה": "category",
        "category": "category",
        "קטגוריה נשים": "women_category",
        "women_category": "women_category",
        "סיווג להזמנה": "invitation_classification",
        "invitation_classification": "invitation_classification",
        "מקור הגעה": "arrival_source",
        "arrival_source": "arrival_source",
        "בית כנסת": "synagogue",
        "synagogue": "synagogue",
        "סטאטוס טיפול": "treatment_status",
        "treatment_status": "treatment_status",
        
        # טלפניות ושיחות
        "סטטוס זכאות ללידים": "eligibility_status_for_leads",
        "eligibility_status_for_leads": "eligibility_status_for_leads",
        "ביקש לחזור בתאריך": "requested_return_date",
        "requested_return_date": "requested_return_date",
        "שיחה אחרונה עם טלפנית": "last_telephonist_call",
        "last_telephonist_call": "last_telephonist_call",
        "סטטוס שיחה אחרונה": "last_call_status",
        "last_call_status": "last_call_status",
        "הערות": "notes",
        "notes": "notes",
        "הערות טלפניות": "telephonist_notes",
        "telephonist_notes": "telephonist_notes",
        "תאור סטטוס": "status_description",
        "status_description": "status_description",
        
        # כתובת ראשית
        "רחוב": "street",
        "street": "street",
        "מספר בניין": "building_number",
        "building_number": "building_number",
        "מספר דירה": "apartment_number",
        "apartment_number": "apartment_number",
        "עיר": "city",
        "city": "city",
        "שכונה": "neighborhood",
        "neighborhood": "neighborhood",
        "מיקוד": "postal_code",
        "postal_code": "postal_code",
        "מדינה": "country",
        "country": "country",
        "ארץ": "state",
        "state": "state",
        "כתובת למשלוח דואר": "mailing_address",
        "mailing_address": "mailing_address",
        "שם לקבלה": "recipient_name",
        "recipient_name": "recipient_name",
        
        # בנקים ותשלומים
        "בנק": "bank",
        "bank": "bank",
        "סניף": "branch",
        "branch": "branch",
        "מספר חשבון": "account_number",
        "account_number": "account_number",
        "שם בבנק": "bank_account_name",
        "bank_account_name": "bank_account_name",
        "מספר כרטיס אשראי": "credit_card_number",
        "credit_card_number": "credit_card_number",
        "מספר_כרטיס_אשראי": "credit_card_number",  # עם קו תחתון
        "כרטיס אשראי": "credit_card_number",  # בלי "מספר"
        "מספר כרטיס": "credit_card_number",  # קיצור
        "כרטיס אשראי מספר": "credit_card_number",  # סדר הפוך
        
        # תרומות
        "האם הוק פעיל": "is_hok_active",
        "is_hok_active": "is_hok_active",
        "הוק פעיל": "active_hok",
        "active_hok": "active_hok",
        "כמות הוק 05/2024": "hok_amount_05_2024",
        "hok_amount_05_2024": "hok_amount_05_2024",
        "סכום הוק חודשי ₪": "monthly_hok_amount",
        "monthly_hok_amount": "monthly_hok_amount",
        "תרומה": "donation",
        "donation": "donation",
        "תשלום": "payment",
        "payment": "payment",
        "סכום הוק חודשי 05-24": "hok_amount_05_24",
        "hok_amount_05_24": "hok_amount_05_24",
        "ריכוז שליחת קבלות": "receipt_sending_concentration",
        "receipt_sending_concentration": "receipt_sending_concentration",
        "תאריך תשלום אחרון": "last_payment_date",
        "last_payment_date": "last_payment_date",
        "סכום תשלום אחרון": "last_payment_amount",
        "last_payment_amount": "last_payment_amount",
        "תאריך עסקה אחרונה": "last_transaction_date",
        "last_transaction_date": "last_transaction_date",
        "סכום עסקה אחרונה": "last_transaction_amount",
        "last_transaction_amount": "last_transaction_amount",
        "סכום תרומות ותשלומים בשנה האחרונה": "donations_payments_last_year",
        "donations_payments_last_year": "donations_payments_last_year",
        "סכום תרומות ותשלומים סהכ": "total_donations_payments",
        "total_donations_payments": "total_donations_payments",
        "הגבוה לתרומה חד פעמית": "max_one_time_donation",
        "max_one_time_donation": "max_one_time_donation",
        "הגבוה לתרומה בהוראת קבע": "max_recurring_donation",
        "max_recurring_donation": "max_recurring_donation",
        "התחייבות לתרומה": "donation_commitment",
        "donation_commitment": "donation_commitment",
        "יכולת תרומה": "donation_ability",
        "donation_ability": "donation_ability",
        
        # היסטוריית תרומות
        "תרומות 2019": "donations_2019",
        "donations_2019": "donations_2019",
        "תרומות 2020": "donations_2020",
        "donations_2020": "donations_2020",
        "סהכ תרומות 2021": "total_donations_2021",
        "total_donations_2021": "total_donations_2021",
        "סהכ תרומות 2022": "total_donations_2022",
        "total_donations_2022": "total_donations_2022",
        "סהכ תרומות 2023": "total_donations_2023",
        "total_donations_2023": "total_donations_2023",
        "סהכ תרומות 2024": "total_donations_2024",
        "total_donations_2024": "total_donations_2024",
        "סהכ תרומות 2019-2023": "total_donations_2019_2023",
        "total_donations_2019_2023": "total_donations_2019_2023",
        "תרמו השנה 2024": "donated_this_year_2024",
        "donated_this_year_2024": "donated_this_year_2024",
        "סהכ תרומות": "total_donations",
        "total_donations": "total_donations",
        
        # אירועים ודינרים
        "דינרים משתתפים": "dinners_participated",
        "dinners_participated": "dinners_participated",
        "משוייך לדינרים": "assigned_to_dinners",
        "assigned_to_dinners": "assigned_to_dinners",
        "דינר 2024 מוזמנים לפי סכום": "dinner_2024_invited_by_amount",
        "dinner_2024_invited_by_amount": "dinner_2024_invited_by_amount",
        "דינר 2022 מוזמנים": "dinner_2022_invited",
        "dinner_2022_invited": "dinner_2022_invited",
        "הושבה דינר פב": "seating_dinner_feb",
        "seating_dinner_feb": "seating_dinner_feb",
        "הושבה דינר 2019": "seating_dinner_2019",
        "seating_dinner_2019": "seating_dinner_2019",
        "השתתפות דינר פב": "participation_dinner_feb",
        "participation_dinner_feb": "participation_dinner_feb",
        "סטטוס חסות/ברכה": "sponsorship_blessing_status",
        "sponsorship_blessing_status": "sponsorship_blessing_status",
        "שם רכז איש קשר דינר": "dinner_contact_person_name",
        "dinner_contact_person_name": "dinner_contact_person_name",
        "שם מלא איש קשר דינר": "dinner_contact_person_full_name",
        "dinner_contact_person_full_name": "dinner_contact_person_full_name",
        "תוכן הברכה דינר תשפד": "blessing_content_dinner_2024",
        "blessing_content_dinner_2024": "blessing_content_dinner_2024",
        "שם חותם הברכה תשפד": "blessing_signer_2024",
        "blessing_signer_2024": "blessing_signer_2024",
        "הוספת לוגו תשפד": "add_logo_2024",
        "add_logo_2024": "add_logo_2024",
        "אופן אישור הגעה": "arrival_confirmation_method",
        "arrival_confirmation_method": "arrival_confirmation_method",
        "השתתפות זוגית": "couple_participation",
        "couple_participation": "couple_participation",
        
        # הושבות גברים
        "הושבה גברים פד": "men_seating_feb",
        "men_seating_feb": "men_seating_feb",
        "הושבה זמני גברים פד": "men_temporary_seating_feb",
        "men_temporary_seating_feb": "men_temporary_seating_feb",
        "מספר שולחן גברים": "men_table_number",
        "men_table_number": "men_table_number",
        "השתתפות גברים דינר פד": "men_participation_dinner_feb",
        "men_participation_dinner_feb": "men_participation_dinner_feb",
        "הגיע לדינר פד גברים": "men_arrived_dinner_feb",
        "men_arrived_dinner_feb": "men_arrived_dinner_feb",
        
        # הושבות נשים
        "הושבה נשים פד": "women_seating_feb",
        "women_seating_feb": "women_seating_feb",
        "הושבה זמני נשים פד": "women_temporary_seating_feb",
        "women_temporary_seating_feb": "women_temporary_seating_feb",
        "מספר שולחן נשים": "women_table_number",
        "women_table_number": "women_table_number",
        "השתתפות נשים דינר פד": "women_participation_dinner_feb",
        "women_participation_dinner_feb": "women_participation_dinner_feb",
        "הגיע לדינר פד נשים": "women_arrived_dinner_feb",
        "women_arrived_dinner_feb": "women_arrived_dinner_feb",
        "תואר לפני נשים": "women_title_before",
        "women_title_before": "women_title_before",
        
        # כללי
        "סגנון שולחן": "table_style",
        "table_style": "table_style",
        "הושבה שולחן זמני דינר פד": "temporary_table_seating_dinner_feb",
        "temporary_table_seating_dinner_feb": "temporary_table_seating_dinner_feb",
        "ליד מי תרצו לשבת": "seat_near_main",
        "seat_near_main": "seat_near_main",
        "ליד מי תרצו לשבת (משתתף 1)": "seat_near_participant_1",
        "seat_near_participant_1": "seat_near_participant_1",
        "ליד מי תרצו לשבת (משתתף 2)": "seat_near_participant_2",
        "seat_near_participant_2": "seat_near_participant_2",
        "סטאטוס תורם": "donor_status",
        "donor_status": "donor_status",
        "סגנון תורם": "donor_style",
        "donor_style": "donor_style",
        "סגנון עיסוק": "occupation_style",
        "occupation_style": "occupation_style",
        "סטטוס גביה דינר פד": "collection_status_dinner_feb",
        "collection_status_dinner_feb": "collection_status_dinner_feb",
        "בדיקה טפסים": "form_check",
        "form_check": "form_check",
        "לא משתתף": "not_participating",
        "not_participating": "not_participating",
        "לוחית רישוי": "license_plate",
        "license_plate": "license_plate",
        "כניסה לחניה": "parking_entry",
        "parking_entry": "parking_entry",
    }


def _get_field_value(row: Dict[str, Any], possible_keys: List[str]) -> str:
    """מחפש ערך בעמודה עם כמה אפשרויות של שמות"""
    for key in possible_keys:
        # נסה עם השם המדויק
        if key in row:
            val = str(row[key] or "").strip()
            if val:
                return val
        # נסה עם trim (למקרה שיש רווחים מיותרים)
        for row_key in row.keys():
            if row_key.strip() == key.strip():
                val = str(row[row_key] or "").strip()
                if val:
                    return val
    return ""


def _convert_value(value: Any, field_type: type) -> Any:
    """המרת ערך לפי סוג השדה"""
    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    
    if field_type == bool:
        val_str = str(value).strip().lower()
        return val_str in ["true", "1", "yes", "כן", "יש", "✓"]
    elif field_type == int:
        try:
            return int(float(str(value).replace(",", "").strip()))
        except (ValueError, TypeError):
            return None
    elif field_type == datetime:
        # If value is already a datetime object, return as-is
        if isinstance(value, datetime):
            return value
        # If value is a date object, convert to datetime
        from datetime import date
        if isinstance(value, date) and not isinstance(value, datetime):
            return datetime.combine(value, datetime.min.time())
        # Try parsing string formats
        try:
            val_str = str(value).strip()
            for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"]:
                try:
                    return datetime.strptime(val_str, fmt)
                except ValueError:
                    continue
            return None
        except (ValueError, TypeError):
            return None
    else:
        result = str(value).strip() if value is not None else None
        return result if result else None


def _clean_key(key: str) -> str:
    """
    מנרמל כותרת עמודה: מסיר BOM, גרשיים, רווחים מיותרים.
    """
    if not key:
        return ""
    import re
    # Strip whitespace
    cleaned = key.strip()
    # Remove BOM if exists
    if cleaned.startswith('\ufeff'):
        cleaned = cleaned[1:]
    # Remove double quotes and single quotes
    cleaned = cleaned.replace('"', '').replace('"', '').replace("'", '').replace("'", '')
    # Replace multiple spaces with single space
    cleaned = re.sub(r'\s+', ' ', cleaned)
    return cleaned.strip()


def _process_batch(db, rows: List[Dict[str, Any]], event_id: int, job_id: int, batch_start_index: int = 0):
    """
    ולידציה בסיסית + יצירה/עדכון אורחים בבאץ' + כל השדות מהקובץ.
    משתמש במיפוי מלא של כל השדות בטבלת guests.
    
    Args:
        db: Database session
        rows: List of row dictionaries
        event_id: Event ID
        job_id: Import job ID (for TEMP ID generation)
        batch_start_index: Global row index of first row in this batch (for TEMP ID uniqueness)
    """
    print(f"[import-job] _process_batch: Processing {len(rows)} rows for event {event_id}, job {job_id}, batch_start_index {batch_start_index}")
    
    # Normalize all row keys first
    rows_cleaned = []
    for row in rows:
        row_clean = {_clean_key(k): v for k, v in row.items() if k}
        rows_cleaned.append(row_clean)
    rows = rows_cleaned
    ok = 0  # Will be computed after successful commit
    err = 0
    errors: List[Dict[str, Any]] = []
    row_ok_flags = [False] * len(rows)  # Track success per row, compute ok after commit
    
    # Counters for logging
    rows_total = len(rows)
    found_existing_count = 0
    updated_count = 0
    created_count = 0
    dynamic_values_updated = 0
    dynamic_values_created = 0
    skipped_missing_id_count = 0
    temp_id_generated_count = 0  # Track TEMP ID generation

    # טען את המיפוי המלא
    field_mappings = _get_all_field_mappings()
    print(f"[import-job] _process_batch: Loaded field mappings")
    
    # קבל את כל שמות השדות בטבלת Guest (needed for fallback_base_map)
    guest_model_fields = {col.name: col for col in guest_models.Guest.__table__.columns}
    
    # Fallback base map - hardcoded mapping for basic fields (Hebrew -> DB field)
    fallback_base_map = {
        "שם פרטי": "first_name",
        "שם משפחה": "last_name",
        "מספר נייד": "mobile_phone",  # תיקון: mobile_phone הוא השדה הקיים במודל
        "אימייל": "email",
        "מייל": "email",
        "עיר": "city",
        "רחוב": "street",
        "ת.ז./ח.פ.": "id_number",
        "תז": "id_number",
        "ת.ז": "id_number",
        "מזהה": "id_number",
        "מזהה יבוא": "id_number",
    }
    
    # Add optional fields only if they exist in the model
    if "home_phone" in guest_model_fields:
        fallback_base_map["טלפון בית"] = "home_phone"
        fallback_base_map["טלפון_בית"] = "home_phone"  # גם עם קו תחתון
    if "alt_phone_1" in guest_model_fields:
        fallback_base_map["טלפון נוסף"] = "alt_phone_1"
    if "alt_phone_2" in guest_model_fields:
        fallback_base_map["טלפון נוסף 2"] = "alt_phone_2"
    if "building_number" in guest_model_fields:
        fallback_base_map["מספר בניין"] = "building_number"
    if "postal_code" in guest_model_fields:
        fallback_base_map["מיקוד"] = "postal_code"
    elif "zip_code" in guest_model_fields:
        fallback_base_map["מיקוד"] = "zip_code"
    if "manager_personal_number" in guest_model_fields:
        fallback_base_map["מספר אישי מניג'ר"] = "manager_personal_number"
        fallback_base_map["מספר אישי מניגר"] = "manager_personal_number"  # גרסה ללא גרש (אחרי _clean_key)
    if "card_id" in guest_model_fields:
        fallback_base_map["CardID"] = "card_id"
    if "account_number" in guest_model_fields:
        fallback_base_map["מספר חשבון"] = "account_number"
    
    # מפה לקיצוץ חיפושים
    existing_by_id: Dict[str, guest_models.Guest] = {}
    custom_fields_cache: Dict[str, guest_models.GuestCustomField] = {}

    # נבנה סט מזהים נדרשים בבאץ' - כולל גם normalized וגם raw IDs
    needed_ids_normalized: Set[str] = set()
    needed_ids_raw: Set[str] = set()
    
    for row in rows:
        # Find id_number with priority order (using cleaned keys)
        id_number_raw = None
        id_priority_keys = ["ת.ז./ח.פ.", "מזהה", "מזהה יבוא", "תעודת זהות", "id_number", "ת.ז", "תז", "מספר זהות"]
        for key in id_priority_keys:
            if key in row:
                val = str(row[key] or "").strip()
                # Treat "-" as empty (invalid ID) - same logic as in row processing
                if val and val != "-":
                    id_number_raw = val
                    break
        
        if id_number_raw:
            needed_ids_raw.add(id_number_raw)
            # Normalize id_number - keep only digits
            import re
            norm = re.sub(r'[^0-9]', '', id_number_raw)
            if norm:
                needed_ids_normalized.add(norm)

    # Query existing guests by both normalized and raw IDs
    if needed_ids_normalized or needed_ids_raw:
        print(f"[import-job] _process_batch: Querying existing guests (normalized: {len(needed_ids_normalized)}, raw: {len(needed_ids_raw)})")
        
        # Detect database dialect for cross-db compatibility
        dialect = db.bind.dialect.name if db.bind else ""
        
        # Build OR condition for both normalized and raw IDs
        conditions = []
        
        # Always query by raw IDs (works on both SQLite and Postgres)
        if needed_ids_raw:
            conditions.append(guest_models.Guest.id_number.in_(list(needed_ids_raw)))
        
        # Only use regexp_replace on Postgres (SQLite doesn't support it)
        if needed_ids_normalized and dialect in ("postgresql", "postgres"):
            conditions.append(
                func.regexp_replace(guest_models.Guest.id_number, '[^0-9]', '', 'g').in_(list(needed_ids_normalized))
            )
        
        existing = []
        if conditions:
            existing = (
                db.query(guest_models.Guest)
                .filter(guest_models.Guest.event_id == event_id)
                .filter(or_(*conditions))
                .all()
            )
        
        # For SQLite, also fetch guests that might match after normalization in Python
        # Since SQLite doesn't support regexp_replace, we need to filter in Python
        if needed_ids_normalized and dialect not in ("postgresql", "postgres"):
            # Only fetch guests that weren't already found by raw ID match
            existing_ids = {g.id for g in existing}
            # Fetch additional guests that might match after normalization
            # We check guests with id_number that contains digits
            query = (
                db.query(guest_models.Guest)
                .filter(guest_models.Guest.event_id == event_id)
                .filter(guest_models.Guest.id_number.isnot(None))
            )
            # Exclude already found guests
            if existing_ids:
                query = query.filter(~guest_models.Guest.id.in_(list(existing_ids)))
            
            additional_guests = query.all()
            
            # Filter by normalized IDs in Python
            for g in additional_guests:
                if g.id_number:
                    norm_key = _normalize_id(g.id_number)
                    if norm_key in needed_ids_normalized:
                        existing.append(g)
                        existing_ids.add(g.id)
        
        found_existing_count = len(existing)
        print(f"[import-job] _process_batch: Found {found_existing_count} existing guests (dialect: {dialect})")
        
        # Map by both normalized and raw ID
        # NOTE: Don't map guests with invalid IDs (like "-") to prevent matching new rows with TEMP IDs
        for g in existing:
            if g.id_number:
                # Skip mapping for invalid IDs (like "-" or empty) - these should get TEMP IDs
                if g.id_number != "-" and g.id_number.strip():
                    norm_key = _normalize_id(g.id_number)
                    if norm_key:
                        existing_by_id[norm_key] = g
                    # Also map by raw ID (only if valid)
                    existing_by_id[g.id_number] = g
        
        # Note: We no longer check for "-" because we always generate TEMP IDs for invalid IDs
        # Old guests with id_number = "-" will be handled as separate guests (each gets its own TEMP ID)

    new_objects = []
    existing_updated_list = []  # Track existing guests that need to be updated
    dynamic_values_buffer: List[Dict[str, Any]] = []
    # Map row_index to id_number_norm for easier lookup in error handling
    row_id_map: Dict[int, str] = {}
    # Track which rows were processed (entered the loop)
    processed_row_indices = set()

    for row_index, row in enumerate(rows):
        processed_row_indices.add(row_index)
        try:
            # מצא שם פרטי, שם משפחה, מגדר
            first = _get_field_value(row, ["שם", "first_name", "שם פרטי", "שם_פרטי"])
            last = _get_field_value(row, ["שם משפחה", "last_name", "שם_משפחה"])
            gender_raw = _get_field_value(row, ["gender", "מגדר", "מין"])
            if gender_raw:
                gender_raw = gender_raw.lower()
            gender = gender_raw if gender_raw in ["male", "female", "זכר", "נקבה", "גבר", "אשה"] else "male"
            
            # Find id_number with priority order
            id_number_raw = None
            id_priority_keys = ["ת.ז./ח.פ.", "מזהה", "מזהה יבוא", "תעודת זהות", "id_number", "ת.ז", "תז", "מספר זהות"]
            for key in id_priority_keys:
                if key in row:
                    val = str(row[key] or "").strip()
                    # Treat "-" as empty (invalid ID) - it will cause duplicate key errors
                    if val and val != "-":
                        id_number_raw = val
                        break
            
            # Get phone and email for duplicate detection (before TEMP ID generation)
            phone = _get_field_value(row, ["טלפון", "phone", "טלפון נייד", "מספר טלפון", "מספר נייד"])
            email = _get_field_value(row, ["אימייל", "email", "מייל", "דואר אלקטרוני"])
            # Normalize phone and email for comparison
            phone_normalized = phone.strip() if phone else None
            email_normalized = email.strip().lower() if email else None
            
            # Normalize id_number - keep only digits
            import re
            # Check if the raw ID looks like a UUID (contains dashes and letters) - these should get TEMP IDs
            looks_like_uuid = False
            if id_number_raw and id_number_raw != "-":
                # UUID pattern: contains dashes and letters (e.g., "e1dd5f10-a22a-4c6f-9493-4cc279adfa95")
                if "-" in id_number_raw and any(c.isalpha() for c in id_number_raw):
                    looks_like_uuid = True
                    id_number_norm = ""
                else:
                    id_number_norm = re.sub(r'[^0-9]', '', id_number_raw)
                    # If normalization resulted in empty string (no digits), treat as missing ID
                    if not id_number_norm:
                        id_number_norm = ""
            else:
                id_number_norm = ""

            # Before generating TEMP ID, try to find existing guest by name + phone/email
            # This prevents duplicates when re-importing the same file
            existing_by_name_match = None
            if (not id_number_norm or id_number_norm == "-" or (id_number_raw and id_number_raw == "-") or looks_like_uuid):
                # Only search by name if we have at least first_name and (phone or email)
                # Use normalized first/last names (before default values)
                search_first = first if first and first != "ללא שם" else None
                search_last = last if last and last != "ללא שם משפחה" else None
                
                if search_first and search_last and (phone_normalized or email_normalized):
                    # Try to find existing guest by name + (phone OR email)
                    query = db.query(guest_models.Guest).filter(
                        guest_models.Guest.event_id == event_id,
                        guest_models.Guest.first_name == search_first,
                        guest_models.Guest.last_name == search_last
                    )
                    
                    # Add phone OR email condition
                    conditions = []
                    if phone_normalized and phone_normalized != "-":
                        # בדוק גם mobile_phone וגם home_phone (phone לא קיים במודל)
                        conditions.append(
                            or_(
                                guest_models.Guest.mobile_phone == phone_normalized,
                                guest_models.Guest.home_phone == phone_normalized
                            )
                        )
                    if email_normalized and email_normalized != "-":
                        conditions.append(guest_models.Guest.email == email_normalized)
                    
                    if conditions:
                        query = query.filter(or_(*conditions))
                        existing_by_name_match = query.first()
                        if existing_by_name_match:
                            # Found existing guest - don't create TEMP ID, we'll use the existing guest
                            match_info = []
                            if phone_normalized and phone_normalized != "-":
                                match_info.append(f"phone={phone_normalized}")
                            if email_normalized and email_normalized != "-":
                                match_info.append(f"email={email_normalized}")
                            print(f"[import-job] _process_batch: Found existing guest by name+phone/email for row {row_index}: {search_first} {search_last} ({', '.join(match_info)}) (existing id_number: {existing_by_name_match.id_number})")
            
            # Generate TEMP ID if id_number is still missing or invalid
            # Cases: empty, "-", UUID format, or empty after normalization
            # IMPORTANT: Only generate TEMP ID if we didn't find an existing guest by name+phone/email
            # If we found existing guest, we'll use it and keep the original id_number_norm (or create TEMP ID if still needed)
            if (not id_number_norm or id_number_norm == "-" or (id_number_raw and id_number_raw == "-") or looks_like_uuid):
                if not existing_by_name_match:
                    # Generate deterministic TEMP ID: TEMP-{event_id}-{job_id}-{global_row_index}
                    global_row_index = batch_start_index + row_index
                    id_number_norm = f"TEMP-{event_id}-{job_id}-{global_row_index}"
                    temp_id_generated_count += 1
                    print(f"[import-job] _process_batch: Generated TEMP ID for row {row_index} (global {global_row_index}): {id_number_norm} (raw was: {id_number_raw}, looks_like_uuid: {looks_like_uuid})")
                    # After generating TEMP ID, id_number_raw is no longer relevant for lookup
                    id_number_raw = None
            
            # Store mapping for error handling (after TEMP ID generation)
            # If we found existing guest by name, use its id_number for mapping
            if existing_by_name_match and existing_by_name_match.id_number:
                row_id_map[row_index] = existing_by_name_match.id_number
            else:
                row_id_map[row_index] = id_number_norm

            # הקלה: אם חסר שם או ת"ז, נשתמש בערכים ברירת מחדל
            if not first:
                first = "ללא שם"
            if not last:
                last = "ללא שם משפחה"

            existing = None
            found_by_name_match = False  # Track if guest was found by name+phone/email
            # First check if we found an existing guest by name+phone/email
            if existing_by_name_match:
                existing = existing_by_name_match
                found_by_name_match = True
            # Otherwise, if we have a valid (non-TEMP) ID, try to find by ID
            elif not id_number_norm.startswith("TEMP-"):
                # Try to find existing guest by normalized ID first
                existing = existing_by_id.get(id_number_norm)
                # If not found and we have a raw ID, try raw ID lookup
                if not existing and id_number_raw:
                    existing = existing_by_id.get(id_number_raw)
            
            # If still not found by ID, try to find by name+phone/email (even if we have valid ID)
            # This prevents duplicates when the same person appears with different IDs or missing ID
            if not existing:
                search_first = first if first and first != "ללא שם" else None
                search_last = last if last and last != "ללא שם משפחה" else None
                
                if search_first and search_last and (phone_normalized or email_normalized):
                    # Build query with name match and (phone OR email) match
                    query = db.query(guest_models.Guest).filter(
                        guest_models.Guest.event_id == event_id,
                        guest_models.Guest.first_name == search_first,
                        guest_models.Guest.last_name == search_last
                    )
                    
                    # Add phone OR email condition
                    conditions = []
                    if phone_normalized and phone_normalized != "-":
                        # בדוק גם mobile_phone וגם home_phone (phone לא קיים במודל)
                        conditions.append(
                            or_(
                                guest_models.Guest.mobile_phone == phone_normalized,
                                guest_models.Guest.home_phone == phone_normalized
                            )
                        )
                    if email_normalized and email_normalized != "-":
                        conditions.append(guest_models.Guest.email == email_normalized)
                    
                    if conditions:
                        query = query.filter(or_(*conditions))
                        existing = query.first()
                        if existing:
                            found_by_name_match = True
                            # Update row_id_map with existing guest's id_number
                            if existing.id_number:
                                row_id_map[row_index] = existing.id_number
                            match_info = []
                            if phone_normalized and phone_normalized != "-":
                                match_info.append(f"phone={phone_normalized}")
                            if email_normalized and email_normalized != "-":
                                match_info.append(f"email={email_normalized}")
                            print(f"[import-job] _process_batch: Found existing guest by name+phone/email (after ID search failed) for row {row_index}: {search_first} {search_last} ({', '.join(match_info)}) (existing id_number: {existing.id_number}, new id_number: {id_number_norm})")
            
            if existing:
                guest = existing
                # Track that this existing guest needs to be updated
                if guest not in existing_updated_list:
                    existing_updated_list.append(guest)
            else:
                guest = guest_models.Guest(
                    event_id=event_id,
                    first_name=first,
                    last_name=last,
                    gender=gender,
                    id_number=id_number_norm,
                    confirmed_arrival=False,
                    registration_source="import",  # מקור הרשמה: ייבוא קובץ
                )
                new_objects.append(guest)
            
            # עבר על כל העמודות בקובץ והכנס אותן לשדות המתאימים
            # Track which base fields we've already set to avoid duplicates in dynamic
            base_fields_set = set()
            
            # Debug: Log all column keys for first row to help diagnose mapping issues
            if row_index == 0:
                phone_related_cols = [k for k in row.keys() if "טלפון" in k or "phone" in k.lower()]
                if phone_related_cols:
                    print(f"[import-job] _process_batch: Phone-related columns in file: {phone_related_cols}")
                # Debug: Check for manager_personal_number related columns
                manager_cols = [k for k in row.keys() if "מניג" in k or "manager" in k.lower()]
                if manager_cols:
                    print(f"[import-job] _process_batch: Manager personal number related columns in file: {manager_cols}")
                    for col in manager_cols:
                        print(f"[import-job] _process_batch: Column '{col}' value: '{row.get(col, '')}'")
            
            for col_key, val in row.items():
                if not col_key:
                    continue
                
                # Debug: Check if this column might be one of our target fields
                is_target_field = any(keyword in col_key for keyword in ["טלפון בית", "טלפון נוסף", "card", "כרטיס אשראי", "מספר אישי מניג'ר", "מספר אישי מניגר", "manager_personal_number"])
                
                # First check fallback_base_map (hardcoded basic fields)
                db_field_name = fallback_base_map.get(col_key)
                if is_target_field:
                    print(f"[import-job] _process_batch: DEBUG - Checking column '{col_key}' (value: '{val}') - fallback_base_map result: {db_field_name}")
                
                # If not in fallback_base_map, try field_mappings
                if not db_field_name:
                    db_field_name = field_mappings.get(col_key)
                    if is_target_field:
                        print(f"[import-job] _process_batch: DEBUG - field_mappings result for '{col_key}': {db_field_name}")
                    # Debug: Log if target field not found in mappings
                    if is_target_field and not db_field_name:
                        print(f"[import-job] _process_batch: WARNING - Target field column '{col_key}' not found in mappings (value: '{val}')")
                        # Show available keys that contain similar text
                        similar_keys = [k for k in field_mappings.keys() if "טלפון" in k or "בית" in k or "נוסף" in k or "מניג" in k]
                        if similar_keys:
                            print(f"[import-job] _process_batch: Similar keys in field_mappings: {similar_keys[:10]}")
                
                # Debug: Log when target field is found
                if is_target_field and db_field_name:
                    print(f"[import-job] _process_batch: DEBUG - Found target field: '{col_key}' -> '{db_field_name}' (value: '{val}')")
                
                # If found and exists in model, save to base field
                if db_field_name and db_field_name in guest_model_fields:
                    # Mark that we've set this base field
                    base_fields_set.add(db_field_name)
                    
                    # זה שדה בטבלת guests - נשמור אותו
                    col_def = guest_model_fields[db_field_name]
                    field_type = col_def.type.python_type if hasattr(col_def.type, 'python_type') else str
                    
                    # המרת ערך לפי סוג השדה
                    converted_val = _convert_value(val, field_type)
                    
                    # אל תדרוס שדות חובה (first_name, last_name) אם הערך ריק
                    if db_field_name in ["first_name", "last_name"]:
                        if converted_val is None or (isinstance(converted_val, str) and not converted_val.strip()):
                            continue  # דלג על עדכון שדות חובה אם הערך ריק
                    
                    # CRITICAL: Never overwrite id_number if it's already a TEMP ID or if the new value is invalid
                    # EXCEPTION: If guest was found by name+phone/email, allow updating TEMP ID with valid ID
                    if db_field_name == "id_number":
                        # Check if the new value is valid (not "-", not empty, not UUID-like)
                        is_valid_new_id = False
                        if converted_val and isinstance(converted_val, str) and converted_val.strip():
                            converted_val_str = converted_val.strip()
                            # Check if it's not "-" and not UUID-like
                            if converted_val_str != "-" and not (any(c.isalpha() for c in converted_val_str) and "-" in converted_val_str):
                                import re
                                # Check if it contains at least some digits (normalized ID would have digits)
                                norm_check = re.sub(r'[^0-9]', '', converted_val_str)
                                if norm_check:  # Has digits, so it's a valid numeric ID
                                    is_valid_new_id = True
                        
                        # If id_number is already set to a TEMP ID, only overwrite if:
                        # 1. Guest was found by name match (not by ID), AND
                        # 2. The new value is a valid ID
                        if guest.id_number and guest.id_number.startswith("TEMP-"):
                            if found_by_name_match and is_valid_new_id:
                                # Allow updating TEMP ID with valid ID when guest was found by name
                                pass  # Continue to update
                            else:
                                continue  # Don't overwrite TEMP ID with raw value from file
                        # Also don't overwrite with invalid values like "-"
                        if not is_valid_new_id:
                            continue  # Don't overwrite with invalid ID
                    
                    # Update if value is not None/empty (always update existing fields with new values from file)
                    # This allows re-importing the same file to update field values
                    if converted_val is not None and not (isinstance(converted_val, str) and not converted_val.strip()):
                        old_value = getattr(guest, db_field_name, None)
                        setattr(guest, db_field_name, converted_val)
                        # Debug log for specific fields we're tracking
                        if db_field_name in ["home_phone", "mobile_phone", "alt_phone_1", "alt_phone_2", "card_id", "credit_card_number", "manager_personal_number", "account_number"]:
                            print(f"[import-job] _process_batch: Updated {db_field_name} for guest {guest.id} (id_number: {guest.id_number}): '{old_value}' -> '{converted_val}'")
                    elif db_field_name in ["home_phone", "mobile_phone", "alt_phone_1", "alt_phone_2", "card_id", "credit_card_number", "manager_personal_number", "account_number"]:
                        # Debug: Log when value is empty/None and not updated
                        print(f"[import-job] _process_batch: Skipped updating {db_field_name} for guest {guest.id} - value is empty/None (raw value: '{val}')")
                else:
                    # זה שדה דינמי - נשמור ב-dynamic_values_buffer
                    # BUT: only if it's not already mapped to a base field (avoid duplicates)
                    # Only add to dynamic if no mapping was found OR mapping exists but field not in model
                    # AND it's not in base fields that we already processed
                    if not db_field_name:
                        # No mapping found at all - check if it's not accidentally a base field
                        is_mapped_base_field = (col_key in fallback_base_map) or (col_key in field_mappings and field_mappings.get(col_key) in guest_model_fields)
                        if not is_mapped_base_field:
                            value_str = str(val or "").strip()
                            if value_str:
                                dynamic_values_buffer.append({
                                    "id_number_norm": id_number_norm,
                                    "field_name": col_key,
                                    "value": value_str,
                                })
            
            # Don't mark row as OK yet - will be marked after successful commit
            # row_ok_flags[row_index] will remain False until commit succeeds
            
        except Exception as e:
            # Mark row as failed
            row_ok_flags[row_index] = False
            err += 1
            error_row = dict(row)
            error_row["error"] = str(e)
            errors.append(error_row)
            print(f"[import-job] _process_batch: Error processing row {row_index}: {e}")

    # הפרדה בין חדשים לישנים לפני bulk_save
    truly_new = [g for g in new_objects if g.id is None]
    
    # בדיקת כפילות נוספת לפני שמירה - מונע כפילויות
    truly_new_filtered = []
    for g in truly_new:
        duplicate_found = False
        existing = None
        
        # 1. בדוק כפילות לפי id_number (אם יש)
        if g.id_number and g.id_number.strip() and not g.id_number.startswith("TEMP-"):
            existing = guests_repo.find_guest_by_id_number(db, event_id, g.id_number)
            if existing:
                duplicate_found = True
                print(f"[import-job] _process_batch: Duplicate detected by id_number: {g.id_number}, updating existing guest {existing.id}")
        
        # 2. אם לא מצאנו לפי id_number, נבדוק לפי שם + טלפון/אימייל
        if not duplicate_found and g.first_name and g.last_name:
            phone = g.mobile_phone or g.home_phone or ""
            email = g.email or ""
            existing = guests_repo.find_guest_by_name_and_phone_or_email(
                db, event_id, g.first_name, g.last_name, phone, email
            )
            if existing:
                duplicate_found = True
                print(f"[import-job] _process_batch: Duplicate detected by name+phone/email: {g.first_name} {g.last_name}, updating existing guest {existing.id}")
        
        # אם נמצאה כפילות - עדכן את המוזמן הקיים
        if duplicate_found and existing:
            # העתק שדות מהמוזמן החדש למוזמן הקיים
            for key, value in g.__dict__.items():
                if key not in ['id', '_sa_instance_state', 'event_id'] and value is not None:
                    if key == 'id_number' and existing.id_number and existing.id_number.startswith("TEMP-"):
                        # עדכן TEMP ID עם ID אמיתי
                        setattr(existing, key, value)
                    elif key != 'id_number':  # אל תדרוס ID קיים (חוץ מ-TEMP)
                        # תמיד עדכן אם יש ערך בקובץ (לא רק אם השדה הקיים ריק)
                        # זה מאפשר לעדכן שדות קיימים כשמעלים קובץ מחדש
                        if value and (isinstance(value, str) and value.strip()):
                            setattr(existing, key, value)
            # הוסף לרשימת המוזמנים לעדכון
            if existing not in existing_updated_list:
                existing_updated_list.append(existing)
            continue  # דלג על יצירה - זה כפילות
        
        # אין כפילות - הוסף לרשימה
        truly_new_filtered.append(g)
    
    try:
        # Save new guests (רק אלה שאין להם כפילות)
        if truly_new_filtered:
            print(f"[import-job] _process_batch: Saving {len(truly_new_filtered)} new guests (filtered from {len(truly_new)} to remove duplicates)")
            db.add_all(truly_new_filtered)
            db.flush()  # כדי לקבל ids
            created_count = len(truly_new_filtered)
            
            # Log sample IDs after flush (first 3)
            sample_count = min(3, len(truly_new_filtered))
            if sample_count > 0:
                sample_ids = [(g.id_number, g.id) for g in truly_new_filtered[:sample_count]]
                print(f"[import-job] _process_batch: Sample new guests after flush (id_number, id): {sample_ids}")
            
            # Log sample TEMP IDs if any were generated
            if temp_id_generated_count > 0:
                temp_id_samples = [(g.id_number, g.id) for g in truly_new_filtered if g.id_number and g.id_number.startswith("TEMP-")][:3]
                if temp_id_samples:
                    print(f"[import-job] _process_batch: Sample TEMP IDs created (id_number, id): {temp_id_samples}")
        
        # Update existing guests (need to flush/commit to save changes)
        if existing_updated_list:
            updated_count = len(existing_updated_list)
            db.flush()  # Flush changes to existing objects
        
        db.commit()  # ✅ ONE commit per batch
        
        # After successful commit, mark all processed rows as OK
        # All rows that were processed successfully (either created new or updated existing)
        for idx in processed_row_indices:
            if idx < len(row_ok_flags):
                # Mark as OK - the commit succeeded, so all rows in this batch succeeded
                row_ok_flags[idx] = True
        
        # Compute ok count - all processed rows succeeded
        ok = sum(1 for flag in row_ok_flags if flag)
        
    except IntegrityError as e:
        db.rollback()
        print(f"[import-job] _process_batch: IntegrityError saving guests (likely duplicate id_number): {e}")
        print(f"[import-job] _process_batch: Attempting to save {len(truly_new_filtered)} new guests one by one with duplicate check")
        # Reset all processed row_ok_flags to False since commit failed
        # We'll mark them as True only if they're successfully saved one by one
        for idx in processed_row_indices:
            if idx < len(row_ok_flags):
                row_ok_flags[idx] = False
        # Try to save guests one by one to identify which ones succeed
        ok = 0
        created_count = 0
        saved_guests = []  # Track successfully saved guests for guest_id_by_norm
        # Create reverse mapping: id_number_norm -> row_index
        id_to_row_map = {id_norm: idx for idx, id_norm in row_id_map.items()}
        
        # Initialize sets for existing guest IDs (needed for duplicate detection)
        existing_guest_ids = {g.id_number for g in existing_updated_list if g.id_number}
        existing_guest_ids_normalized = {_normalize_id(g.id_number) for g in existing_updated_list if g.id_number and not g.id_number.startswith("TEMP-")}
        
        for g in truly_new_filtered:
            row_idx = id_to_row_map.get(g.id_number)
            
            # בדיקת כפילות מפורשת לפני שמירה (עם נרמול)
            duplicate_found = False
            existing = None
            
            # 1. בדוק לפי id_number
            if g.id_number and g.id_number.strip() and not g.id_number.startswith("TEMP-"):
                existing = guests_repo.find_guest_by_id_number(db, event_id, g.id_number)
                if existing:
                    duplicate_found = True
                    print(f"[import-job] _process_batch: Duplicate detected (one-by-one): id_number={g.id_number}, existing guest {existing.id}")
            
            # 2. אם לא מצאנו, נבדוק לפי שם + טלפון/אימייל
            if not duplicate_found and g.first_name and g.last_name:
                phone = g.mobile_phone or g.home_phone or ""
                email = g.email or ""
                existing = guests_repo.find_guest_by_name_and_phone_or_email(
                    db, event_id, g.first_name, g.last_name, phone, email
                )
                if existing:
                    duplicate_found = True
                    print(f"[import-job] _process_batch: Duplicate detected (one-by-one): name+phone/email: {g.first_name} {g.last_name}, existing guest {existing.id}")
                    # העתק שדות מהמוזמן החדש למוזמן הקיים
                    for key, value in g.__dict__.items():
                        if key not in ['id', '_sa_instance_state', 'event_id'] and value is not None:
                            if key == 'id_number' and existing.id_number and existing.id_number.startswith("TEMP-"):
                                setattr(existing, key, value)
                            elif key != 'id_number':
                                # תמיד עדכן אם יש ערך בקובץ (לא רק אם השדה הקיים ריק)
                                # זה מאפשר לעדכן שדות קיימים כשמעלים קובץ מחדש
                                if value and (isinstance(value, str) and value.strip()):
                                    setattr(existing, key, value)
                    if existing not in existing_updated_list:
                        existing_updated_list.append(existing)
                    # זה כפילות - סמן כהצלחה (עדכון מוזמן קיים)
                    if row_idx is not None and row_idx < len(row_ok_flags):
                        row_ok_flags[row_idx] = True
                    ok += 1
                    continue  # דלג על יצירה
            
            if not duplicate_found:
                try:
                    db.add(g)
                    db.flush()
                    db.commit()
                    ok += 1
                    created_count += 1
                    saved_guests.append(g)
                    # Mark row as successfully saved
                    if row_idx is not None and row_idx < len(row_ok_flags):
                        row_ok_flags[row_idx] = True
                except IntegrityError as single_e:
                    db.rollback()
                    # Duplicate - ננסה למצוא את המוזמן הקיים
                    existing = None
                    
                    # 1. נבדוק לפי id_number
                    if g.id_number and g.id_number.strip() and not g.id_number.startswith("TEMP-"):
                        existing = guests_repo.find_guest_by_id_number(db, event_id, g.id_number)
                    
                    # 2. אם לא מצאנו, נבדוק לפי שם + טלפון/אימייל
                    if not existing and g.first_name and g.last_name:
                        phone = g.mobile_phone or g.home_phone or ""
                        email = g.email or ""
                        existing = guests_repo.find_guest_by_name_and_phone_or_email(
                            db, event_id, g.first_name, g.last_name, phone, email
                        )
                    
                    if existing:
                        # עדכן את המוזמן הקיים
                        for key, value in g.__dict__.items():
                            if key not in ['id', '_sa_instance_state', 'event_id'] and value is not None:
                                if key == 'id_number' and existing.id_number and existing.id_number.startswith("TEMP-"):
                                    setattr(existing, key, value)
                                elif key != 'id_number':
                                    # תמיד עדכן אם יש ערך בקובץ (לא רק אם השדה הקיים ריק)
                                    # זה מאפשר לעדכן שדות קיימים כשמעלים קובץ מחדש
                                    if value and (isinstance(value, str) and value.strip()):
                                        setattr(existing, key, value)
                        if existing not in existing_updated_list:
                            existing_updated_list.append(existing)
                        if row_idx is not None and row_idx < len(row_ok_flags):
                            row_ok_flags[row_idx] = True
                        ok += 1
                        print(f"[import-job] _process_batch: IntegrityError handled - updated existing guest {existing.id}")
                    else:
                        print(f"[import-job] _process_batch: IntegrityError but couldn't find existing guest for {g.first_name} {g.last_name}")
                        # לא נמצא מוזמן קיים - זו שגיאה אמיתית
                        if row_idx is not None and row_idx < len(row_ok_flags):
                            row_ok_flags[row_idx] = False
                        err += 1
                        row = rows[row_idx] if row_idx < len(rows) else {}
                        errors.append({
                            "first_name": row.get("שם", row.get("first_name", g.first_name)),
                            "last_name": row.get("שם משפחה", row.get("last_name", g.last_name)),
                            "error": f"Duplicate id_number: {g.id_number}"
                        })
                except Exception as single_e:
                    db.rollback()
                    # Other error for this guest - mark as failed
                    if row_idx is not None and row_idx < len(row_ok_flags):
                        row_ok_flags[row_idx] = False
                        err += 1
                        row = rows[row_idx] if row_idx < len(rows) else {}
                        errors.append({
                            "first_name": row.get("שם", row.get("first_name", g.first_name)),
                            "last_name": row.get("שם משפחה", row.get("last_name", g.last_name)),
                            "error": f"Error saving guest: {str(single_e)}"
                        })
        
        # Update truly_new to only include successfully saved guests for guest_id_by_norm
        truly_new = saved_guests
        
        # For existing guests, mark ALL rows that match them as OK since they already exist in DB
        # (Updates didn't save, but the guests themselves are fine)
        # existing_guest_ids and existing_guest_ids_normalized are already initialized above
        # Update them if needed with any new ones found
        for g in existing_updated_list:
            if g.id_number:
                existing_guest_ids.add(g.id_number)
                if not g.id_number.startswith("TEMP-"):
                    norm = _normalize_id(g.id_number)
                    if norm:
                        existing_guest_ids_normalized.add(norm)
        
        # Mark ALL rows that match any existing guest
        for row_idx, id_norm in row_id_map.items():
            if row_idx < len(row_ok_flags) and not row_ok_flags[row_idx]:
                # Check if this row's ID matches any existing guest
                if id_norm in existing_guest_ids:
                    row_ok_flags[row_idx] = True
                    ok += 1
                elif id_norm in existing_guest_ids_normalized:
                    row_ok_flags[row_idx] = True
                    ok += 1
                elif not id_norm.startswith("TEMP-"):
                    # Also check normalized version
                    norm_key = _normalize_id(id_norm)
                    if norm_key and norm_key in existing_guest_ids_normalized:
                        row_ok_flags[row_idx] = True
                        ok += 1
    except Exception as e:
        db.rollback()
        print(f"[import-job] _process_batch: Error saving guests: {e}")
        ok = 0
        # If commit fails, all processed rows in batch are errors
        for idx in processed_row_indices:
            if idx < len(row_ok_flags):
                row_ok_flags[idx] = False
                err += 1
                if idx < len(rows):
                    errors.append({
                        "first_name": rows[idx].get("שם", rows[idx].get("first_name", "")),
                        "last_name": rows[idx].get("שם משפחה", rows[idx].get("last_name", "")),
                        "error": f"Failed to save guest: {str(e)}"
                    })

    # טיפול בשדות דינמיים - רק 15 שדות נוספים אחרי השדות הבסיסיים
    if dynamic_values_buffer:
        # סנן רק שדות שלא נמצאים בשדות הבסיסיים של המודל
        # נשתמש ב-guest_model_fields כדי לזהות שדות בסיסיים
        # כל שדה שנמצא ב-guest_model_fields הוא שדה בסיסי ולא צריך להיכנס ל-dynamic
        non_base_dynamic_values = [
            item for item in dynamic_values_buffer 
            if item["field_name"] not in guest_model_fields
        ]
        
        # הגבל ל-15 שדות נוספים בלבד (לפי הסדר בקובץ)
        # נשתמש ב-set כדי לעקוב אחרי השדות שכבר הוספנו
        seen_fields = set()
        limited_dynamic_values = []
        for item in non_base_dynamic_values:
            if item["field_name"] not in seen_fields:
                seen_fields.add(item["field_name"])
                limited_dynamic_values.append(item)
                if len(seen_fields) >= 15:
                    break  # הגענו ל-15 שדות נוספים
        
        if len(limited_dynamic_values) < len(non_base_dynamic_values):
            print(f"[import-job] _process_batch: Limited dynamic fields to 15 additional fields (had {len(non_base_dynamic_values)}, keeping first {len(limited_dynamic_values)})")
        
        # המשך עם limited_dynamic_values במקום dynamic_values_buffer
        names_needed = {item["field_name"] for item in limited_dynamic_values}
        existing_fields = (
            db.query(guest_models.GuestCustomField)
            .filter(guest_models.GuestCustomField.event_id == event_id)
            .filter(guest_models.GuestCustomField.name.in_(list(names_needed)))
            .all()
        )
        for f in existing_fields:
            custom_fields_cache[f.name] = f

        for name in names_needed:
            if name in custom_fields_cache:
                continue
            new_field = guest_models.GuestCustomField(event_id=event_id, name=name, field_type="text", form_key=None)
            db.add(new_field)
            db.flush()
            custom_fields_cache[name] = new_field

        # בניית מפה של guest_id לפי id_number (כולל החדשים והישנים)
        guest_id_by_norm = {}
        # Add existing guests
        for g in existing_updated_list:
            if g.id and g.id_number:
                # Always map by raw ID first (works for both TEMP and numeric IDs)
                guest_id_by_norm[g.id_number] = g.id
                # For numeric IDs (not TEMP), also map by normalized ID
                if not g.id_number.startswith("TEMP-"):
                    norm_key = _normalize_id(g.id_number)
                    if norm_key:
                        guest_id_by_norm[norm_key] = g.id
        # Add new guests (use truly_new_filtered - it's always defined after the filtering step)
        guests_to_map = truly_new_filtered
        for g in guests_to_map:
            if g.id and g.id_number:
                # Always map by raw ID first (works for both TEMP and numeric IDs)
                guest_id_by_norm[g.id_number] = g.id
                # For numeric IDs (not TEMP), also map by normalized ID
                if not g.id_number.startswith("TEMP-"):
                    norm_key = _normalize_id(g.id_number)
                    if norm_key:
                        guest_id_by_norm[norm_key] = g.id

        # Query existing field values only for relevant guests and fields
        existing_field_values = []
        guest_ids = list(guest_id_by_norm.values())
        field_ids = [f.id for f in custom_fields_cache.values()]
        
        if guest_ids and field_ids:
            existing_field_values = (
                db.query(guest_models.GuestFieldValue)
                .filter(guest_models.GuestFieldValue.guest_id.in_(guest_ids))
                .filter(guest_models.GuestFieldValue.custom_field_id.in_(field_ids))
                .all()
            )
        
        fv_map: Dict[tuple, guest_models.GuestFieldValue] = {}
        for fv in existing_field_values:
            fv_map[(fv.guest_id, fv.custom_field_id)] = fv

        new_fv_objects = []
        missing_guest_count = 0
        for item in limited_dynamic_values:  # שימוש ב-limited_dynamic_values במקום dynamic_values_buffer
            # Try to find guest_id by raw ID first (works for both TEMP and numeric IDs)
            guest_id = guest_id_by_norm.get(item["id_number_norm"])
            if not guest_id:
                missing_guest_count += 1
                if missing_guest_count <= 5:  # Log first 5 missing guests
                    print(f"[import-job] _process_batch: WARNING - guest_id not found for id_number_norm: {item['id_number_norm']}, field: {item['field_name']}")
                continue
            field = custom_fields_cache.get(item["field_name"])
            if not field:
                continue
            key = (guest_id, field.id)
            if key in fv_map:
                fv_map[key].value = item["value"]
                dynamic_values_updated += 1
            else:
                new_fv = guest_models.GuestFieldValue(
                    guest_id=guest_id,
                    custom_field_id=field.id,
                    value=item["value"],
                )
                new_fv_objects.append(new_fv)
                dynamic_values_created += 1

        if missing_guest_count > 0:
            print(f"[import-job] _process_batch: WARNING - {missing_guest_count} dynamic field values skipped due to missing guest_id")
        
        if new_fv_objects:
            try:
                db.bulk_save_objects(new_fv_objects)
                db.commit()
            except Exception as e:
                db.rollback()
                print(f"[import-job] _process_batch: Error saving dynamic field values: {e}")
                # Don't fail the entire batch - guests are already saved

    # Count saved guests with non-empty fields (after commit)
    # Use truly_new_filtered - it's always defined after the filtering step
    guests_for_stats = truly_new_filtered
    all_saved_guests = existing_updated_list + guests_for_stats
    with_first_name = sum(1 for g in all_saved_guests if g.first_name and g.first_name.strip() and g.first_name != "ללא שם")
    with_last_name = sum(1 for g in all_saved_guests if g.last_name and g.last_name.strip() and g.last_name != "ללא שם משפחה")
    # בדוק גם mobile_phone וגם home_phone (phone לא קיים במודל)
    with_phone = sum(1 for g in all_saved_guests if (g.mobile_phone and g.mobile_phone.strip()) or (g.home_phone and g.home_phone.strip()))
    with_email = sum(1 for g in all_saved_guests if g.email and g.email.strip())
    
    # Log summary
    print(f"[import-job] _process_batch: Summary - Rows: {rows_total}, Found existing: {found_existing_count}, Updated: {updated_count}, Created: {created_count}, Dynamic values updated: {dynamic_values_updated}, Dynamic values created: {dynamic_values_created}")
    print(f"[import-job] _process_batch: Field stats - With first_name: {with_first_name}, With last_name: {with_last_name}, With phone: {with_phone}, With email: {with_email}, TEMP IDs generated: {temp_id_generated_count}, Skipped (missing id_number): {skipped_missing_id_count}")
    print(f"[import-job] _process_batch: Success/Error counts - ok: {ok}, err: {err}, row_ok_flags count: {sum(1 for f in row_ok_flags if f)}")
    if err > 0:
        print(f"[import-job] _process_batch: WARNING - {err} rows failed in this batch. First 3 errors:")
        for i, error in enumerate(errors[-err:][:3]):
            print(f"  Error {i+1}: {error.get('error', 'Unknown error')} - {error.get('first_name', '')} {error.get('last_name', '')}")

    return ok, err, errors


def enqueue_import_job(job_id: int, event_id: int, file_path: str, created_by: Optional[int] = None):
    executor.submit(_process_file, job_id, event_id, file_path, created_by)


def _write_errors_csv(path: str, rows: List[Dict[str, Any]]):
    # איחוד כל הכותרות האפשריות
    fieldnames: List[str] = []
    seen: Set[str] = set()
    for r in rows:
        for k in r.keys():
            if k not in seen:
                seen.add(k)
                fieldnames.append(k)
    if "error" not in seen:
        fieldnames.append("error")
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in rows:
            writer.writerow(r)

