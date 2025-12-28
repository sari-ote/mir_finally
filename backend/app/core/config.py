# backend/app/core/config.py

class Settings:
    # שם הפרויקט
    PROJECT_NAME: str = "MyEventSystem"

    # מסד נתונים לפיתוח – SQLite בקובץ mir_events.db בתוך backend
    DATABASE_URL: str = "sqlite:///./mir_events.db"

    # מפתח סודי ל-JWT וכו' – לפיתוח אפשר משהו פשוט
    SECRET_KEY: str = "super-secret-dev-key-change-me"

    # אלגוריתם חתימה
    ALGORITHM: str = "HS256"

    # זמן תפוגה של טוקן (בדקות)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # משתמשי על
    SUPERADMINS: list[str] = ["admin@example.com", "sari@example.com"]

    # הגדרות נדרים פלוס (לא קריטי להרצה אצלך)
    NEDARIM_PLUS_MOSAD_ID: str = ""
    NEDARIM_PLUS_API_VALID: str = ""
    NEDARIM_PLUS_CALLBACK_IP: str = "18.194.219.73"


settings = Settings()
