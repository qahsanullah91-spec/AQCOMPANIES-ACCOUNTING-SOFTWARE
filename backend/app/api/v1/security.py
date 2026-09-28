from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app import models
from app.core.security import hash_password, verify_password, create_access_token, decode_access_token
from app.core.permissions import ROLE_PERMISSIONS, PERMISSIONS

router = APIRouter(prefix="/auth", tags=["Authentication & Security"])


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Authenticates user credentials and issues signed JWT access token."""
    user = db.query(models.User).filter(models.User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        # Fallback for plain demo users if any exist
        if not user or user.password_hash != payload.password:
            raise HTTPException(status_code=401, detail="Invalid username or password.")

    token = create_access_token({
        "sub": user.username,
        "user_id": user.id,
        "role": user.role,
    })

    return {
        "status": "SUCCESS",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role,
        }
    }


@router.get("/me")
def get_current_user_profile(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """Retrieves current user identity and active permission matrix."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Bearer token.")

    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    user_id = payload.get("user_id")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    perms = list(ROLE_PERMISSIONS.get(user.role.upper(), set()))
    return {
        "user": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role,
            "permissions": perms,
        }
    }


@router.get("/permissions")
def list_system_permissions():
    """Lists system permissions and default role matrix."""
    return {
        "permissions": PERMISSIONS,
        "roles": {k: list(v) for k, v in ROLE_PERMISSIONS.items()},
    }
