@echo off
setlocal enabledelayedexpansion
title AQ COMPANIES - Production Coordinator

echo ======================================================================
echo AQ COMPANIES — ENTERPRISE PRODUCTION SYSTEM
echo Trading • Logistics • Accounting
echo ======================================================================
echo Launching System Components on Windows Server...

set "SCRIPT_DIR=%~dp0"

:: Start Backend API in a separate managed window
echo [1/2] Launching Backend API Service (Port 8000)...
start "AQ COMPANIES - Backend Server (Port 8000)" cmd /c ""%SCRIPT_DIR%start_backend.bat""

:: Wait 3 seconds for backend to initialize
timeout /t 3 /nobreak >nul

:: Start Frontend Web in a separate managed window
echo [2/2] Launching Frontend Web App (Port 3000)...
start "AQ COMPANIES - Frontend Web App (Port 3000)" cmd /c ""%SCRIPT_DIR%start_frontend.bat""

echo.
echo ======================================================================
echo AQ COMPANIES IS RUNNING:
echo - Frontend Application: http://localhost:3000
echo - Backend API Service:  http://localhost:8000
echo - API Documentation:    http://localhost:8000/docs
echo.
echo Both services have crash-recovery loops enabled and will auto-restart
echo in their respective consoles if interrupted.
echo ======================================================================
echo You may close this launcher window safely.
pause
