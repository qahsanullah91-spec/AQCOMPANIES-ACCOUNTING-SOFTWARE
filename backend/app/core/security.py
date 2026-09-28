import hmac
import hashlib
import base64
import json
import time
from typing import Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from app.core.config import settings
from app.core.exceptions import PermissionDeniedError


def hash_password(password: str) -> str:
    """Generates PBKDF2-SHA256 password hash with unique salt."""
    salt = base64.b64encode(hashlib.sha256(str(time.time()).encode()).digest()[:16]).decode("utf-8")
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
    return f"pbkdf2_sha256$100000${salt}${base64.b64encode(key).decode('utf-8')}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against a stored PBKDF2 or legacy hash."""
    if not hashed_password:
        return False
    try:
        if hashed_password.startswith("pbkdf2_sha256$"):
            _, iterations, salt, key = hashed_password.split("$")
            new_key = hashlib.pbkdf2_hmac(
                "sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), int(iterations)
            )
            return hmac.compare_digest(base64.b64encode(new_key).decode("utf-8"), key)
        else:
            # Fallback for simple/legacy hashes
            return hmac.compare_digest(hashlib.sha256(plain_password.encode()).hexdigest(), hashed_password)
    except Exception:
        return False


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Creates a signed, URL-safe JSON Web Token with expiration."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": int(expire.timestamp()), "iat": int(now.timestamp())})
    
    header = {"alg": "HS256", "typ": "JWT"}
    header_b64 = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip("=")
    payload_b64 = base64.urlsafe_b64encode(json.dumps(to_encode).encode()).decode().rstrip("=")
    
    msg = f"{header_b64}.{payload_b64}"
    sig = hmac.new(settings.SECRET_KEY.encode(), msg.encode(), hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).decode().rstrip("=")
    
    return f"{msg}.{sig_b64}"


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decodes and cryptographically verifies an access token."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise PermissionDeniedError("Invalid authentication token format.")
        header_b64, payload_b64, sig_b64 = parts
        
        msg = f"{header_b64}.{payload_b64}"
        expected_sig = hmac.new(settings.SECRET_KEY.encode(), msg.encode(), hashlib.sha256).digest()
        actual_sig = base64.urlsafe_b64decode(sig_b64 + "=" * (-len(sig_b64) % 4))
        
        if not hmac.compare_digest(expected_sig, actual_sig):
            raise PermissionDeniedError("Invalid authentication token signature.")
        
        payload_json = base64.urlsafe_b64decode(payload_b64 + "=" * (-len(payload_b64) % 4)).decode()
        payload = json.loads(payload_json)
        
        exp = payload.get("exp")
        if exp and exp < time.time():
            raise PermissionDeniedError("Authentication token has expired.")
        
        return payload
    except PermissionDeniedError:
        raise
    except Exception as e:
        raise PermissionDeniedError(f"Token verification failed: {str(e)}")
