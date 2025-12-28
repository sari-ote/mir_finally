from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class GreetingBase(BaseModel):
    content: str
    signer_name: str

class GreetingCreate(GreetingBase):
    guest_id: int
    event_id: int
    formatted_content: Optional[str] = None
    file_path: Optional[str] = None
    file_name: Optional[str] = None
    phone: Optional[str] = None

class GreetingUpdate(BaseModel):
    content: Optional[str] = None
    formatted_content: Optional[str] = None
    signer_name: Optional[str] = None
    file_path: Optional[str] = None
    file_name: Optional[str] = None
    phone: Optional[str] = None
    is_approved: Optional[bool] = None

class GreetingOut(GreetingBase):
    id: int
    guest_id: int
    event_id: int
    formatted_content: Optional[str] = None
    file_path: Optional[str] = None
    file_name: Optional[str] = None
    phone: Optional[str] = None
    created_at: datetime
    is_approved: bool
    
    class Config:
        from_attributes = True

class BlessingListOut(BaseModel):
    """Schema להצגת ברכות ברשימה עם פרטי מוזמן"""
    id: int
    guest_id: int
    event_id: int
    content: str
    formatted_content: Optional[str] = None
    signer_name: str
    file_path: Optional[str] = None
    file_name: Optional[str] = None
    phone: Optional[str] = None
    created_at: datetime
    is_approved: bool
    # פרטי מוזמן
    guest_first_name: Optional[str] = None
    guest_last_name: Optional[str] = None
    guest_full_name: Optional[str] = None
    
    class Config:
        from_attributes = True 


class PreviousGreetingOut(BaseModel):
    content: str
    signer_name: str
    event_id: int
    event_name: Optional[str] = None
    event_date: Optional[datetime] = None
    created_at: Optional[datetime] = None
    formatted_content: Optional[str] = None
    file_path: Optional[str] = None
    file_name: Optional[str] = None