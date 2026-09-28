@echo off
setlocal enabledelayedexpansion
title AQ COMPANIES - Backend API Server

:: Navigate to backend root
cd /d "%~dp0..\..\backend"

echo ======================================================================
echo AQ COMPANIES — PRODUCTION BACKEND ENGINE
echo Trading • Logistics • Accounting
echo ======================================================================
echo Starting at: %DATE% %TIME%
echo Working Directory: %CD%

:: Environment Setup
set "APP_ENV=production"
set "PYTHONUNBUFFERED=1"
set "PORT=8000"

:: Check Python Virtual Environment
if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment not found at .venv\Scripts\python.exe
    echo Please run uv sync or python -m venv .venv before launching.
    pause
    exit /b 1
)

:: Run Pre-Flight Migrations and Integrity Audit
echo.
echo >> [1/3] Running pre-flight database migrations...
.venv\Scripts\python.exe -m alembic upgrade head
if %ERRORLEVEL% neq 0 (
    echo [WARNING] Alembic upgrade reported code %ERRORLEVEL%. Continuing...
)

echo.
echo >> [2/3] Checking Accounting Integrity & Golden Baselines...
.venv\Scripts\python.exe scripts\verify_integrity_cli.py
if %ERRORLEVEL% neq 0 (
    echo [ALERT] Integrity check returned code %ERRORLEVEL%. Check logs.
)

echo.
echo >> [3/3] Starting Uvicorn Production ASGI Server on port %PORT%...
echo System is set to auto-restart on unexpected exit.
echo ======================================================================

:RUN_LOOP
echo [%DATE% %TIME%] Launching Backend Server...
.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port %PORT% --workers 2

set EXIT_CODE=%ERRORLEVEL%
echo [%DATE% %TIME%] Backend process stopped with exit code %EXIT_CODE%.

:: If exit code was normal shutdown (0 or Ctrl+C / 130), exit cleanly
if %EXIT_CODE% equ 0 goto END
if %EXIT_CODE% equ 130 goto END

echo [AUTO-RESTART] Process crashed or was terminated. Restarting in 5 seconds...
timeout /t 5 /nobreak >nul
goto RUN_LOOP

:END
echo Backend shutdown completed.
pause
