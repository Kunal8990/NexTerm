@echo off
title Nexterm Desktop Application
cd /d "%~dp0"
echo Compiling latest Nexterm desktop application...
"C:\Users\Kunal Jha\go\bin\wails.exe" build
if errorlevel 1 (
    echo.
    echo [ERROR] Build failed. Please review the output above.
    pause
    exit /b 1
)
echo.
echo Launching Nexterm...
start "" "build\bin\nexterm.exe"
exit /b 0
