from typing import Dict, List, Set, Optional
from app.core.exceptions import PermissionDeniedError

# Defined System Permissions
PERMISSIONS = {
    # Accounting Operations
    "ACCOUNTING_VIEW": "accounting.view",
    "ACCOUNTING_POST": "accounting.post",
    "ACCOUNTING_REVERSE": "accounting.reverse",
    "ACCOUNTING_CLOSE_PERIOD": "period.close",
    "ACCOUNTING_REOPEN_PERIOD": "period.reopen",

    # Banking Operations
    "BANKING_VIEW": "banking.view",
    "BANKING_TRANSACT": "banking.transact",
    "BANKING_RECONCILE": "banking.reconcile",
    "BANKING_IMPORT": "banking.import",

    # Receivables & Payables
    "RECEIVABLES_MANAGE": "receivables.manage",
    "PAYABLES_MANAGE": "payables.manage",

    # System & Disaster Recovery
    "BACKUP_CREATE": "backup.create",
    "BACKUP_RESTORE": "backup.restore",
    "ADMIN_USERS": "admin.users",
    "SETTINGS_MANAGE": "settings.manage",
}

# Role-to-Permission Standard Matrix
ROLE_PERMISSIONS: Dict[str, Set[str]] = {
    "ADMIN": set(PERMISSIONS.values()),
    "SUPER_ADMIN": set(PERMISSIONS.values()),
    "ACCOUNTANT": {
        "accounting.view",
        "accounting.post",
        "accounting.reverse",
        "banking.view",
        "banking.transact",
        "banking.reconcile",
        "banking.import",
        "receivables.manage",
        "payables.manage",
        "backup.create",
    },
    "OPERATIONS": {
        "accounting.view",
        "banking.view",
        "receivables.manage",
        "payables.manage",
    },
    "VIEW_ONLY": {
        "accounting.view",
        "banking.view",
    },
}


def user_has_permission(user_role: str, permission: str, custom_permissions: Optional[List[str]] = None) -> bool:
    """Checks whether a user role or custom permission list has the requested permission."""
    role = (user_role or "").upper().strip()
    if role in ("ADMIN", "SUPER_ADMIN"):
        return True
    
    role_perms = ROLE_PERMISSIONS.get(role, set())
    if permission in role_perms:
        return True
    
    if custom_permissions and permission in custom_permissions:
        return True
    
    return False


def require_permission(user_role: str, permission: str, custom_permissions: Optional[List[str]] = None) -> None:
    """Raises PermissionDeniedError if the user lacks the given permission."""
    if not user_has_permission(user_role, permission, custom_permissions):
        raise PermissionDeniedError(
            message=f"Access denied: Missing required permission '{permission}'.",
            details={"required_permission": permission, "user_role": user_role},
        )


def user_has_company_access(
    user_role: str,
    target_company_id: Optional[int],
    allowed_company_ids: Optional[List[int]] = None,
) -> bool:
    """
    Validates object-level multi-entity authorization.
    Super Admins and Admins have access to all group companies.
    Company-specific operators/accountants are restricted to their assigned company IDs.
    """
    if target_company_id is None:
        return True
    role = (user_role or "").upper().strip()
    if role in ("ADMIN", "SUPER_ADMIN"):
        return True
    if allowed_company_ids is None:
        return target_company_id == 1
    return target_company_id in allowed_company_ids


def require_company_access(
    user_role: str,
    target_company_id: Optional[int],
    allowed_company_ids: Optional[List[int]] = None,
) -> None:
    """Raises PermissionDeniedError if the user cannot access the target company's records."""
    if not user_has_company_access(user_role, target_company_id, allowed_company_ids):
        raise PermissionDeniedError(
            message=f"Access denied: You do not have permission to access records for Company ID {target_company_id}.",
            details={"target_company_id": target_company_id, "error_code": "COMPANY_ACCESS_DENIED"},
        )

