from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "MyEventSystem"
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    SUPERADMINS: list[str] = ["admin@example.com", "sari@example.com"]
    
    # Nedarim Plus Configuration
    NEDARIM_PLUS_MOSAD_ID: str = ""  # מזהה מוסד (7 ספרות)
    NEDARIM_PLUS_API_VALID: str = ""  # טקסט אימות
    NEDARIM_PLUS_CALLBACK_IP: str = "18.194.219.73"  # IP של נדרים פלוס לאימות
    
    # Email Configuration (SMTP)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""  # כתובת המייל לשליחה
    SMTP_PASSWORD: str = ""  # App Password של Gmail
    GREETING_NOTIFICATION_EMAIL: str = ""  # המייל שיקבל התראות על ברכות
    SEND_GREETING_EMAILS: bool = False  # האם לשלוח מיילים על ברכות חדשות

    class Config:
        env_file = ".env"

settings = Settings()
