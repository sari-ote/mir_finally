"""
שירות שליחת מיילים - Email Service
"""
import smtplib
import threading
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import Optional
import os

from app.core.config import settings


def send_greeting_notification_email(
    guest_name: str,
    signer_name: str,
    content: str,
    phone: Optional[str] = None,
    file_path: Optional[str] = None,
    file_name: Optional[str] = None
):
    """
    שליחת התראה במייל על ברכה חדשה
    
    Args:
        guest_name: שם המוזמן
        signer_name: שם חותם הברכה
        content: תוכן הברכה
        phone: טלפון (אופציונלי)
        file_path: נתיב לקובץ מצורף (אופציונלי)
        file_name: שם הקובץ המקורי (אופציונלי)
    """
    # בדיקה אם שליחת מיילים מופעלת
    if not settings.SEND_GREETING_EMAILS:
        print("[Email] שליחת מיילים מושבתת (SEND_GREETING_EMAILS=False)")
        return
    
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        print("[Email] חסרים פרטי SMTP (SMTP_USER / SMTP_PASSWORD)")
        return
    
    if not settings.GREETING_NOTIFICATION_EMAIL:
        print("[Email] לא הוגדר מייל יעד (GREETING_NOTIFICATION_EMAIL)")
        return
    
    try:
        # יצירת המייל
        msg = MIMEMultipart()
        msg['From'] = settings.SMTP_USER
        msg['To'] = settings.GREETING_NOTIFICATION_EMAIL
        msg['Subject'] = f"התקבלה ברכה חדשה מ{guest_name}"
        
        # תוכן המייל בעברית
        body = f"""
📬 התקבלה ברכה חדשה!
━━━━━━━━━━━━━━━━━━━━━

👤 שם המוזמן: {guest_name}
✍️ חותם הברכה: {signer_name}
📱 טלפון: {phone or 'לא צוין'}

📝 תוכן הברכה:
────────────────────────────────
{content}
────────────────────────────────

📎 קובץ מצורף: {file_name or 'אין'}
"""
        
        msg.attach(MIMEText(body, 'plain', 'utf-8'))
        
        # הוספת קובץ מצורף אם קיים
        if file_path and os.path.exists(file_path):
            try:
                with open(file_path, 'rb') as attachment:
                    part = MIMEBase('application', 'octet-stream')
                    part.set_payload(attachment.read())
                encoders.encode_base64(part)
                part.add_header(
                    'Content-Disposition',
                    f'attachment; filename= {file_name or os.path.basename(file_path)}'
                )
                msg.attach(part)
            except Exception as e:
                print(f"[Email] שגיאה בצירוף קובץ: {e}")
        
        # שליחת המייל
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        
        print(f"[Email] נשלחה התראה על ברכה חדשה מ{guest_name} ל-{settings.GREETING_NOTIFICATION_EMAIL}")
        
    except Exception as e:
        print(f"[Email] שגיאה בשליחת מייל: {e}")


def send_greeting_notification_async(
    guest_name: str,
    signer_name: str,
    content: str,
    phone: Optional[str] = None,
    file_path: Optional[str] = None,
    file_name: Optional[str] = None
):
    """
    שליחת התראה במייל ברקע (לא חוסם את התגובה)
    """
    thread = threading.Thread(
        target=send_greeting_notification_email,
        args=(guest_name, signer_name, content, phone, file_path, file_name)
    )
    thread.daemon = True
    thread.start()

