@echo off
title AQ COMPANIES - Database Seeder
set ROOT_DIR=%~dp0
cd /d "%ROOT_DIR%backend"
echo Seeding AQ COMPANIES Database with prompt examples...
.venv\Scripts\python.exe app\seed.py
echo.
pause
