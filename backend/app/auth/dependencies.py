from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from app.core.config import settings
from app.auth.schemas import TokenData
from app.users.models import User
from app.core.database import SessionLocal
from sqlalchemy.orm import Session



oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM

# Debug: print SECRET_KEY and ALGORITHM on import
print(f"DEBUG: SECRET_KEY loaded: {SECRET_KEY[:20]}... (length: {len(SECRET_KEY)})")
print(f"DEBUG: ALGORITHM: {ALGORITHM}")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="לא ניתן לאמת את המשתמש",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        print(f"DEBUG: get_current_user - token payload sub: {user_id}, role: {payload.get('role')}")
        if user_id is None:
            print("DEBUG: user_id is None in token payload")
            raise credentials_exception
    except JWTError as e:
        print(f"DEBUG: JWTError in get_current_user: {e}")
        print(f"DEBUG: Token (first 50 chars): {token[:50] if token else 'None'}...")
        raise credentials_exception
    except Exception as e:
        print(f"DEBUG: Unexpected error in get_current_user: {e}")
        import traceback
        traceback.print_exc()
        raise credentials_exception

    # Check if user_id is an email (for superadmins) or an ID (for regular users)
    user = None
    # Convert to string first to handle both string and int cases
    user_id_str = str(user_id) if user_id is not None else ""
    if "@" in user_id_str:
        # It's an email - find user by email (for superadmins)
        user = db.query(User).filter(User.email == user_id_str).first()
        if user is None:
            # If user doesn't exist, check if it's a superadmin and find/create real user
            from app.core.config import settings
            if user_id_str in settings.SUPERADMINS:
                # Try to find the admin user by email
                admin_user = db.query(User).filter(User.email == user_id_str).first()
                if admin_user:
                    print(f"DEBUG: Found admin user in DB: {admin_user.email}, role: {admin_user.role}")
                    return admin_user
                # If not found, return a virtual user object for superadmin
                print(f"DEBUG: Creating VirtualUser for superadmin: {user_id_str}")
                class VirtualUser:
                    def __init__(self, email):
                        self.id = 0
                        self.email = email
                        self.role = "admin"
                        self.full_name = "מנהל מערכת"
                        self.is_active = True
                virtual_user = VirtualUser(user_id_str)
                print(f"DEBUG: VirtualUser created - role: {virtual_user.role}, email: {virtual_user.email}")
                return virtual_user
            raise credentials_exception
        else:
            print(f"DEBUG: Found user in DB: {user.email}, role: {user.role}, id: {user.id}")
    else:
        # It's an ID - find user by ID
        try:
            user_id_int = int(user_id_str)
            user = db.query(User).filter(User.id == user_id_int).first()
        except (ValueError, TypeError):
            raise credentials_exception
    
    if user is None:
        raise credentials_exception
    return user
