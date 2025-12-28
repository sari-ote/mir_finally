from sqlalchemy.orm import Session
from app.greetings import models, schemas, repository
from typing import List, Optional

class GreetingService:
    """שירות לניהול ברכות"""
    
    @staticmethod
    def create_greeting(db: Session, greeting_data: schemas.GreetingCreate) -> models.Greeting:
        """יצירת ברכה חדשה עם ולידציה"""
        # ולידציה של תוכן הברכה
        if not greeting_data.content or len(greeting_data.content.strip()) < 1:
            raise ValueError("תוכן הברכה הוא חובה")
        
        if len(greeting_data.content) > 5000:
            raise ValueError("תוכן הברכה לא יכול להיות יותר מ-5000 תווים")
        
        # ולידציה של שם החותם
        if not greeting_data.signer_name or len(greeting_data.signer_name.strip()) < 1:
            raise ValueError("שם החותם הוא חובה")
        
        return repository.create_greeting(db, greeting_data)
    
    @staticmethod
    def create_or_update_greeting(db: Session, greeting_data: schemas.GreetingCreate) -> models.Greeting:
        """יצירת ברכה חדשה או עדכון ברכה קיימת למוזמן"""
        # בדיקה אם כבר קיימת ברכה למוזמן זה
        existing_greeting = repository.get_greeting_by_guest(db, greeting_data.guest_id)
        
        if existing_greeting:
            # עדכון ברכה קיימת
            update_data = schemas.GreetingUpdate(
                content=greeting_data.content,
                formatted_content=greeting_data.formatted_content,
                signer_name=greeting_data.signer_name,
                file_path=greeting_data.file_path,
                file_name=greeting_data.file_name,
                phone=greeting_data.phone
            )
            return repository.update_greeting(db, existing_greeting.id, update_data)
        else:
            # יצירת ברכה חדשה
            return GreetingService.create_greeting(db, greeting_data)
    
    @staticmethod
    def get_greeting(db: Session, greeting_id: int) -> Optional[models.Greeting]:
        """קבלת ברכה לפי מזהה"""
        return repository.get_greeting(db, greeting_id)
    
    @staticmethod
    def get_greetings_by_event(db: Session, event_id: int) -> List[models.Greeting]:
        """קבלת כל הברכות לאירוע"""
        return repository.get_greetings_by_event(db, event_id)
    
    @staticmethod
    def get_greetings_by_event_with_guest(db: Session, event_id: int) -> List[models.Greeting]:
        """קבלת כל הברכות לאירוע עם פרטי מוזמן"""
        return repository.get_greetings_by_event_with_guest(db, event_id)
    
    @staticmethod
    def get_greeting_by_guest(db: Session, guest_id: int) -> Optional[models.Greeting]:
        """קבלת ברכה של מוזמן"""
        return repository.get_greeting_by_guest(db, guest_id)
    
    @staticmethod
    def update_greeting(db: Session, greeting_id: int, greeting_data: schemas.GreetingUpdate) -> Optional[models.Greeting]:
        """עדכון ברכה עם ולידציה"""
        # בדיקה שהברכה קיימת
        existing_greeting = repository.get_greeting(db, greeting_id)
        if not existing_greeting:
            return None
        
        # ולידציה של תוכן הברכה אם השתנה
        if greeting_data.content is not None:
            if len(greeting_data.content.strip()) < 1:
                raise ValueError("תוכן הברכה הוא חובה")
            
            if len(greeting_data.content) > 5000:
                raise ValueError("תוכן הברכה לא יכול להיות יותר מ-5000 תווים")
        
        # ולידציה של שם החותם אם השתנה
        if greeting_data.signer_name is not None:
            if len(greeting_data.signer_name.strip()) < 1:
                raise ValueError("שם החותם הוא חובה")
        
        return repository.update_greeting(db, greeting_id, greeting_data)
    
    @staticmethod
    def delete_greeting(db: Session, greeting_id: int) -> bool:
        """מחיקת ברכה"""
        return repository.delete_greeting(db, greeting_id)
    
    @staticmethod
    def approve_greeting(db: Session, greeting_id: int) -> Optional[models.Greeting]:
        """אישור ברכה"""
        greeting = repository.get_greeting(db, greeting_id)
        if not greeting:
            return None
        
        greeting.is_approved = True
        db.commit()
        db.refresh(greeting)
        return greeting
    
    @staticmethod
    def get_approved_greetings_by_event(db: Session, event_id: int) -> List[models.Greeting]:
        """קבלת כל הברכות המאושרות לאירוע"""
        return db.query(models.Greeting).filter(
            models.Greeting.event_id == event_id,
            models.Greeting.is_approved == True
        ).all() 

    @staticmethod
    def get_greeting_by_name_and_phone(db: Session, event_id: int, first_name: str, last_name: str, phone: str) -> Optional[schemas.PreviousGreetingOut]:
        """חיפוש ברכה באירוע הנוכחי לפי שם וטלפון"""
        greeting = repository.get_greeting_by_name_and_phone(
            db,
            event_id=event_id,
            first_name=first_name or "",
            last_name=last_name or "",
            phone=phone or "",
        )
        if not greeting:
            return None

        return schemas.PreviousGreetingOut(
            content=greeting.content or "",
            signer_name=greeting.signer_name or "",
            event_id=greeting.event_id,
            event_name=None,  # לא נדרש כי זה באירוע הנוכחי
            event_date=None,
            created_at=greeting.created_at,
            formatted_content=getattr(greeting, 'formatted_content', None),
            file_path=getattr(greeting, 'file_path', None),
            file_name=getattr(greeting, 'file_name', None),
        )

    @staticmethod
    def get_previous_greeting_for_event(db: Session, event_id: int, id_number: str) -> Optional[schemas.PreviousGreetingOut]:
        """שליפת הברכה האחרונה עבור מוזמן עם ת\"ז נתונה מאירועים קודמים."""
        normalized_id = (id_number or "").strip()
        if not normalized_id:
            raise ValueError("id_number is required")

        greeting = repository.get_previous_greeting_by_id_number(
            db,
            current_event_id=event_id,
            id_number=normalized_id,
        )
        if not greeting:
            return None

        event = greeting.event
        return schemas.PreviousGreetingOut(
            content=greeting.content or "",
            signer_name=greeting.signer_name or "",
            event_id=greeting.event_id,
            event_name=event.name if event else None,
            event_date=getattr(event, "date", None) if event else None,
            created_at=greeting.created_at,
            formatted_content=getattr(greeting, 'formatted_content', None),
            file_path=getattr(greeting, 'file_path', None),
            file_name=getattr(greeting, 'file_name', None),
        )