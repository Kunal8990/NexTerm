@echo off
title Nexterm Launcher
cd /d "%~dp0"
if not exist "build\bin\nexterm.exe" (
    echo Building Nexterm desktop application...
    "C:\Users\Kunal Jha\go\bin\wails.exe" build
)
echo Launching Nexterm...
start "" "build\bin\nexterm.exe"
exit /b 0
