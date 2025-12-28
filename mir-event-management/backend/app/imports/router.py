import os
import shutil
from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from app.auth.dependencies import get_current_user
from app.core.database import SessionLocal
from app.imports import repository, schemas, service
from app.users import models as user_models


router = APIRouter(prefix="/imports", tags=["Imports"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/", response_model=schemas.ImportJobOut)
async def create_import_job(
    event_id: int = Form(...),
    file: UploadFile = File(...),
    db=Depends(get_db),
    current_user: user_models.User = Depends(get_current_user),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="קובץ חסר")

    # שמירת קובץ
    os.makedirs("uploads/imports", exist_ok=True)
    temp_path = os.path.join("uploads", "imports", file.filename)
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    job = repository.create_job(
        db,
        schemas.ImportJobCreate(
            event_id=event_id,
            file_name=file.filename,
            created_by=current_user.id if current_user else None,
        ),
    )

    # משגר משימה ברקע
    service.enqueue_import_job(job.id, event_id, temp_path, current_user.id if current_user else None)

    return job


@router.get("/{job_id}", response_model=schemas.ImportJobOut)
def get_import_job(job_id: int, db=Depends(get_db), current_user: user_models.User = Depends(get_current_user)):
    job = repository.get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")
    return job

