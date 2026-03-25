@echo off
cd /d "%~dp0"
python uke_to_db.py
start http://localhost:8080/pharmacy_dashboard_8.html
python -m http.server 8080 >nul 2>&1
