import logging
from logging.handlers import RotatingFileHandler
import os
import json
import time
import uuid
from typing import Any, Dict, Optional, List
from datetime import datetime, timezone
from collections import deque
import threading

from app.core.config import settings

# Initialize root logger
logger = logging.getLogger("aq_companies")
log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
logger.setLevel(log_level)

# Setup Console Handler
if not any(isinstance(h, logging.StreamHandler) and not isinstance(h, RotatingFileHandler) for h in logger.handlers):
    console_handler = logging.StreamHandler()
    formatter = logging.Formatter(
        "[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

# Setup Rotating File Handler for production disk retention (Req 74)
try:
    os.makedirs(settings.LOG_PATH, exist_ok=True)
    log_file_path = os.path.join(settings.LOG_PATH, "aq_companies.log")
    if not any(isinstance(h, RotatingFileHandler) for h in logger.handlers):
        file_handler = RotatingFileHandler(
            log_file_path,
            maxBytes=10 * 1024 * 1024,  # 10 MB per file
            backupCount=10,             # Keep 10 rotated backups (100MB total ceiling)
            encoding="utf-8",
        )
        file_formatter = logging.Formatter(
            "[%(asctime)s] [%(levelname)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        file_handler.setFormatter(file_formatter)
        logger.addHandler(file_handler)
except Exception as e:
    print(f"Warning: Could not initialize RotatingFileHandler at {settings.LOG_PATH}: {e}")


def sanitize_payload(payload: Any) -> Any:
    """Removes sensitive credentials, keys, or passwords from logs."""
    if isinstance(payload, dict):
        sanitized = {}
        for k, v in payload.items():
            if any(s in k.lower() for s in ["password", "secret", "token", "auth", "key", "credential", "credit_card"]):
                sanitized[k] = "******"
            else:
                sanitized[k] = sanitize_payload(v)
        return sanitized
    elif isinstance(payload, list):
        return [sanitize_payload(item) for item in payload]
    return payload


# In-memory thread-safe error tracker for Admin Error Viewer (Req 35)
_errors_lock = threading.Lock()
_recent_system_errors = deque(maxlen=200)


def record_system_error(
    request_id: Optional[str] = None,
    module: str = "SYSTEM",
    error: Optional[str] = None,
    endpoint: Optional[str] = None,
    status_code: int = 500,
    details: Optional[Dict[str, Any]] = None,
    user_name: Optional[str] = None,
    company_id: Optional[int] = None,
    route: Optional[str] = None,
    action: Optional[str] = None,
    severity: str = "P2",
    source: str = "FastAPI",
    message: Optional[str] = None,
    **kwargs,
) -> Dict[str, Any]:
    """Records an error into the admin viewer buffer with complete Section 3 & 4 classification."""
    err_text = str(error if error is not None else (message or "Unknown system error"))
    req_id = request_id or f"REQ-{uuid.uuid4().hex[:8].upper()}"
    clean_severity = severity.upper() if severity.upper() in ("P0", "P1", "P2", "P3") else "P2"
    eid = f"ERR-{uuid.uuid4().hex[:8].upper()}"
    entry = {
        "id": eid,
        "error_id": eid,
        "time": datetime.now(timezone.utc).isoformat(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "request_id": req_id,
        "module": module,
        "source": source,
        "endpoint": endpoint or route,
        "route": route or endpoint,
        "user_name": user_name or "SYSTEM",
        "company_id": company_id,
        "action": action or "API_REQUEST",
        "error": err_text,
        "message": err_text,
        "severity": clean_severity,
        "status_code": status_code,
        "resolved": False,
        "resolved_at": None,
        "details": sanitize_payload(details or {}),
    }
    with _errors_lock:
        _recent_system_errors.appendleft(entry)
    return entry


def get_system_errors(
    limit: int = 50,
    unresolved_only: bool = False,
    severity: Optional[str] = None,
    source: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Returns recent sanitized errors for the admin error viewer with optional filtering."""
    with _errors_lock:
        items = list(_recent_system_errors)
    if unresolved_only:
        items = [e for e in items if not e.get("resolved")]
    if severity:
        sev_clean = severity.upper()
        items = [e for e in items if e.get("severity") == sev_clean]
    if source:
        src_clean = source.lower()
        items = [e for e in items if e.get("source", "").lower() == src_clean]
    return items[:limit]


def resolve_system_error(error_id: str) -> bool:
    """Marks a system error as resolved."""
    with _errors_lock:
        for e in _recent_system_errors:
            if e.get("id") == error_id or e.get("error_id") == error_id:
                e["resolved"] = True
                e["resolved_at"] = datetime.now(timezone.utc).isoformat()
                return True
    return False


def get_unresolved_error_count(severity: Optional[str] = None) -> int:
    """Returns count of active unresolved system errors, optionally filtered by severity."""
    with _errors_lock:
        if severity:
            sev_clean = severity.upper()
            return sum(1 for e in _recent_system_errors if not e.get("resolved") and e.get("severity") == sev_clean)
        return sum(1 for e in _recent_system_errors if not e.get("resolved"))


def log_structured_event(
    level: str,
    event_type: str,
    message: str,
    request_id: Optional[str] = None,
    user_id: Optional[int] = None,
    company_id: Optional[int] = None,
    endpoint: Optional[str] = None,
    duration_ms: Optional[float] = None,
    status_code: Optional[int] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> None:
    """Emits structured JSON log entry for centralized auditing & tracing."""
    data = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "level": level.upper(),
        "event_type": event_type,
        "message": message,
        "request_id": request_id or str(uuid.uuid4()),
        "user_id": user_id,
        "company_id": company_id,
        "endpoint": endpoint,
        "duration_ms": duration_ms,
        "status_code": status_code,
        "extra": sanitize_payload(extra or {}),
    }

    log_fn = getattr(logger, level.lower(), logger.info)
    log_fn(json.dumps(data))

    # If error or critical, also register in system error buffer
    if level.upper() in ("ERROR", "CRITICAL") and endpoint != "/health":
        record_system_error(
            request_id=data["request_id"],
            module=event_type,
            error=message,
            endpoint=endpoint,
            status_code=status_code or 500,
            details=extra,
        )


def log_accounting_event(
    action: str,
    reference: str,
    amount: Optional[Any] = None,
    user_name: Optional[str] = None,
    company_id: Optional[int] = None,
    details: Optional[Dict[str, Any]] = None,
) -> None:
    """
    SECTION 32: ACCOUNTING EVENT LOGGING
    Logs important financial events:
    - Receipt Posted
    - Supplier Payment Posted
    - Transport Payment Posted
    - Journal Posted
    - Transaction Reversed
    - Period Closed
    - Reconciliation Closed
    """
    amt_str = f" Amount: {amount}" if amount is not None else ""
    user_str = f" By: {user_name}" if user_name else ""
    msg = f"ACCOUNTING_EVENT [{action}] Ref: {reference}{amt_str}{user_str}"
    
    log_structured_event(
        level="INFO",
        event_type="ACCOUNTING_EVENT",
        message=msg,
        company_id=company_id,
        extra={
            "action": action,
            "reference": reference,
            "amount": str(amount) if amount is not None else None,
            "user_name": user_name,
            "details": details or {},
        },
    )
