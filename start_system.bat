@echo off
title AQ COMPANIES - System Launcher
echo ========================================================
echo           AQ COMPANIES - SYSTEM LAUNCHER
echo  Dry Fruit Trading, Container Management & Accounting
echo ========================================================
echo.

set ROOT_DIR=%~dp0
cd /d "%ROOT_DIR%"

echo [1/3] Starting Backend API Server (FastAPI on Port 8000)...
start "AQ Companies - Backend API (FastAPI)" cmd /k "cd /d %ROOT_DIR%backend && .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

echo [2/3] Waiting for Backend to initialize...
timeout /t 3 /nobreak > nul

echo [3/3] Starting Frontend Server (Next.js on Port 3002)...
start "AQ Companies - Web Interface (Next.js)" cmd /k "cd /d %ROOT_DIR%frontend && npm.cmd run dev"

echo.
echo ========================================================
echo  AQ COMPANIES is starting up!
echo  Backend:   http://127.0.0.1:8000/docs
echo  Frontend:  http://localhost:3002
echo ========================================================
echo.

timeout /t 5 /nobreak > nul
start http://localhost:3002

exit
