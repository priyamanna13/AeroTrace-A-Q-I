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
docker ps --filter "name=aq_postgis" --filter "status=running" -q > nul 2>&1
if errorlevel 1 (
    echo [!] PostGIS container not detected. Starting via docker compose...
    docker compose up -d
) else (
    echo [OK] PostGIS container is already active.
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
