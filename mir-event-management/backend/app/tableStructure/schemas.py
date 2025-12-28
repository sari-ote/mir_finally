from pydantic import BaseModel
from typing import Optional


class TableStructureBase(BaseModel):
    column_name: str
    display_order: int = 0
    is_base_field: Optional[str] = None


class TableStructureCreate(TableStructureBase):
    pass


class TableStructureUpdate(BaseModel):
    column_name: Optional[str] = None
    display_order: Optional[int] = None
    is_base_field: Optional[str] = None


class TableStructureOut(TableStructureBase):
    id: int

    class Config:
        from_attributes = True

