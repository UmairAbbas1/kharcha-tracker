@echo off
title Kharcha Tracker — Frontend (port 5173)
set "ROOT=%~dp0"
echo Starting frontend on http://localhost:5173 ...
cd /d "%ROOT%frontend"
"C:\Program Files\nodejs\npm.cmd" run dev
pause
