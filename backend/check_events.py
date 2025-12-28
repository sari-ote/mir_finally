from app.core.database import SessionLocal
from app.events.models import Event
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

db = SessionLocal()
events = db.query(Event).all()
users = db.query(User).filter(User.role == 'admin').all()

print(f'Events count: {len(events)}')
print(f'Admin users count: {len(users)}')

print('\nEvents:')
for e in events:
    print(f'  ID: {e.id}, Name: {e.name}, Admin ID: {e.admin_id}')

print('\nAdmin users:')
for u in users:
    print(f'  ID: {u.id}, Email: {u.email}, Role: {u.role}')

db.close()

