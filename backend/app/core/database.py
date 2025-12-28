from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.core.config import settings  # לוקח את DATABASE_URL מה-Settings


# ה-URL למסד הנתונים מגיע מה-ENV (למשל SQLITE או POSTGRES)
DATABASE_URL = settings.DATABASE_URL

# עבור sqlite צריך פרמטר מיוחד, עבור כל השאר זה ריק
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

print("***** USING DATABASE_URL:", DATABASE_URL)

# יצירת engine
engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
)

# session ו-Base
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# פונקציה לקבלת session לכל בקשה
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
