from pydantic import BaseModel, EmailStr, validator, Field

class UserBase(BaseModel):
    username: str
    full_name: str  
    email: str
    role: str  # admin / event_manager / viewer
    id_number: str | None = Field(default=None)
    
class UserCreate(UserBase):
    password: str

    @validator('password')
    def validate_password_min_length(cls, v):
        # Only check minimum length, bcrypt will handle max length
        if len(v) < 4:
            raise ValueError('הסיסמה קצרה מדי (מינימום 4 תווים)')
        return v

    @validator('id_number', pre=True, always=True)
    def validate_id_number(cls, v):
        if v is None or v == "" or (isinstance(v, str) and v.strip() == ""):
            return None
        v = str(v).strip()
        if not v.isdigit() or len(v) != 9:
            raise ValueError('תעודת זהות לא תקינה')
        # אלגוריתם בדיקת ת"ז ישראלית
        v = v.zfill(9)
        s = sum(sum(divmod(int(d) * (1 + i % 2), 10)) for i, d in enumerate(v))
        if s % 10 != 0:
            raise ValueError('תעודת זהות לא תקינה')
        return v

class UserUpdate(BaseModel):
    username: str | None = None
    full_name: str | None = None
    email: str | None = None
    password: str | None = None
    role: str | None = None
    id_number: str | None = None

class UserOut(UserBase):
    id: int

    class Config:
        from_attributes = True
