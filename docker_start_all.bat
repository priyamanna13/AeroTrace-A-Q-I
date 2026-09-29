@echo off
setlocal
cd /d "%~dp0"
title AeroTrace Full Docker Stack Launcher

echo ================================================================
echo           AeroTrace A-Q-I Docker Platform Launcher
echo ================================================================
echo.
echo [*] Building and starting all containers (PostGIS, Backend, Frontend)...
docker compose up --build -d
if errorlevel 1 (
    echo [ERROR] Docker compose failed to start.
    pause
    exit /b 1
)

echo.
echo [OK] All AeroTrace containers are running:
echo   - Frontend UI:  http://localhost:5173
echo   - Backend API:  http://localhost:8000
echo   - API Docs:     http://localhost:8000/docs
echo   - Health Check: http://localhost:8000/health
echo ================================================================
echo.
echo Opening Web Application in your default browser...
timeout /t 5 /nobreak > nul
start http://localhost:5173

echo.
echo Run "docker compose down" to stop all containers.
pause
