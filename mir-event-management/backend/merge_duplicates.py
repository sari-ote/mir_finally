"""
סקריפט למיזוג/מחיקת מוזמנים כפולים
מזהה כפילויות ומציע למזג או למחוק אותן
"""
import sys
import io
# הגדר UTF-8 encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal, engine
from sqlalchemy import text
from collections import defaultdict
from typing import Dict, List, Tuple, Set

def normalize_id(id_number: str) -> str:
    """מנרמל תעודת זהות - רק ספרות"""
    if not id_number:
        return ""
    return "".join(ch for ch in str(id_number) if ch.isdigit())


def normalize_phone(phone: str) -> str:
    """מנרמל מספר טלפון - רק ספרות"""
    if not phone:
        return ""
    return "".join(ch for ch in str(phone) if ch.isdigit())


def normalize_email(email: str) -> str:
    """מנרמל אימייל - אותיות קטנות"""
    if not email:
        return ""
    return str(email).lower().strip()


def find_all_duplicates(event_id: int = None):
    """
    מוצא את כל הכפילויות ומחזיר רשימה של קבוצות כפילות
    """
    with engine.connect() as conn:
        if event_id:
            query = text("SELECT id, event_id, first_name, last_name, id_number, email, mobile_phone, home_phone FROM guests WHERE event_id = :event_id")
            result = conn.execute(query, {"event_id": event_id})
        else:
            query = text("SELECT id, event_id, first_name, last_name, id_number, email, mobile_phone, home_phone FROM guests")
            result = conn.execute(query)
        
        rows = result.fetchall()
        
        # יצירת מפות שונות לזיהוי כפילויות
        duplicates_by_id: Dict[Tuple[int, str], List] = defaultdict(list)
        duplicates_by_name_phone: Dict[Tuple[int, str, str, str], List] = defaultdict(list)
        duplicates_by_name_email: Dict[Tuple[int, str, str, str], List] = defaultdict(list)
        
        for row in rows:
            guest_id, evt_id, first_name, last_name, id_number, email, mobile_phone, home_phone = row
            
            guest_data = {
                'id': guest_id,
                'event_id': evt_id,
                'first_name': first_name or '',
                'last_name': last_name or '',
                'id_number': id_number or '',
                'email': email or '',
                'mobile_phone': mobile_phone or '',
                'home_phone': home_phone or ''
            }
            
            # 1. חיפוש לפי תעודת זהות (כולל TEMP IDs)
            if id_number:
                normalized = normalize_id(id_number)
                if normalized and len(normalized) >= 6:  # תעודת זהות תקפה
                    key = (evt_id, normalized)
                    duplicates_by_id[key].append(guest_data)
                elif id_number.startswith("TEMP-"):
                    # גם TEMP IDs יכולים להיות כפולים
                    key = (evt_id, id_number)
                    duplicates_by_id[key].append(guest_data)
            
            # 2. חיפוש לפי שם + טלפון
            if first_name and last_name:
                phone = normalize_phone(mobile_phone or home_phone or '')
                if phone and len(phone) >= 7:  # לפחות 7 ספרות
                    key = (evt_id, first_name.strip().lower(), last_name.strip().lower(), phone)
                    duplicates_by_name_phone[key].append(guest_data)
            
            # 3. חיפוש לפי שם + אימייל
            if first_name and last_name:
                email_norm = normalize_email(email)
                if email_norm and '@' in email_norm:
                    key = (evt_id, first_name.strip().lower(), last_name.strip().lower(), email_norm)
                    duplicates_by_name_email[key].append(guest_data)
        
        # איחוד כל הכפילויות
        all_duplicate_groups = []
        seen_guest_ids: Set[int] = set()
        
        # כפילויות לפי תעודת זהות
        for key, guests_list in duplicates_by_id.items():
            if len(guests_list) > 1:
                non_spouse = [g for g in guests_list if not g['id_number'].endswith('-spouse')]
                if len(non_spouse) > 1:
                    # הוסף רק אם לא הוספנו כבר את המוזמנים האלה
                    guest_ids = {g['id'] for g in non_spouse}
                    if not guest_ids.intersection(seen_guest_ids):
                        all_duplicate_groups.append({
                            'type': 'ID',
                            'key': key,
                            'guests': non_spouse
                        })
                        seen_guest_ids.update(guest_ids)
        
        # כפילויות לפי שם + טלפון
        for key, guests_list in duplicates_by_name_phone.items():
            if len(guests_list) > 1:
                guest_ids = {g['id'] for g in guests_list}
                if not guest_ids.intersection(seen_guest_ids):
                    all_duplicate_groups.append({
                        'type': 'PHONE',
                        'key': key,
                        'guests': guests_list
                    })
                    seen_guest_ids.update(guest_ids)
        
        # כפילויות לפי שם + אימייל
        for key, guests_list in duplicates_by_name_email.items():
            if len(guests_list) > 1:
                guest_ids = {g['id'] for g in guests_list}
                if not guest_ids.intersection(seen_guest_ids):
                    all_duplicate_groups.append({
                        'type': 'EMAIL',
                        'key': key,
                        'guests': guests_list
                    })
                    seen_guest_ids.update(guest_ids)
        
        return all_duplicate_groups, len(rows)


def merge_duplicate_group(conn, group, dry_run: bool = True):
    """
    ממזג קבוצת כפילויות אחת
    """
    guests = group['guests']
    if len(guests) <= 1:
        return 0, 0
    
    # מיון לפי ID - המוזמן עם ה-ID הנמוך ביותר הוא הוותיק ביותר
    guests_sorted = sorted(guests, key=lambda g: g['id'])
    keep_guest = guests_sorted[0]  # המוזמן שנשמור
    delete_guests = guests_sorted[1:]  # המוזמנים שנמחק
    
    if dry_run:
        return len(delete_guests), 0
    
    # מיזוג בפועל
    # 1. העתק נתונים מהמוזמנים שנמחקים למוזמן שנשמר (רק אם השדה ריק במוזמן שנשמר)
    keep_id = keep_guest['id']
    
    # שלוף את המוזמן מהדטבייס
    keep_query = text("SELECT id, mobile_phone, home_phone, email, id_number FROM guests WHERE id = :guest_id")
    result = conn.execute(keep_query, {"guest_id": keep_id})
    keep_row = result.fetchone()
    
    if not keep_row:
        return 0, 0
    
    # המר את ה-row ל-dict
    keep_data = {
        'mobile_phone': keep_row[1],
        'home_phone': keep_row[2],
        'email': keep_row[3],
        'id_number': keep_row[4]
    }
    
    # עדכן שדות ריקים במוזמן שנשמר עם נתונים מהמוזמנים שנמחקים
    updates = {}
    for delete_guest in delete_guests:
        delete_id = delete_guest['id']
        delete_query = text("SELECT id, mobile_phone, home_phone, email, id_number FROM guests WHERE id = :guest_id")
        delete_result = conn.execute(delete_query, {"guest_id": delete_id})
        delete_row = delete_result.fetchone()
        
        if not delete_row:
            continue
        
        delete_data = {
            'mobile_phone': delete_row[1],
            'home_phone': delete_row[2],
            'email': delete_row[3],
            'id_number': delete_row[4]
        }
        
        # העתק שדות ריקים (רק אם השדה ריק במוזמן שנשמר)
        for col_name in ['mobile_phone', 'home_phone', 'email', 'id_number']:
            keep_value = keep_data.get(col_name)
            delete_value = delete_data.get(col_name)
            
            # אם השדה ריק במוזמן שנשמר אבל יש ערך במוזמן שנמחק
            if (not keep_value or (isinstance(keep_value, str) and not keep_value.strip())) and delete_value:
                if col_name not in updates or not updates[col_name]:
                    updates[col_name] = delete_value
    
    # עדכן את המוזמן שנשמר
    if updates:
        update_parts = [f"{col} = :{col}" for col in updates.keys()]
        update_query = text(f"UPDATE guests SET {', '.join(update_parts)} WHERE id = :guest_id")
        params = {**updates, "guest_id": keep_id}
        conn.execute(update_query, params)
        conn.commit()
    
    # מחק את הכפילויות
    deleted_count = 0
    for delete_guest in delete_guests:
        delete_id = delete_guest['id']
        try:
            # מחק רשומות קשורות
            # 1. GuestFieldValue
            conn.execute(text("DELETE FROM guest_field_values WHERE guest_id = :guest_id"), {"guest_id": delete_id})
            # 2. Seating
            conn.execute(text("DELETE FROM seatings WHERE guest_id = :guest_id"), {"guest_id": delete_id})
            # 3. Greeting
            conn.execute(text("DELETE FROM greetings WHERE guest_id = :guest_id"), {"guest_id": delete_id})
            # 4. AttendanceLog
            conn.execute(text("DELETE FROM attendance_logs WHERE guest_id = :guest_id"), {"guest_id": delete_id})
            # 5. RealTimeNotification
            conn.execute(text("DELETE FROM realtime_notifications WHERE guest_id = :guest_id"), {"guest_id": delete_id})
            # 6. Payment
            conn.execute(text("DELETE FROM payments WHERE guest_id = :guest_id"), {"guest_id": delete_id})
            
            # מחק את המוזמן
            conn.execute(text("DELETE FROM guests WHERE id = :guest_id"), {"guest_id": delete_id})
            deleted_count += 1
        except Exception as e:
            print(f"שגיאה במחיקת מוזמן {delete_id}: {e}")
            conn.rollback()
            continue
    
    # Commit את כל המחיקות
    if deleted_count > 0:
        conn.commit()
    
    return len(delete_guests), deleted_count


def merge_duplicates(event_id: int = None, dry_run: bool = True, limit: int = None):
    """
    מזהה כפילויות ומציע למזג אותן
    
    Args:
        event_id: אם מוגדר, יטפל רק באירוע הזה
        dry_run: אם True, רק מציג מה היה קורה. אם False, מבצע את המיזוג
        limit: אם מוגדר, יטפל רק ב-limit קבוצות הראשונות
    """
    print("מחפש כפילויות...")
    duplicate_groups, total_guests = find_all_duplicates(event_id)
    
    if not duplicate_groups:
        print("לא נמצאו כפילויות!")
        return
    
    # מיון לפי מספר כפילויות (הכי הרבה כפילויות קודם)
    duplicate_groups.sort(key=lambda g: len(g['guests']), reverse=True)
    
    if limit:
        duplicate_groups = duplicate_groups[:limit]
    
    total_duplicates = sum(len(g['guests']) - 1 for g in duplicate_groups)
    
    print(f"\nנמצאו {len(duplicate_groups)} קבוצות כפילויות (מתוך {len(duplicate_groups) if not limit else 'כל'} הקבוצות)")
    print(f"סה\"כ {total_duplicates} מוזמנים כפולים")
    print(f"מתוך {total_guests} מוזמנים בסך הכל\n")
    
    if dry_run:
        print("=" * 100)
        print("זהו DRY RUN - לא יבוצעו שינויים!")
        print("=" * 100)
        print("\nאסטרטגיית מיזוג:")
        print("1. בכל קבוצת כפילויות, נשמור את המוזמן עם ה-ID הנמוך ביותר (הוותיק ביותר)")
        print("2. נמחק את כל הכפילויות האחרות")
        print("3. נשמור את כל הנתונים מהמוזמנים שנמחקו במוזמן שנשמר (רק אם השדה ריק)")
        print("\nדוגמאות לכפילויות (10 הראשונות):")
        for i, group in enumerate(duplicate_groups[:10], 1):
            guests = group['guests']
            keep = min(guests, key=lambda g: g['id'])
            delete_count = len(guests) - 1
            print(f"\n{i}. [{group['type']}] {keep['first_name']} {keep['last_name']} - {delete_count} כפילויות")
            print(f"   נשמור: ID {keep['id']} | נמחק: {', '.join(str(g['id']) for g in sorted(guests, key=lambda g: g['id'])[1:])}")
        
        print(f"\n\nלהמשיך? (הרץ עם --execute כדי לבצע את המיזוג בפועל)")
        print("אפשר גם להריץ עם --limit N כדי לטפל רק ב-N קבוצות הראשונות")
        return
    
    # מיזוג בפועל
    print("=" * 100)
    print("מתחיל מיזוג בפועל...")
    print("=" * 100)
    
    with engine.connect() as conn:
        merged_count = 0
        deleted_count = 0
        error_count = 0
        
        for i, group in enumerate(duplicate_groups, 1):
            try:
                to_delete, actually_deleted = merge_duplicate_group(conn, group, dry_run=False)
                if actually_deleted > 0:
                    merged_count += 1
                    deleted_count += actually_deleted
                    if i % 100 == 0:
                        print(f"עובד... טופלו {i}/{len(duplicate_groups)} קבוצות, נמחקו {deleted_count} מוזמנים")
                        conn.commit()  # Commit כל 100 קבוצות
            except Exception as e:
                error_count += 1
                print(f"שגיאה בקבוצה {i}: {e}")
                conn.rollback()
                continue
        
        conn.commit()
        print(f"\nמיזוג הושלם!")
        print(f"נמזגו {merged_count} קבוצות")
        print(f"נמחקו {deleted_count} מוזמנים כפולים")
        if error_count > 0:
            print(f"היו {error_count} שגיאות")


if __name__ == "__main__":
    event_id = None
    dry_run = True
    limit = None
    
    i = 1
    while i < len(sys.argv):
        arg = sys.argv[i]
        if arg == "--execute":
            dry_run = False
        elif arg == "--limit" and i + 1 < len(sys.argv):
            try:
                limit = int(sys.argv[i + 1])
                i += 1
            except ValueError:
                print("שגיאה: --limit חייב להיות מספר")
                sys.exit(1)
        else:
            try:
                event_id = int(arg)
            except ValueError:
                print(f"שגיאה: לא מובן '{arg}'")
                print("שימוש: python merge_duplicates.py [event_id] [--execute] [--limit N]")
                sys.exit(1)
        i += 1
    
    if event_id:
        print(f"מחפש כפילויות באירוע {event_id}...")
    else:
        print("מחפש כפילויות בכל האירועים...")
    
    if limit:
        print(f"יטפל רק ב-{limit} קבוצות הראשונות")
    
    merge_duplicates(event_id, dry_run, limit)

