import time
import uuid
import threading
from typing import Callable
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.logging import log_structured_event
from app.core.exceptions import AQAppException
from app.core.maintenance import is_maintenance_mode, get_maintenance_info
from app.core.config import settings

# Thread-safe counter of active mutations for Section 30 Active Transaction Protection
_writes_lock = threading.Lock()
_active_writes = 0


def get_active_write_count() -> int:
    """Returns number of in-flight mutating requests (POST, PUT, DELETE, PATCH)."""
    with _writes_lock:
        return _active_writes


class RequestTracingMiddleware(BaseHTTPMiddleware):
    """
    Middleware that ensures every request receives a unique X-Request-ID header,
    enforces deployment maintenance mode locks, measures execution duration,
    tracks slow API routes, protects active write transactions, and logs structured access details.
    """
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        global _active_writes
        request_id = request.headers.get("X-Request-ID") or f"REQ-{uuid.uuid4().hex[:8].upper()}"
        request.state.request_id = request_id
        start_time = time.perf_counter()

        is_write = request.method in ("POST", "PUT", "DELETE", "PATCH")

        # Enforce Maintenance Mode / Deployment Lock
        if is_maintenance_mode() and is_write:
            exempt_paths = (
                "/health",
                "/ready",
                "/version",
                "/api/v1/health",
                "/api/v1/version",
                "/api/v1/system/maintenance",
                "/api/system/maintenance",
            )
            bypass_header = request.headers.get("X-Maintenance-Bypass")
            is_bypassed = bool(
                bypass_header and (
                    bypass_header == settings.MAINTENANCE_BYPASS_TOKEN or 
                    bypass_header == settings.SECRET_KEY
                )
            )
            is_exempt = any(request.url.path.startswith(p) for p in exempt_paths)

            if not is_exempt and not is_bypassed:
                return JSONResponse(
                    status_code=503,
                    content={
                        "error": {
                            "code": "MAINTENANCE_MODE",
                            "message": "SYSTEM MAINTENANCE — Financial posting temporarily unavailable.",
                            "reference": request_id,
                            "details": get_maintenance_info(),
                        }
                    },
                    headers={"X-Request-ID": request_id},
                )

        if is_write:
            with _writes_lock:
                _active_writes += 1

        company_id = request.headers.get("X-Company-ID")

        try:
            response = await call_next(request)
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            
            # Attach correlation ID to response
            response.headers["X-Request-ID"] = request_id

            # Section 40: Slow API Monitoring
            if duration_ms > settings.SLOW_API_THRESHOLD_MS and not request.url.path.startswith("/health"):
                log_structured_event(
                    level="WARNING",
                    event_type="SLOW_API_REQUEST",
                    message=f"Slow route detected: {request.method} {request.url.path} took {duration_ms}ms (threshold: {settings.SLOW_API_THRESHOLD_MS}ms)",
                    request_id=request_id,
                    endpoint=request.url.path,
                    duration_ms=duration_ms,
                    status_code=response.status_code,
                    company_id=int(company_id) if company_id and company_id.isdigit() else None,
                )

            # Log structured access event (skip noisy health checks in normal logs)
            if not request.url.path.startswith("/health") or response.status_code >= 400:
                log_structured_event(
                    level="INFO" if response.status_code < 400 else "WARNING",
                    event_type="HTTP_REQUEST",
                    message=f"{request.method} {request.url.path} -> {response.status_code}",
                    request_id=request_id,
                    endpoint=request.url.path,
                    duration_ms=duration_ms,
                    status_code=response.status_code,
                    company_id=int(company_id) if company_id and company_id.isdigit() else None,
                )
            return response

        except AQAppException as exc:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            log_structured_event(
                level="WARNING",
                event_type="BUSINESS_EXCEPTION",
                message=exc.message,
                request_id=request_id,
                endpoint=request.url.path,
                duration_ms=duration_ms,
                status_code=exc.status_code,
                extra=exc.details,
            )
            response = JSONResponse(
                status_code=exc.status_code,
                content={
                    "error": {
                        "code": exc.code or "BUSINESS_ERROR",
                        "message": exc.message,
                        "reference": request_id,
                        "details": exc.details,
                    }
                },
            )
            response.headers["X-Request-ID"] = request_id
            return response

        except Exception as exc:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            log_structured_event(
                level="ERROR",
                event_type="UNHANDLED_EXCEPTION",
                message=str(exc),
                request_id=request_id,
                endpoint=request.url.path,
                duration_ms=duration_ms,
                status_code=500,
            )
            # Section 64: Production Error UX - Clean reference ID, no Python traceback
            response = JSONResponse(
                status_code=500,
                content={
                    "error": {
                        "code": "INTERNAL_SERVER_ERROR",
                        "message": "Unable to complete request.",
                        "reference": request_id,
                    }
                },
            )
            response.headers["X-Request-ID"] = request_id
            return response

        finally:
            if is_write:
                with _writes_lock:
                    _active_writes = max(0, _active_writes - 1)
