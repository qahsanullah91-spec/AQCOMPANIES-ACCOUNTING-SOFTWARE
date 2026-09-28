import time
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from app.core.config import settings

_maintenance_state = {
    "enabled": settings.MAINTENANCE_MODE,
    "reason": "Initial server maintenance state",
    "updated_at": datetime.now(timezone.utc).isoformat(),
    "updated_by": "System",
}


def is_maintenance_mode() -> bool:
    """Returns True if the backend is currently locked in Maintenance Mode."""
    return _maintenance_state["enabled"]


def get_maintenance_info() -> Dict[str, Any]:
    """Returns current maintenance mode metadata."""
    return dict(_maintenance_state)


def set_maintenance_mode(
    enabled: bool,
    reason: str = "Scheduled system maintenance",
    updated_by: str = "Admin",
    wait_for_active_writes: bool = True,
    timeout_seconds: float = 5.0,
) -> Dict[str, Any]:
    """
    Enables or disables deployment maintenance mode.
    Section 30: When enabling, waits up to timeout_seconds for active mutating requests
    to complete before sealing maintenance lock.
    """
    # First set enabled to True to prevent new writes from starting
    _maintenance_state["enabled"] = enabled
    _maintenance_state["reason"] = reason
    _maintenance_state["updated_at"] = datetime.now(timezone.utc).isoformat()
    _maintenance_state["updated_by"] = updated_by

    if enabled and wait_for_active_writes:
        try:
            from app.core.middleware import get_active_write_count
            start = time.perf_counter()
            while get_active_write_count() > 0 and (time.perf_counter() - start) < timeout_seconds:
                time.sleep(0.05)
        except Exception:
            pass

    return dict(_maintenance_state)
