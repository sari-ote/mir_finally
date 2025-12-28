from sqlalchemy.orm import Session
from app.tableStructure import models, schemas
from typing import List, Optional


def get_all_table_structure(db: Session) -> List[models.TableStructure]:
    """מחזיר את כל מבנה הטבלה ממוין לפי display_order"""
    return db.query(models.TableStructure).order_by(models.TableStructure.display_order.asc()).all()


def get_table_structure_by_name(db: Session, column_name: str) -> Optional[models.TableStructure]:
    """מחזיר מבנה טבלה לפי שם עמודה"""
    return db.query(models.TableStructure).filter(models.TableStructure.column_name == column_name).first()


def create_table_structure(db: Session, structure: schemas.TableStructureCreate) -> models.TableStructure:
    """יוצר מבנה טבלה חדש"""
    db_structure = models.TableStructure(**structure.model_dump())
    db.add(db_structure)
    db.commit()
    db.refresh(db_structure)
    return db_structure


def update_table_structure(db: Session, structure_id: int, updates: schemas.TableStructureUpdate) -> Optional[models.TableStructure]:
    """מעדכן מבנה טבלה קיים"""
    db_structure = db.query(models.TableStructure).filter(models.TableStructure.id == structure_id).first()
    if db_structure:
        update_data = updates.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_structure, key, value)
        db.commit()
        db.refresh(db_structure)
    return db_structure


def upsert_table_structure(db: Session, column_name: str, display_order: int, is_base_field: Optional[str] = None) -> models.TableStructure:
    """יוצר או מעדכן מבנה טבלה (upsert)"""
    existing = get_table_structure_by_name(db, column_name)
    if existing:
        existing.display_order = display_order
        if is_base_field is not None:
            existing.is_base_field = is_base_field
        db.commit()
        db.refresh(existing)
        return existing
    else:
        new_structure = models.TableStructure(
            column_name=column_name,
            display_order=display_order,
            is_base_field=is_base_field
        )
        db.add(new_structure)
        db.commit()
        db.refresh(new_structure)
        return new_structure


def update_table_structure_from_columns(db: Session, columns: List[str], base_fields: List[str] = None):
    """
    מעדכן את מבנה הטבלה לפי רשימת עמודות (למשל מעמודות של אקסל).
    base_fields - רשימת שדות בסיסיים שלא צריכים להיות במבנה הגלובלי
    """
    if base_fields is None:
        base_fields = ["id", "table_head_id", "confirmed_arrival"]
    
    # הסר שדות בסיסיים מהרשימה
    columns_to_add = [col for col in columns if col not in base_fields]
    
    # קבל את המבנה הנוכחי
    existing_structures = {s.column_name: s for s in get_all_table_structure(db)}
    
    # עדכן או צור מבנה חדש לכל עמודה
    for idx, column_name in enumerate(columns_to_add):
        if column_name and column_name.strip():
            column_name = column_name.strip()
            is_base = "true" if column_name in base_fields else None
            upsert_table_structure(db, column_name, idx, is_base)
    
    db.commit()


def delete_table_structure(db: Session, structure_id: int) -> bool:
    """מוחק מבנה טבלה"""
    db_structure = db.query(models.TableStructure).filter(models.TableStructure.id == structure_id).first()
    if db_structure:
        db.delete(db_structure)
        db.commit()
        return True
    return False

