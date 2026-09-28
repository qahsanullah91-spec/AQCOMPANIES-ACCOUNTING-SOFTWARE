from typing import Any, Dict, Optional


class AQAppException(Exception):
    """Base exception for all AQ COMPANIES application errors."""
    status_code: int = 400
    code: str = "APPLICATION_ERROR"

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None, status_code: Optional[int] = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}
        if status_code is not None:
            self.status_code = status_code

    def to_dict(self) -> Dict[str, Any]:
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "details": self.details,
            }
        }


class AccountingError(AQAppException):
    status_code = 400
    code = "ACCOUNTING_ERROR"


class UnbalancedJournalError(AccountingError):
    code = "UNBALANCED_JOURNAL_ERROR"


class PeriodClosedError(AccountingError):
    status_code = 400
    code = "ACCOUNTING_PERIOD_CLOSED"


class DuplicateTransactionError(AQAppException):
    status_code = 409
    code = "DUPLICATE_TRANSACTION"


class PermissionDeniedError(AQAppException):
    status_code = 403
    code = "PERMISSION_DENIED"


class RecordNotFoundError(AQAppException):
    status_code = 404
    code = "RECORD_NOT_FOUND"


class ValidationError(AQAppException):
    status_code = 422
    code = "VALIDATION_ERROR"


class DataIntegrityError(AQAppException):
    status_code = 400
    code = "DATA_INTEGRITY_VIOLATION"


class ConcurrencyError(AQAppException):
    status_code = 409
    code = "CONCURRENCY_CONFLICT"


class OptimisticLockError(ConcurrencyError):
    status_code = 409
    code = "VERSION_CONFLICT"


class TransportAccountingError(AccountingError):
    code = "TRANSPORT_ACCOUNTING_ERROR"


class CrossCompanyViolationError(AQAppException):
    status_code = 400
    code = "CROSS_COMPANY_VIOLATION"


class CompanyMismatchError(AQAppException):
    status_code = 403
    code = "COMPANY_MISMATCH"


class DuplicatePostingError(DuplicateTransactionError):
    status_code = 409
    code = "DUPLICATE_POSTING"


class InsufficientAllocationBalanceError(ValidationError):
    status_code = 422
    code = "INSUFFICIENT_ALLOCATION_BALANCE"


class ReconciliationDifferenceError(AccountingError):
    status_code = 422
    code = "RECONCILIATION_DIFFERENCE"
