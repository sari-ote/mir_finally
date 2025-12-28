# -*- coding: utf-8 -*-
"""
Create fresh demo events for testing
Run with: python create_fresh_demo_events.py
"""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine, Base
from app.events import schemas as event_schemas
from app.events import repository as event_repo
from app.events import models as event_models
from app.users.models import User

# Import all models to ensure relationships are properly configured
from app.seatings.models import Seating, SeatingCard
from app.guests.models import Guest, GuestCustomField, GuestFieldValue, GuestFormShare
from app.tables.models import Table, HallElement
from app.tableHead.models import TableHead
from app.greetings.models import Greeting
from app.payments.models import Payment
from app.permissions.models import UserEventPermission
from app.realtime.models import RealTimeNotification, AttendanceLog
from app.audit_log.models import AuditLog

import sys

def create_fresh_demo_events():
    """Create fresh demo events with proper admin_id"""
    
    # Create all tables if they don't exist
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Find admin user
        admin = db.query(User).filter(User.email == "admin@example.com").first()
        if not admin:
            admin = db.query(User).filter(User.role == "admin").first()
        
        if not admin:
            sys.stdout.buffer.write("לא נמצא משתמש admin! הרץ קודם: python create_admin.py\n".encode('utf-8'))
            return
        
        sys.stdout.buffer.write(f"נמצא admin: {admin.id} - {admin.email}\n".encode('utf-8'))
        
        # Create fresh demo events
        now = datetime.now()
        demo_events_data = [
            {
                "name": "חתונה - משפחת כהן",
                "type": "חתונה",
                "date": now + timedelta(days=5),
                "location": "אולמי המלך דוד, ירושלים",
            },
            {
                "name": "בר מצווה - יוסי לוי",
                "type": "בר מצווה",
                "date": now + timedelta(days=12),
                "location": "אולמי ההדר, בני ברק",
            },
            {
                "name": "אירוע התרמה - ארגון חסד",
                "type": "אירוע התרמה",
                "date": now + timedelta(days=20),
                "location": "מרכז הכנסים, תל אביב",
            },
            {
                "name": "ברית מילה - דוד כהן",
                "type": "ברית מילה",
                "date": now + timedelta(days=3),
                "location": "בית כנסת הגדול, ירושלים",
            },
            {
                "name": "חתונת זהב - משפחת לוי",
                "type": "חתונת זהב",
                "date": now + timedelta(days=25),
                "location": "מלון דן, תל אביב",
            },
            {
                "name": "בר מצווה - משה דוד",
                "type": "בר מצווה",
                "date": now + timedelta(days=18),
                "location": "אולמי גני התערוכה, תל אביב",
            },
        ]
        
        created_count = 0
        for data in demo_events_data:
            # Check if event already exists
            existing = db.query(event_models.Event).filter(
                event_models.Event.name == data["name"]
            ).first()
            
            if existing:
                sys.stdout.buffer.write(f"אירוע כבר קיים: {existing.id} - {data['name']}\n".encode('utf-8'))
                continue
            
            try:
                event_in = event_schemas.EventCreate(**data)
                event = event_repo.create_event(
                    db=db, 
                    event=event_in, 
                    admin_id=admin.id, 
                    user_id=admin.id
                )
                created_count += 1
                date_str = event.date.strftime('%d/%m/%Y %H:%M') if event.date else 'N/A'
                sys.stdout.buffer.write(f"נוצר אירוע: {event.id} - {event.name} (תאריך: {date_str})\n".encode('utf-8'))
            except Exception as e:
                sys.stdout.buffer.write(f"שגיאה ביצירת אירוע {data['name']}: {e}\n".encode('utf-8'))
                continue
        
        total_events = db.query(event_models.Event).count()
        sys.stdout.buffer.write(f"\nהושלם! נוצרו {created_count} אירועי דמו חדשים.\n".encode('utf-8'))
        sys.stdout.buffer.write(f"סה\"כ אירועים בבסיס הנתונים: {total_events}\n".encode('utf-8'))
        
    except Exception as e:
        db.rollback()
        sys.stdout.buffer.write(f"שגיאה: {e}\n".encode('utf-8'))
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    create_fresh_demo_events()

