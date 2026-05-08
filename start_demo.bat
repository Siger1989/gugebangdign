@echo off
setlocal
cd /d "%~dp0"
echo Starting action rig demo at http://localhost:8780
python -m http.server 8780
