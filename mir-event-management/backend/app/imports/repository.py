from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

from app.imports import models, schemas


def create_job(db: Session, data: schemas.ImportJobCreate) -> models.ImportJob:
    job = models.ImportJob(
        event_id=data.event_id,
        file_name=data.file_name,
        created_by=data.created_by,
        status="pending",
        total_rows=0,
        processed_rows=0,
        success_count=0,
        error_count=0,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def get_job(db: Session, job_id: int) -> Optional[models.ImportJob]:
    return db.query(models.ImportJob).filter(models.ImportJob.id == job_id).first()


def update_job_status(
    db: Session,
    job_id: int,
    *,
    status: Optional[str] = None,
    total_rows: Optional[int] = None,
    processed_rows: Optional[int] = None,
    success_count: Optional[int] = None,
    error_count: Optional[int] = None,
    error_log_path: Optional[str] = None,
    started_at: Optional[datetime] = None,
    finished_at: Optional[datetime] = None,
) -> Optional[models.ImportJob]:
    job = get_job(db, job_id)
    if not job:
        return None
    if status is not None:
        job.status = status
    if total_rows is not None:
        job.total_rows = total_rows
    if processed_rows is not None:
        job.processed_rows = processed_rows
    if success_count is not None:
        job.success_count = success_count
    if error_count is not None:
        job.error_count = error_count
    if error_log_path is not None:
        job.error_log_path = error_log_path
    if started_at is not None:
        job.started_at = started_at
    if finished_at is not None:
        job.finished_at = finished_at
    db.commit()
    db.refresh(job)
    return job

