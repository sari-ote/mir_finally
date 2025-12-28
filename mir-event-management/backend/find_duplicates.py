"""
סקריפט למציאת מוזמנים כפולים
מציג את כל המוזמנים שיש להם אותו id_number (מנורמל) באותו event_id
"""
import sys
import io
# הגדר UTF-8 encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import sys
import os
# הוסף את התיקייה הנוכחית ל-PATH
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal, engine
from sqlalchemy import text
from collections import defaultdict
from typing import Dict, List, Tuple

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


def find_duplicate_guests(event_id: int = None):
    """
    מוצא מוזמנים כפולים לפי:
    1. id_number מנורמל
    2. שם פרטי + שם משפחה + טלפון/אימייל
    3. גם TEMP IDs
    
    Args:
        event_id: אם מוגדר, יחפש רק באירוע הזה. אחרת יחפש בכל האירועים
    """
    # שימוש ב-raw SQL כדי להימנע מבעיות עם relationships
    with engine.connect() as conn:
        # שליפת כל המוזמנים
        if event_id:
            query = text("SELECT id, event_id, first_name, last_name, id_number, email, mobile_phone, home_phone FROM guests WHERE event_id = :event_id")
            result = conn.execute(query, {"event_id": event_id})
        else:
            query = text("SELECT id, event_id, first_name, last_name, id_number, email, mobile_phone, home_phone FROM guests")
            result = conn.execute(query)
        
        rows = result.fetchall()
        
        # יצירת מפות שונות לזיהוי כפילויות
        duplicates_by_id: Dict[Tuple[int, str], List] = defaultdict(list)  # לפי תעודת זהות
        duplicates_by_name_phone: Dict[Tuple[int, str, str, str], List] = defaultdict(list)  # לפי שם + טלפון
        duplicates_by_name_email: Dict[Tuple[int, str, str, str], List] = defaultdict(list)  # לפי שם + אימייל
        
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
                # לא נדלג על TEMP IDs - גם הם יכולים להיות כפולים!
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
        all_duplicates = {}
        
        # כפילויות לפי תעודת זהות
        for key, guests_list in duplicates_by_id.items():
            if len(guests_list) > 1:
                # ספור כמה מוזמנים יש בלי "-spouse"
                non_spouse_guests = [g for g in guests_list if not g['id_number'].endswith('-spouse')]
                if len(non_spouse_guests) > 1:
                    all_duplicates[f"ID_{key}"] = guests_list
        
        # כפילויות לפי שם + טלפון
        for key, guests_list in duplicates_by_name_phone.items():
            if len(guests_list) > 1:
                all_duplicates[f"PHONE_{key}"] = guests_list
        
        # כפילויות לפי שם + אימייל
        for key, guests_list in duplicates_by_name_email.items():
            if len(guests_list) > 1:
                all_duplicates[f"EMAIL_{key}"] = guests_list
        
        duplicates = all_duplicates
        
        if not duplicates:
            print("לא נמצאו כפילויות!")
            return
        
        print(f"\nנמצאו {len(duplicates)} קבוצות של כפילויות:\n")
        print("=" * 100)
        
        total_duplicates = 0
        duplicate_count_by_type = {'ID': 0, 'PHONE': 0, 'EMAIL': 0}
        
        # מיון לפי סוג כפילות
        sorted_duplicates = sorted(duplicates.items(), key=lambda x: (x[0].split('_')[0], len(x[1]), x[1][0]['event_id']))
        
        for dup_key, guests_list in sorted_duplicates:
            total_duplicates += len(guests_list) - 1  # מספר הכפילויות (מינוס אחד המקורי)
            
            dup_type = dup_key.split('_')[0]
            duplicate_count_by_type[dup_type] += 1
            
            first_guest = guests_list[0]
            evt_id = first_guest['event_id']
            
            if dup_type == 'ID':
                # כפילות לפי תעודת זהות
                key_parts = dup_key.split('_', 1)
                identifier = key_parts[1] if len(key_parts) > 1 else 'לא ידוע'
                print(f"\n[{dup_type}] אירוע ID: {evt_id}, תעודת זהות: {identifier}")
                print(f"   נמצאו {len(guests_list)} מוזמנים עם אותה תעודת זהות:")
            elif dup_type == 'PHONE':
                # כפילות לפי שם + טלפון
                print(f"\n[{dup_type}] אירוע ID: {evt_id}, שם: {first_guest['first_name']} {first_guest['last_name']}, טלפון: {first_guest['mobile_phone'] or first_guest['home_phone']}")
                print(f"   נמצאו {len(guests_list)} מוזמנים עם אותו שם וטלפון:")
            elif dup_type == 'EMAIL':
                # כפילות לפי שם + אימייל
                print(f"\n[{dup_type}] אירוע ID: {evt_id}, שם: {first_guest['first_name']} {first_guest['last_name']}, אימייל: {first_guest['email']}")
                print(f"   נמצאו {len(guests_list)} מוזמנים עם אותו שם ואימייל:")
            
            print("-" * 100)
            
            for idx, guest in enumerate(guests_list, 1):
                phone = guest['mobile_phone'] or guest['home_phone'] or 'אין'
                print(f"   {idx}. ID: {guest['id']} | שם: {guest['first_name']} {guest['last_name']} | תעודת זהות: {guest['id_number'] or 'אין'}")
                print(f"      Email: {guest['email'] or 'אין'} | טלפון: {phone}")
                if idx < len(guests_list):
                    print()
        
        print("\n" + "=" * 100)
        print(f"סיכום: {len(duplicates)} קבוצות כפילויות, {total_duplicates} מוזמנים כפולים בסך הכל")
        print(f"   לפי תעודת זהות: {duplicate_count_by_type['ID']} קבוצות")
        print(f"   לפי שם + טלפון: {duplicate_count_by_type['PHONE']} קבוצות")
        print(f"   לפי שם + אימייל: {duplicate_count_by_type['EMAIL']} קבוצות")
        print(f"   (מתוך {len(rows)} מוזמנים בסך הכל)")
        
        return duplicates


if __name__ == "__main__":
    # אם יש ארגומנט, זה event_id
    event_id = None
    if len(sys.argv) > 1:
        try:
            event_id = int(sys.argv[1])
            print(f"מחפש כפילויות באירוע {event_id}...")
        except ValueError:
            print("שגיאה: event_id חייב להיות מספר")
            sys.exit(1)
    else:
        print("מחפש כפילויות בכל האירועים...")
    
    find_duplicate_guests(event_id)

