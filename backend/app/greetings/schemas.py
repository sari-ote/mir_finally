from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class GreetingBase(BaseModel):
    content: str
    signer_name: str

class GreetingCreate(GreetingBase):
    guest_id: int
    event_id: int

class GreetingUpdate(BaseModel):
    content: Optional[str] = None
    signer_name: Optional[str] = None
    is_approved: Optional[bool] = None

class GreetingOut(GreetingBase):
    id: int
    guest_id: int
    event_id: int
    created_at: datetime
    is_approved: bool
    
    class Config:
        from_attributes = True 


class PreviousGreetingOut(BaseModel):
    content: str
    signer_name: str
    event_id: int
    event_name: Optional[str] = None
    event_date: Optional[datetime] = None
    created_at: Optional[datetime] = None