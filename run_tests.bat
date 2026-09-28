@echo off
title AQ COMPANIES - Test Suite Runner
set ROOT_DIR=%~dp0
cd /d "%ROOT_DIR%backend"
echo Running Backend Accounting & API Test Suite...
.venv\Scripts\python.exe -m pytest -v
echo.
cd /d "%ROOT_DIR%frontend"
echo Running Frontend TypeCheck...
call npm.cmd run typecheck
echo.
echo All tests and type checks finished!
pause
