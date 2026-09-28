@echo off
setlocal enabledelayedexpansion

:: Navigate to backend root
cd /d "%~dp0..\..\backend"

echo ======================================================================
echo AQ COMPANIES — ACCOUNTING & SYSTEM INTEGRITY SCAN
echo ======================================================================

.venv\Scripts\python.exe scripts\verify_integrity_cli.py
set SCAN_ERR=%ERRORLEVEL%

if %SCAN_ERR% equ 0 (
    echo.
    echo [OK] All accounting checks passed without discrepancy.
) else (
    echo.
    echo [ALERT] Integrity check flagged discrepancies. Review output above.
)

pause
exit /b %SCAN_ERR%
