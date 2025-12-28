from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.config import settings
from app.auth.dependencies import get_current_user
from app.users.models import User
from . import schemas, repository, models
import logging
import time
import requests

router = APIRouter(prefix="/payments", tags=["payments"])
logger = logging.getLogger(__name__)


@router.get("/config", response_model=schemas.NedarimPlusConfig)
async def get_nedarim_plus_config(current_user: User = Depends(get_current_user)):
    """
    קבלת קונפיגורציה של נדרים פלוס (למשתמשים מחוברים בלבד)
    """
    return schemas.NedarimPlusConfig(
        mosad_id=settings.NEDARIM_PLUS_MOSAD_ID,
        api_valid=settings.NEDARIM_PLUS_API_VALID,
        iframe_url="https://matara.pro/nedarimplus/iframe"
    )


@router.post("", response_model=schemas.Payment)
async def create_payment(
    payment: schemas.PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    יצירת תשלום חדש (לפני שליחה לנדרים פלוס)
    """
    return repository.create_payment(db, payment)


@router.get("/event/{event_id}", response_model=List[schemas.Payment])
async def get_event_payments(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    שליפת כל התשלומים של אירוע
    """
    return repository.get_payments_by_event(db, event_id)


@router.get("/{payment_id}", response_model=schemas.Payment)
async def get_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    שליפת תשלום לפי ID
    """
    payment = repository.get_payment(db, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment


@router.post("/webhook/nedarim-plus/regular")
async def nedarim_plus_webhook_regular(
    request: Request,
    webhook_data: schemas.NedarimPlusWebhookRegular,
    db: Session = Depends(get_db)
):
    """
    Webhook endpoint לקבלת עדכונים מנדרים פלוס - עסקה רגילה
    
    **אין צורך באימות משתמש** - זה callback מהשרת של נדרים פלוס
    """
    
    # בדיקת IP מקור (אבטחה)
    client_ip = request.client.host
    logger.info(f"Received webhook from IP: {client_ip}")
    
    # אימות שהבקשה מגיעה מנדרים פלוס
    if client_ip != settings.NEDARIM_PLUS_CALLBACK_IP:
        logger.warning(f"Webhook from unauthorized IP: {client_ip}")
        # בסביבת פיתוח, נאפשר גם מlocalhost
        if client_ip not in ["127.0.0.1", "::1", "localhost"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unauthorized IP address"
            )
    
    # שמירת לוג של הwebhook (לדיבאגינג)
    try:
        raw_data = webhook_data.model_dump()
        repository.create_payment_log(
            db,
            payment_id=None,  # נעדכן אחר כך
            raw_data=raw_data,
            source_ip=client_ip
        )
    except Exception as e:
        logger.error(f"Error creating payment log: {e}")
    
    # עדכון התשלום
    try:
        payment = repository.update_payment_from_webhook_regular(db, webhook_data)
        
        if not payment:
            logger.warning(f"Payment not found for TransactionId: {webhook_data.TransactionId}")
            return {"status": "error", "message": "Payment not found"}
        
        logger.info(f"Payment updated successfully: {payment.id}, TransactionId: {webhook_data.TransactionId}")
        
        return {
            "status": "success",
            "payment_id": payment.id,
            "transaction_id": webhook_data.TransactionId
        }
        
    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing webhook: {str(e)}"
        )


@router.post("/webhook/nedarim-plus/keva")
async def nedarim_plus_webhook_keva(
    request: Request,
    webhook_data: schemas.NedarimPlusWebhookKeva,
    db: Session = Depends(get_db)
):
    """
    Webhook endpoint לקבלת עדכונים מנדרים פלוס - הוראת קבע
    
    **אין צורך באימות משתמש** - זה callback מהשרת של נדרים פלוס
    """
    
    # בדיקת IP מקור (אבטחה)
    client_ip = request.client.host
    logger.info(f"Received keva webhook from IP: {client_ip}")
    
    # אימות שהבקשה מגיעה מנדרים פלוס
    if client_ip != settings.NEDARIM_PLUS_CALLBACK_IP:
        logger.warning(f"Keva webhook from unauthorized IP: {client_ip}")
        if client_ip not in ["127.0.0.1", "::1", "localhost"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unauthorized IP address"
            )
    
    # שמירת לוג
    try:
        raw_data = webhook_data.model_dump()
        repository.create_payment_log(
            db,
            payment_id=None,
            raw_data=raw_data,
            source_ip=client_ip
        )
    except Exception as e:
        logger.error(f"Error creating payment log: {e}")
    
    # עדכון התשלום
    try:
        payment = repository.update_payment_from_webhook_keva(db, webhook_data)
        
        if not payment:
            logger.warning(f"Payment not found for KevaId: {webhook_data.KevaId}")
            return {"status": "error", "message": "Payment not found"}
        
        logger.info(f"Keva payment updated successfully: {payment.id}, KevaId: {webhook_data.KevaId}")
        
        return {
            "status": "success",
            "payment_id": payment.id,
            "keva_id": webhook_data.KevaId
        }
        
    except Exception as e:
        logger.error(f"Error processing keva webhook: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing webhook: {str(e)}"
        )


@router.post("/nedarim-plus/keva/new", response_model=schemas.NewMasavKevaResponse)
async def create_new_masav_keva(
    body: schemas.NewMasavKevaRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    יצירת הוראת קבע חדשה (MASAV) לפי הדוקומנטציה: NewMasavKeva
    שולח בקשה כ-form-encoded ל-https://matara.pro/nedarimplus/Reports/Masav3.aspx
    """
    url = "https://matara.pro/nedarimplus/Reports/Masav3.aspx"

    # קשיחות קלות לפי הדוקומנטציה
    if body.Status == "1" and not body.SignImage:
        raise HTTPException(status_code=400, detail="SignImage נדרש כאשר Status=1")

    # NextDate חייב להיות אחד מהימים המותרים
    allowed_days = {"1", "5", "10", "15", "20", "25", "28"}
    if str(body.NextDate) not in allowed_days:
        raise HTTPException(status_code=400, detail="NextDate לא חוקי. ערכים מותרים: 1,5,10,15,20,25,28")

    # Tashlumim ריק אם רוצים ללא הגבלה
    tashlumim = body.Tashlumim if (body.Tashlumim is not None and body.Tashlumim != "0") else ""

    # הכנת גוף הטופס המדויק
    form_data = {
        "Action": "NewMasavKeva",
        "MosadNumber": settings.NEDARIM_PLUS_MOSAD_ID,
        "ApiPassword": settings.NEDARIM_PLUS_API_VALID,
        "AjaxId": str(int(time.time() * 1000)),

        # פרטי לקוח
        "ClientName": body.ClientName,
        "ClientAdresse": body.ClientAdresse or "",
        "ClientZeout": body.ClientZeout or "",
        "ClientPhone": body.ClientPhone or "",
        "ClientMail": body.ClientMail or "",

        # פרטי בנק
        "Bank": body.Bank,
        "Agency": body.Agency,
        "Account": body.Account,

        # פרטי הוראת קבע
        "NextDate": str(body.NextDate),
        "Amount": str(body.Amount),
        "Tashlumim": tashlumim,
        "Groupe": body.Groupe or "",
        "Comments": body.Comments or "",
        "Status": body.Status,
    }

    if body.Status == "1" and body.SignImage:
        form_data["SignImage"] = body.SignImage

    # Log מה נשלח (ללא סיסמה)
    form_data_log = {k: v if k != "ApiPassword" else "***" for k, v in form_data.items()}
    logger.info(f"MASAV sending to Nedarim Plus: {form_data_log}")

    try:
        resp = requests.post(url, data=form_data, timeout=20)
        logger.info(f"MASAV response status: {resp.status_code}")
    except requests.RequestException as e:
        logger.error(f"MASAV request failed: {e}")
        raise HTTPException(status_code=502, detail=f"Nedarim MASAV request failed: {str(e)}")

    # תגובה ב-JSON לפי הדוקומנטציה
    try:
        res_json = resp.json()
        logger.info(f"MASAV full response: {res_json}")
    except Exception:
        logger.error(f"MASAV bad response text: {resp.text[:500]}")
        raise HTTPException(status_code=502, detail="Bad response from Nedarim MASAV")

    if res_json.get("Result") != "OK":
        # החזר הודעת השגיאה המלאה של נדרים
        error_msg = res_json.get("Message") or res_json.get("Alert") or "MASAV Error"
        logger.error(f"MASAV error from Nedarim: {error_msg}, Full response: {res_json}")
        raise HTTPException(status_code=400, detail=error_msg)

    # שמירת תשלום עם keva_id לשיוך
    try:
        keva_id = res_json.get("ID")
        if keva_id:
            payment = models.Payment(
                event_id=body.event_id,
                guest_id=body.guest_id,
                amount=float(body.Amount) if str(body.Amount).replace('.', '', 1).isdigit() else 0.0,
                payment_type="HK",
                currency="1",
                zeout=body.ClientZeout or None,
                client_name=body.ClientName,
                address=body.ClientAdresse or None,
                phone=body.ClientPhone or None,
                mail=body.ClientMail or None,
                tashloumim=int(body.Tashlumim) if (body.Tashlumim and body.Tashlumim.isdigit()) else 1,
                groupe=body.Groupe or None,
                comments=body.Comments or None,
                status="pending",
                keva_id=keva_id,
            )
            db.add(payment)
            db.commit()
    except Exception as e:
        logger.error(f"Failed to persist keva payment: {e}")

    return res_json

@router.patch("/{payment_id}", response_model=schemas.Payment)
async def update_payment(
    payment_id: int,
    update_data: schemas.PaymentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    עדכון תשלום
    """
    payment = repository.update_payment(db, payment_id, update_data)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment

