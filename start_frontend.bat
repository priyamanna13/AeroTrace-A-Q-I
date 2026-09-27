@echo off
setlocal
cd /d "%~dp0frontend"
title AeroTrace Frontend (Vite :5173)

echo ===================================================
echo   AeroTrace A-Q-I - Frontend Server
echo ===================================================
echo.

echo [*] Starting Vite React frontend on http://localhost:5173 ...
echo.
npm run dev

if errorlevel 1 (
    echo.
    echo [ERROR] Frontend server stopped with an error.
    pause
)
