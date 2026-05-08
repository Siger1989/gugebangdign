@echo off
setlocal
cd /d "%~dp0"
echo Starting action pipeline demo at http://localhost:8780/index.html
start "" powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Milliseconds 700; Start-Process 'http://localhost:8780/index.html'"
python -m http.server 8780
