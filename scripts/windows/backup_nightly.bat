@echo off
setlocal enabledelayedexpansion

:: Navigate to backend root
cd /d "%~dp0..\..\backend"

set "LOG_DIR=%CD%\logs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

set "NIGHTLY_LOG=%LOG_DIR%\backup_nightly.log"

echo [%DATE% %TIME%] Starting Scheduled Nightly Backup... >> "%NIGHTLY_LOG%"
.venv\Scripts\python.exe scripts\run_backup.py >> "%NIGHTLY_LOG%" 2>&1
set BACKUP_ERR=%ERRORLEVEL%

if %BACKUP_ERR% equ 0 (
    echo [%DATE% %TIME%] Scheduled Nightly Backup COMPLETED SUCCESSFULLY. >> "%NIGHTLY_LOG%"
    exit /b 0
) else (
    echo [%DATE% %TIME%] [ERROR] Scheduled Nightly Backup FAILED with code %BACKUP_ERR%. >> "%NIGHTLY_LOG%"
    exit /b %BACKUP_ERR%
)
