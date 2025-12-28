from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class ImportJobBase(BaseModel):
    id: int
    event_id: int
    file_name: str
    status: str
    total_rows: int
    processed_rows: int
    success_count: int
    error_count: int
    error_log_path: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ImportJobCreate(BaseModel):
    event_id: int
    file_name: str
    created_by: Optional[int] = None


class ImportJobOut(ImportJobBase):
    pass

