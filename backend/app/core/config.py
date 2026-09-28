import os
import sys
from pathlib import Path
from typing import List, Optional
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent.parent.parent


def get_default_paths(env: str):
    """Provides isolated storage paths depending on active environment."""
    env_clean = (env or "development").lower()
    if env_clean == "testing":
        base_sub = BASE_DIR / ".test_env_data"
        db_path = base_sub / "test_aq_companies.db"
    elif env_clean == "staging":
        base_sub = BASE_DIR / ".staging_env_data"
        db_path = base_sub / "staging_aq_companies.db"
    else:
        base_sub = BASE_DIR
        db_path = base_sub / "aq_companies.db"

    uploads = base_sub / "uploads"
    backups = base_sub / "backups"
    logs = base_sub / "logs"
    return db_path, uploads, backups, logs


_detected_env = os.getenv("APP_ENV", os.getenv("ENVIRONMENT", "development")).lower()
_default_db_path, _default_uploads, _default_backups, _default_logs = get_default_paths(_detected_env)


class Settings(BaseModel):
    PROJECT_NAME: str = "AQ COMPANIES Management & Accounting System"
    VERSION: str = "2.0.0"
    API_VERSION: str = "v1"
    ENVIRONMENT: str = Field(
        default_factory=lambda: os.getenv("APP_ENV", os.getenv("ENVIRONMENT", "development")).lower()
    )
    DEBUG: bool = Field(
        default_factory=lambda: os.getenv("DEBUG", "true" if _detected_env in ("development", "testing") else "false").lower() in ("true", "1", "yes")
    )
    
    # Versioning & Release Tracking
    BUILD_COMMIT: str = Field(default_factory=lambda: os.getenv("BUILD_COMMIT", "local-dev"))
    BUILD_DATE: str = Field(default_factory=lambda: os.getenv("BUILD_DATE", "2026-09-27"))

    # Database
    DATABASE_URL: str = Field(
        default_factory=lambda: os.getenv("DATABASE_URL", f"sqlite:///{_default_db_path}")
    )
    DB_POOL_SIZE: int = Field(default_factory=lambda: int(os.getenv("DB_POOL_SIZE", "10")))
    DB_MAX_OVERFLOW: int = Field(default_factory=lambda: int(os.getenv("DB_MAX_OVERFLOW", "20")))
    DB_ECHO: bool = Field(default_factory=lambda: os.getenv("DB_ECHO", "false").lower() in ("true", "1", "yes"))

    # Security & JWT
    SECRET_KEY: str = Field(
        default_factory=lambda: os.getenv(
            "SECRET_KEY", "AQ_COMPANIES_ENTERPRISE_SECRET_KEY_CHANGE_IN_PRODUCTION_982347120394812"
        )
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default_factory=lambda: int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
    )
    MAINTENANCE_BYPASS_TOKEN: str = Field(
        default_factory=lambda: os.getenv("MAINTENANCE_BYPASS_TOKEN", "AQ_INTERNAL_DEPLOY_MAINTENANCE_BYPASS_KEY")
    )

    # Storage Paths
    BACKUP_PATH: Path = Field(
        default_factory=lambda: Path(os.getenv("BACKUP_PATH", str(_default_backups)))
    )
    SECONDARY_BACKUP_PATH: Optional[Path] = Field(
        default_factory=lambda: Path(os.getenv("SECONDARY_BACKUP_PATH")) if os.getenv("SECONDARY_BACKUP_PATH") else None
    )
    UPLOAD_PATH: Path = Field(
        default_factory=lambda: Path(os.getenv("UPLOAD_PATH", str(_default_uploads)))
    )
    LOG_PATH: Path = Field(
        default_factory=lambda: Path(os.getenv("LOG_PATH", str(_default_logs)))
    )

    # Logging & Observability
    LOG_LEVEL: str = Field(default_factory=lambda: os.getenv("LOG_LEVEL", "INFO"))
    SLOW_API_THRESHOLD_MS: float = Field(
        default_factory=lambda: float(os.getenv("SLOW_API_THRESHOLD_MS", "500.0"))
    )
    BACKUP_RETENTION_DAYS: int = Field(
        default_factory=lambda: int(os.getenv("BACKUP_RETENTION_DAYS", "30"))
    )
    BACKUP_ALERT_INTERVAL_HOURS: int = Field(
        default_factory=lambda: int(os.getenv("BACKUP_ALERT_INTERVAL_HOURS", "24"))
    )
    REDIS_URL: Optional[str] = Field(default_factory=lambda: os.getenv("REDIS_URL", None))
    SENTRY_DSN: Optional[str] = Field(default_factory=lambda: os.getenv("SENTRY_DSN", None))

    # Operational Thresholds
    DISK_WARNING_THRESHOLD_PCT: int = Field(default_factory=lambda: int(os.getenv("DISK_WARNING_THRESHOLD_PCT", "20")))
    DISK_CRITICAL_THRESHOLD_PCT: int = Field(default_factory=lambda: int(os.getenv("DISK_CRITICAL_THRESHOLD_PCT", "10")))

    # Feature Flags
    FEATURE_NEW_RECONCILIATION_ENGINE: bool = Field(
        default_factory=lambda: os.getenv("FEATURE_NEW_RECONCILIATION_ENGINE", "false").lower() in ("true", "1")
    )
    FEATURE_ADVANCED_FX: bool = Field(
        default_factory=lambda: os.getenv("FEATURE_ADVANCED_FX", "false").lower() in ("true", "1")
    )
    FEATURE_CURSOR_PAGINATION: bool = Field(
        default_factory=lambda: os.getenv("FEATURE_CURSOR_PAGINATION", "true").lower() in ("true", "1")
    )
    MAINTENANCE_MODE: bool = Field(
        default_factory=lambda: os.getenv("MAINTENANCE_MODE", "false").lower() in ("true", "1")
    )

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]


def validate_production_config(s: Settings) -> None:
    """
    Validates that production environment is strictly configured.
    Aborts startup if any critical security, database, or storage rule is violated.
    """
    if s.ENVIRONMENT != "production":
        return

    errors = []

    # 1. DEBUG must be False
    if s.DEBUG:
        errors.append("PRODUCTION ERROR: DEBUG must be set to 'false' in production.")

    # 2. SECRET_KEY validation
    unsafe_keys = [
        "CHANGE_IN_PRODUCTION",
        "AQ_COMPANIES_ENTERPRISE_SECRET_KEY",
        "secret",
        "123456",
        "admin",
        "password",
    ]
    if not s.SECRET_KEY or any(k in s.SECRET_KEY for k in unsafe_keys) or len(s.SECRET_KEY) < 32:
        errors.append("PRODUCTION ERROR: SECRET_KEY is missing or contains an insecure default/placeholder string.")

    # 3. Database URL check
    if not s.DATABASE_URL:
        errors.append("PRODUCTION ERROR: DATABASE_URL must be specified.")

    # 4. CORS must not contain wildcard
    if "*" in s.CORS_ORIGINS:
        errors.append("PRODUCTION ERROR: CORS_ORIGINS must not contain wildcard '*' in production.")

    # 5. Backup directory must be writable
    try:
        os.makedirs(s.BACKUP_PATH, exist_ok=True)
        test_file = s.BACKUP_PATH / ".perm_check"
        test_file.touch()
        test_file.unlink()
    except Exception as exc:
        errors.append(f"PRODUCTION ERROR: BACKUP_PATH '{s.BACKUP_PATH}' is not accessible or writable: {exc}")

    # 6. Admin default password check
    admin_pw = os.getenv("ADMIN_DEFAULT_PASSWORD", "")
    if admin_pw in ("admin", "123456", "password", "admin123"):
        errors.append("PRODUCTION ERROR: Insecure ADMIN_DEFAULT_PASSWORD detected in environment.")

    if errors:
        error_msg = "\n".join(errors)
        raise ValueError(f"\n{'='*70}\nCRITICAL PRODUCTION CONFIGURATION FAILURE:\n{error_msg}\n{'='*70}\n")


settings = Settings()

# Ensure directories exist
os.makedirs(settings.BACKUP_PATH, exist_ok=True)
os.makedirs(settings.UPLOAD_PATH, exist_ok=True)
os.makedirs(settings.LOG_PATH, exist_ok=True)
