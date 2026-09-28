@echo off
setlocal enabledelayedexpansion
title AQ COMPANIES - Frontend Web Application

:: Navigate to frontend root
cd /d "%~dp0..\..\frontend"

echo ======================================================================
echo AQ COMPANIES — PRODUCTION FRONTEND APPLICATION
echo Next.js • TailwindCSS • iPhone PWA
echo ======================================================================
echo Starting at: %DATE% %TIME%
echo Working Directory: %CD%

:: Environment Setup
set "NODE_ENV=production"
set "PORT=3000"

:: Check Node Modules
if not exist "node_modules" (
    echo [ERROR] node_modules folder not found.
    echo Please run npm install before launching frontend.
    pause
    exit /b 1
)

:: Check for build
if not exist ".next" (
    echo [NOTICE] Production build .next not found. Building application now...
    call npm run build
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Frontend build failed. Cannot start production server.
        pause
        exit /b 1
    )
)

echo.
echo >> Starting Next.js Production Web Server on port %PORT%...
echo System is set to auto-restart on unexpected exit.
echo ======================================================================

:RUN_LOOP
echo [%DATE% %TIME%] Launching Frontend Server...
call npm run start -- -p %PORT%

set EXIT_CODE=%ERRORLEVEL%
echo [%DATE% %TIME%] Frontend process stopped with exit code %EXIT_CODE%.

:: If exit code was normal shutdown (0 or Ctrl+C / 130), exit cleanly
if %EXIT_CODE% equ 0 goto END
if %EXIT_CODE% equ 130 goto END

echo [AUTO-RESTART] Frontend process crashed or stopped. Restarting in 5 seconds...
timeout /t 5 /nobreak >nul
goto RUN_LOOP

:END
echo Frontend shutdown completed.
pause
