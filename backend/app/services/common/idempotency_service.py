import hashlib
import json
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session

from app import models
from app.core.exceptions import ValidationError, DuplicateTransactionError


class IdempotencyService:
    """
    Authoritative Idempotency Manager for AQ COMPANIES.
    Ensures safe retry of financial POST requests without duplicate side-effects.
    Uses SHA-256 payload hashing and response caching.
    """

    @staticmethod
    def compute_request_hash(data: Any) -> str:
        if isinstance(data, (dict, list)):
            canonical_json = json.dumps(data, sort_keys=True, separators=(",", ":"), default=str)
        elif isinstance(data, bytes):
            canonical_json = data.decode("utf-8", errors="ignore")
        else:
            canonical_json = str(data or "")
        return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()

    @classmethod
    def process_key(
        cls,
        db: Session,
        key: str,
        endpoint: str,
        payload: Any,
        company_id: Optional[int] = None,
        user_id: Optional[int] = None,
    ) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """
        Validates idempotency key against database:
        Returns:
            (is_duplicate, cached_response_dict_or_none)
        If duplicate and completed: returns (True, cached_data)
        If duplicate and payload differs: raises ValidationError (KEY_REUSE_PAYLOAD_MISMATCH)
        If new: records initial 'PROCESSING' state and returns (False, None)
        """
        if not key or not key.strip():
            return False, None

        key_clean = key.strip()
        req_hash = cls.compute_request_hash(payload)
        now_dt = datetime.now(timezone.utc)

        existing = db.query(models.ApiIdempotencyKey).filter(
            models.ApiIdempotencyKey.key == key_clean
        ).first()

        if existing:
            # Check expiration
            if existing.expires_at and existing.expires_at.replace(tzinfo=timezone.utc) < now_dt:
                # Expired: delete and permit renewal
                db.delete(existing)
                db.flush()
            else:
                # Active key
                if existing.request_hash != req_hash:
                    raise ValidationError(
                        message=f"Idempotency-Key '{key_clean}' was already used with a different request payload.",
                        details={"key": key_clean, "endpoint": endpoint, "error_code": "IDEMPOTENCY_PAYLOAD_MISMATCH"}
                    )
                if existing.status == "COMPLETED" and existing.response_body:
                    try:
                        cached_body = json.loads(existing.response_body)
                    except Exception:
                        cached_body = {"raw": existing.response_body}
                    return True, {
                        "status_code": existing.response_status or 200,
                        "data": cached_body,
                        "cached": True,
                    }
                elif existing.status == "PROCESSING":
                    raise DuplicateTransactionError(
                        message=f"Request with Idempotency-Key '{key_clean}' is currently in progress. Please retry shortly.",
                        details={"key": key_clean, "status": "PROCESSING"}
                    )

        # Record new processing key
        new_entry = models.ApiIdempotencyKey(
            key=key_clean,
            user_id=user_id,
            company_id=company_id,
            endpoint=endpoint,
            request_hash=req_hash,
            status="PROCESSING",
            created_at=now_dt,
            expires_at=now_dt + timedelta(hours=24),
        )
        db.add(new_entry)
        db.flush()
        return False, None

    @classmethod
    def save_response(
        cls,
        db: Session,
        key: str,
        response_status: int,
        response_data: Any,
    ) -> None:
        """
        Updates idempotency record to COMPLETED with serialized response body.
        """
        if not key or not key.strip():
            return

        key_clean = key.strip()
        entry = db.query(models.ApiIdempotencyKey).filter(
            models.ApiIdempotencyKey.key == key_clean
        ).first()

        if entry:
            entry.status = "COMPLETED"
            entry.response_status = response_status
            if isinstance(response_data, (dict, list)):
                entry.response_body = json.dumps(response_data, default=str)
            else:
                entry.response_body = str(response_data)
            db.commit()
