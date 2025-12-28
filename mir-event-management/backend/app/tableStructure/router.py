from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.auth.dependencies import get_current_user
from app.users.models import User
from app.tableStructure import schemas, repository

router = APIRouter(prefix="/table-structure", tags=["Table Structure"])


@router.get("/", response_model=List[schemas.TableStructureOut])
def get_table_structure(db: Session = Depends(get_db)):
    """מחזיר את כל מבנה הטבלה"""
    return repository.get_all_table_structure(db)


@router.post("/", response_model=schemas.TableStructureOut)
def create_table_structure(
    structure: schemas.TableStructureCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """יוצר מבנה טבלה חדש"""
    # בדוק אם כבר קיים
    existing = repository.get_table_structure_by_name(db, structure.column_name)
    if existing:
        raise HTTPException(status_code=400, detail="Column name already exists")
    return repository.create_table_structure(db, structure)


@router.put("/{structure_id}", response_model=schemas.TableStructureOut)
def update_table_structure(
    structure_id: int,
    updates: schemas.TableStructureUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """מעדכן מבנה טבלה קיים"""
    updated = repository.update_table_structure(db, structure_id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Table structure not found")
    return updated


@router.delete("/{structure_id}")
def delete_table_structure(
    structure_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """מוחק מבנה טבלה"""
    success = repository.delete_table_structure(db, structure_id)
    if not success:
        raise HTTPException(status_code=404, detail="Table structure not found")
    return {"message": "Table structure deleted successfully"}


@router.post("/update-from-columns")
def update_from_columns(
    columns: List[str],
    base_fields: List[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """מעדכן את מבנה הטבלה לפי רשימת עמודות"""
    repository.update_table_structure_from_columns(db, columns, base_fields)
    return {"message": "Table structure updated successfully"}

