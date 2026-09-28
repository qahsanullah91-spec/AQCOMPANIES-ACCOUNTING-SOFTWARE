"""
Backward-compatibility proxy re-exporting from app.core.database.
"""
from app.core.database import (
    engine,
    SessionLocal,
    Base,
    get_db,
    DATABASE_URL,
    BASE_DIR,
)

__all__ = ["engine", "SessionLocal", "Base", "get_db", "DATABASE_URL", "BASE_DIR"]
