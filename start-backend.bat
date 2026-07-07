@echo off
title Kharcha Tracker — Backend (port 5000)
set "ROOT=%~dp0"
echo Starting backend on http://localhost:5000 ...
cd /d "%ROOT%backend"
"C:\Program Files\nodejs\node.exe" server.js
pause
