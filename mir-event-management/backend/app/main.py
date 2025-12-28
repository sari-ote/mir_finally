from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy import text
import uvicorn

from app.core.config import settings
from app.core.database import Base, engine
from app.seatings.models import Seating
from app.imports import models as import_models  # ensure ImportJob is registered
from app.tableStructure import models as table_structure_models  # ensure TableStructure is registered
from app.tableStructure.router import router as table_structure_router

# Import the centralized router
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))
from backendapp.urls import router

app = FastAPI(title=settings.PROJECT_NAME)  # <- יצירת האפליקציה

# Include the centralized router
app.include_router(router)
# Table structure (global)
app.include_router(table_structure_router)

# Static files (serve uploads for import error logs, etc.)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Ensure all tables exist and patch missing columns in legacy deployments
Base.metadata.create_all(bind=engine)
with engine.begin() as conn:
    conn.execute(
        text(
            "ALTER TABLE guest_custom_fields "
            "ADD COLUMN IF NOT EXISTS form_key VARCHAR(255)"
        )
    )
    # Add new columns to greetings table if they don't exist
    try:
        conn.execute(
            text(
                "ALTER TABLE greetings "
                "ADD COLUMN IF NOT EXISTS formatted_content TEXT"
            )
        )
    except Exception:
        pass  # Column might already exist
    try:
        conn.execute(
            text(
                "ALTER TABLE greetings "
                "ADD COLUMN IF NOT EXISTS file_path VARCHAR(255)"
            )
        )
    except Exception:
        pass
    try:
        conn.execute(
            text(
                "ALTER TABLE greetings "
                "ADD COLUMN IF NOT EXISTS file_name VARCHAR(255)"
            )
        )
    except Exception:
        pass
    try:
        conn.execute(
            text(
                "ALTER TABLE greetings "
                "ADD COLUMN IF NOT EXISTS phone VARCHAR(255)"
            )
        )
    except Exception:
        pass






# Compression middleware - דחיסת תגובות גדולות
app.add_middleware(GZipMiddleware, minimum_size=1000)  # דחוס רק תגובות מעל 1KB

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # או ["*"] לבדיקה
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "המערכת מוכנה!"}



if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8001)