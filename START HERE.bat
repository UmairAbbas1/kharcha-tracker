@echo off
title Kharcha Tracker — Launcher
set "ROOT=%~dp0"

echo ==========================================
echo   Kharcha Tracker — Starting both servers
echo ==========================================
echo.

echo [1/2] Starting Backend on port 5000...
start "Kharcha Backend" cmd /k "cd /d "%ROOT%backend" && "C:\Program Files\nodejs\node.exe" server.js"

echo Waiting for backend to initialise...
timeout /t 4 /nobreak > nul

echo [2/2] Starting Frontend on port 5173...
start "Kharcha Frontend" cmd /k "cd /d "%ROOT%frontend" && "C:\Program Files\nodejs\npm.cmd" run dev"

echo Waiting for frontend dev server...
timeout /t 8 /nobreak > nul

echo.
echo ==========================================
echo   Open: http://localhost:5173
echo ==========================================
echo.

start "" "http://localhost:5173"
exit
