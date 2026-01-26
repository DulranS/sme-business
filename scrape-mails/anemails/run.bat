@echo off
title Lead Enrichment Tool
cd /d "%~dp0"

echo ======================================
echo   BUSINESS LEAD ENRICHMENT TOOL
echo ======================================
echo.

python -m pip install --upgrade pip >nul
python -m pip install -r requirements.txt

python enrich.py

echo.
echo ======================================
echo Finished. Press any key to exit.
pause >nul
