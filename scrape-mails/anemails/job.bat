@echo off
cd /d "%~dp0"

echo ============================================
echo   TARGET-COMPANY JOB SCRAPER
echo ============================================
echo.

where python >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Python is not installed or not on PATH.
    echo Install it from https://www.python.org/downloads/ and check "Add to PATH" during setup.
    pause
    exit /b 1
)

echo Checking required packages...
python -c "import requests, bs4" >nul 2>nul
if errorlevel 1 (
    echo Installing missing packages: requests, beautifulsoup4
    python -m pip install requests beautifulsoup4 --quiet
)

echo.
echo Starting scraper...
echo.
python "%~dp0job_scraper.py"

echo.
echo ============================================
echo Done. Press any key to close this window.
echo ============================================
pause >nul