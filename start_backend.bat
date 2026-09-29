@echo off
setlocal
cd /d "%~dp0"
title AeroTrace Backend (FastAPI :8000)

echo ===================================================
echo   AeroTrace A-Q-I - Backend Server
echo ===================================================
echo.

:: Check Docker PostGIS
echo [*] Checking Docker PostgreSQL / PostGIS container...
set "RUNNING_CONTAINER="
for /f "tokens=*" %%i in ('docker ps -q -f "name=aq_postgis" -f "status=running"') do set "RUNNING_CONTAINER=%%i"
if not defined RUNNING_CONTAINER (
    echo [!] PostGIS container not running. Starting via docker compose...
    docker compose up -d db
) else (
    echo [OK] PostGIS container is active.
)
echo.

:: Launch FastAPI via python -m uvicorn
echo [*] Starting FastAPI Backend on http://127.0.0.1:8000 ...
echo [*] API Documentation: http://127.0.0.1:8000/docs
echo [*] Health Check:      http://127.0.0.1:8000/health
echo.
python -m uvicorn app.api:app --host 127.0.0.1 --port 8000 --reload

if errorlevel 1 (
    echo.
    echo [ERROR] Backend server stopped with an error.
    pause
)
