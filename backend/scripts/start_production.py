"""
AQ COMPANIES — Production Server Coordinator
Pre-flight checklist:
1. Verifies database connectivity with exponential backoff.
2. Applies latest Alembic migrations (alembic upgrade head).
3. Verifies Redis cache connectivity (falls back gracefully to in-memory).
4. Launches multi-worker Gunicorn server (or Uvicorn on Windows).
"""
import os
import sys
import time
import subprocess
import signal

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.core.config import settings


def wait_for_database(max_retries: int = 15, delay: float = 2.0):
    """Waits for database availability before booting API workers."""
    print(">> [1/4] Checking Database Connectivity...")
    from sqlalchemy import create_engine, text
    engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)

    for attempt in range(1, max_retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print(f"   [SUCCESS] Connected to database ({engine.dialect.name}).")
            return
        except Exception as exc:
            print(f"   [WAIT] Database connection attempt {attempt}/{max_retries} failed: {exc}")
            if attempt == max_retries:
                print("   [FATAL] Unable to connect to database. Aborting startup.")
                sys.exit(1)
            time.sleep(delay)


def run_migrations():
    """Runs Alembic schema migrations to head."""
    print(">> [2/4] Applying Database Migrations (alembic upgrade head)...")
    try:
        from alembic.config import Config
        from alembic import command
        alembic_cfg = Config(os.path.join(BACKEND_DIR, "alembic.ini"))
        command.upgrade(alembic_cfg, "head")
        print("   [SUCCESS] Database schema is up to date.")
    except Exception as exc:
        print(f"   [ERROR] Migration failed: {exc}")
        sys.exit(1)


def verify_redis():
    """Checks Redis connectivity if configured."""
    print(">> [3/4] Verifying Cache Engine...")
    if settings.REDIS_URL:
        try:
            import redis
            r = redis.from_url(settings.REDIS_URL, socket_timeout=2.0)
            r.ping()
            print(f"   [SUCCESS] Connected to Redis cluster at {settings.REDIS_URL}.")
        except Exception as exc:
            print(f"   [WARNING] Redis connection failed ({exc}). Falling back to In-Memory Cache.")
    else:
        print("   [INFO] In-Memory Cache active (REDIS_URL not configured).")


def start_server():
    """Launches production ASGI server."""
    port = int(os.environ.get("PORT", 8000))
    workers = int(os.environ.get("GUNICORN_WORKERS", 4))
    print(f">> [4/4] Starting Production Server on port {port} with {workers} workers...")

    is_windows = sys.platform.startswith("win")
    if is_windows:
        # Gunicorn is not supported on Windows; run Uvicorn multi-process
        cmd = [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "0.0.0.0",
            "--port",
            str(port),
            "--workers",
            str(workers),
        ]
    else:
        # Production Linux container: Gunicorn with UvicornWorker
        cmd = [
            "gunicorn",
            "app.main:app",
            "-w",
            str(workers),
            "-k",
            "uvicorn.workers.UvicornWorker",
            "-b",
            f"0.0.0.0:{port}",
            "--timeout",
            "120",
            "--keep-alive",
            "5",
            "--access-logfile",
            "-",
            "--error-logfile",
            "-",
        ]

    proc = subprocess.Popen(cmd, cwd=BACKEND_DIR)

    def handle_signal(sig, frame):
        print(f"\n[SHUTDOWN] Signal {sig} received. Terminating server gracefully...")
        proc.terminate()
        proc.wait()
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    proc.wait()


if __name__ == "__main__":
    wait_for_database()
    run_migrations()
    verify_redis()
    start_server()
