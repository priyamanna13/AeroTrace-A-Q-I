@echo off
setlocal
cd /d "%~dp0"
title AeroTrace Test Suite

echo ================================================================
echo           AeroTrace A-Q-I Automated Verification Suite
echo ================================================================
echo.

echo [*] Running Pytest Suite (Backend & AI)...
python -m pytest tests/ -q
if errorlevel 1 (
    echo [FAIL] Pytest encountered failures.
) else (
    echo [PASS] All Pytest tests passed!
)
echo.

echo [*] Running Production QA & Demo Readiness Script...
python scripts/verify_production_readiness.py
if errorlevel 1 (
    echo [FAIL] Production readiness check failed.
) else (
    echo [PASS] Production readiness checks passed!
)
echo.

echo ================================================================
pause
