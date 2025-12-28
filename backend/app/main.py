from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
import uvicorn

from app.core.config import settings
from app.core.database import Base, engine

# Import all models to ensure Base.metadata.create_all() creates all tables
from app.seatings.models import Seating, SeatingCard
from app.guests.models import Guest, GuestCustomField, GuestFieldValue, GuestFormShare
from app.events.models import Event
from app.users.models import User
from app.tables.models import Table
from app.tableHead.models import TableHead
from app.greetings.models import Greeting
from app.payments.models import Payment
from app.permissions.models import UserEventPermission
from app.realtime.models import RealTimeNotification, AttendanceLog
from app.audit_log.models import AuditLog

# Import the centralized router
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))
from backendapp.urls import router

app = FastAPI(title=settings.PROJECT_NAME)  # <- יצירת האפליקציה

# CORS middleware MUST be added BEFORE including routers
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include the centralized router
app.include_router(router)

# Ensure all tables exist and patch missing columns in legacy deployments
Base.metadata.create_all(bind=engine)
# SQLite doesn't support IF NOT EXISTS in ALTER TABLE, so we check first
try:
    with engine.begin() as conn:
        # Check if the table exists and if the column exists
        result = conn.execute(text("PRAGMA table_info(guest_custom_fields)"))
        columns = [row[1] for row in result]
        
        # Only add the column if the table exists but the column doesn't
        if columns and 'form_key' not in columns:
            conn.execute(
                text("ALTER TABLE guest_custom_fields ADD COLUMN form_key VARCHAR(255)")
            )
except Exception as e:
    print(f"Note: Could not patch legacy database columns: {e}")
    # This is okay - the tables might be newly created with all columns already present

@app.get("/")
def read_root():
    return {"message": "המערכת מוכנה!"}



if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8001)