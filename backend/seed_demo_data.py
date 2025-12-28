from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.core.database import SessionLocal, Base, engine
from app.auth.service import get_password_hash
from app.events import schemas as event_schemas
from app.events import repository as event_repo
from app.permissions import schemas as perm_schemas
from app.permissions import repository as perm_repo
from app.users.models import User

# Import all models to ensure relationships are properly configured
from app.seatings.models import Seating, SeatingCard
from app.guests.models import Guest, GuestCustomField, GuestFieldValue, GuestFormShare
from app.events.models import Event
from app.tables.models import Table, HallElement
from app.tableHead.models import TableHead
from app.greetings.models import Greeting
from app.payments.models import Payment
from app.permissions.models import UserEventPermission
from app.realtime.models import RealTimeNotification, AttendanceLog
from app.audit_log.models import AuditLog


def ensure_admin(db: Session) -> User:
    """Find existing admin or create a default one (without ID validation)."""
    # Try to find admin@example.com first (the main admin)
    admin = db.query(User).filter(User.email == "admin@example.com").first()
    if admin:
        return admin
    
    # If not found, try any admin
    admin = db.query(User).filter(User.role == "admin").order_by(User.id.asc()).first()
    if admin:
        return admin

    # יצירת מנהל דמו ישירות במודל (עוקף ולידציית ת"ז)
    admin = User(
        username="admin_demo",
        full_name="מנהל הדגמה",
        email="admin_demo@example.com",
        role="admin",
        id_number="999999999",
        password_hash=get_password_hash("Admin123!"),
        is_active=True,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    print(f"נוצר מנהל דמו: {admin.id} - {admin.email} (סיסמה: Admin123!)")
    return admin


def seed_demo_data():
    """
    Fill the database with demo users, events and permissions so the UI looks 'live'.
    Run with: python seed_demo_data.py
    """
    # Make sure all tables exist
    Base.metadata.create_all(bind=engine)

    db: Session = SessionLocal()
    try:
        admin = ensure_admin(db)

        # --- demo users ---
        demo_users_data = [
            (
                "manager_1",
                "מנהל אירוע - אבי כהן",
                "manager1@example.com",
                "event_manager",
                "888888881",
                "Manager1!",
            ),
            (
                "manager_2",
                "מנהל אירוע - שרית לוי",
                "manager2@example.com",
                "event_manager",
                "888888882",
                "Manager2!",
            ),
            (
                "viewer_1",
                "צופה - אורח VIP",
                "viewer1@example.com",
                "viewer",
                "888888883",
                "Viewer1!",
            ),
        ]

        created_users = []
        for username, full_name, email, role, id_number, password in demo_users_data:
            existing = db.query(User).filter(User.email == email).first()
            if existing:
                created_users.append(existing)
                continue
            user = User(
                username=username,
                full_name=full_name,
                email=email,
                role=role,
                id_number=id_number,
                password_hash=get_password_hash(password),
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            created_users.append(user)
            print(f"נוצר משתמש דמו: {user.id} - {user.email} (סיסמה: {password})")

        # --- demo events ---
        now = datetime.now()
        demo_events_data = [
            {
                "name": "חתונת הדגמה - משפחת כהן",
                "type": "חתונה",
                "date": now + timedelta(days=7),
                "location": "אולמי המלך דוד, ירושלים",
            },
            {
                "name": "בר מצווה - יוסי לוי",
                "type": "בר מצווה",
                "date": now + timedelta(days=14),
                "location": "אולמי ההדר, בני ברק",
            },
            {
                "name": "אירוע התרמה - ארגון חסד",
                "type": "אירוע התרמה",
                "date": now + timedelta(days=30),
                "location": "מרכז הכנסים, תל אביב",
            },
        ]

        created_events = []
        for data in demo_events_data:
            event_in = event_schemas.EventCreate(**data)
            event = event_repo.create_event(
                db=db, event=event_in, admin_id=admin.id, user_id=admin.id
            )
            created_events.append(event)
            print(f"נוצר אירוע דמו: {event.id} - {event.name}")

        # --- permissions: who sees what ---
        # פשוט: כל המנהלים רואים את כל האירועים כ-event_admin, והצופה כ-viewer
        managers = [u for u in created_users if u.role == "event_manager"]
        viewers = [u for u in created_users if u.role == "viewer"]

        for ev in created_events:
            for m in managers:
                perm = perm_schemas.UserEventPermissionCreate(
                    user_id=m.id, event_id=ev.id, role_in_event="event_admin"
                )
                perm_repo.create_permission(db, perm, user_id=admin.id)
            for v in viewers:
                perm = perm_schemas.UserEventPermissionCreate(
                    user_id=v.id, event_id=ev.id, role_in_event="viewer"
                )
                perm_repo.create_permission(db, perm, user_id=admin.id)

        print("\nהוזנו נתוני דמו - משתמשים, אירועים והרשאות.")
        print("תוכלי להתחבר למשל עם:")
        print("  מנהל:  manager1@example.com  /  Manager1!")
        print("  צופה:  viewer1@example.com   /  Viewer1!")

    except Exception as e:
        db.rollback()
        print("שגיאה בהזנת נתוני דמו:", e)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_data()


