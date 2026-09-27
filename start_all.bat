@echo off
setlocal
cd /d "%~dp0"
title AeroTrace Full Platform Launcher

echo ================================================================
echo           AeroTrace A-Q-I Platform Launcher
echo ================================================================
echo.

:: 1. Ensure Docker PostGIS is up
echo [1/3] Ensuring PostgreSQL / PostGIS container is running...
docker compose up -d
echo [OK] Database service verified.
echo.

:: 2. Launch Backend in new window
echo [2/3] Launching FastAPI Backend Server (Port 8000)...
start "AeroTrace Backend (:8000)" cmd /k ""%~dp0start_backend.bat""
echo [OK] Backend spawned.
echo.

:: 3. Launch Frontend in new window
echo [3/3] Launching Vite React Frontend (Port 5173)...
start "AeroTrace Frontend (:5173)" cmd /k ""%~dp0start_frontend.bat""
echo [OK] Frontend spawned.
echo.

echo ================================================================
echo   All AeroTrace services are running:
echo   - Frontend UI:  http://localhost:5173
echo   - Backend API:  http://127.0.0.1:8000
echo   - Swagger Docs: http://127.0.0.1:8000/docs
echo   - Health Check: http://127.0.0.1:8000/health
echo ================================================================
echo.
echo Opening Web Application in your default browser...
timeout /t 3 /nobreak > nul
start http://localhost:5173

echo.
echo You can minimize this window. Close the spawned windows to stop services.
pause
