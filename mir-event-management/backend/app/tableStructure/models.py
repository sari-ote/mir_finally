from sqlalchemy import Column, Integer, String
from app.core.database import Base


class TableStructure(Base):
    """
    מבנה גלובלי של הטבלה - רשימת העמודות והסדר שלהן.
    זה לא event-specific, אלא גלובלי לכל האירועים.
    """
    __tablename__ = "table_structure"

    id = Column(Integer, primary_key=True, index=True)
    column_name = Column(String, nullable=False, unique=True)  # שם העמודה (למשל "שם", "טלפון")
    display_order = Column(Integer, nullable=False, default=0)  # סדר התצוגה בטבלה
    is_base_field = Column(String, nullable=True)  # האם זה שדה בסיסי (true/false/null)
    
    def __repr__(self):
        return f"<TableStructure(id={self.id}, column_name='{self.column_name}', display_order={self.display_order})>"

