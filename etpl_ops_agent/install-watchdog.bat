@echo off
REM ============================================================
REM EtherTrack Agent Watchdog - Windows Service Installer
REM Run this file AS ADMINISTRATOR (right-click -> Run as Administrator)
REM ============================================================

echo.
echo ============================================================
echo  EtherTrack Agent Watchdog Service Installation
echo ============================================================
echo.

REM Check if running as admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator!
    echo.
    echo Right-click this file and select "Run as Administrator"
    echo.
    pause
    exit /b 1
)

echo [1/4] Installing node-windows dependencies...
npm install node-windows --prefix "%~dp0" >nul 2>&1
if %errorLevel% neq 0 (
    echo Failed to install node-windows
    pause
    exit /b 1
)
echo Done.

echo [2/4] Installing watchdog service...
node "%~dp0\install-service.js"
if %errorLevel% neq 0 (
    echo Failed to install service
    pause
    exit /b 1
)

echo [3/4] Starting watchdog service...
net start EtherTrackAgentWatchdog >nul 2>&1
if %errorLevel% neq 0 (
    echo Warning: Service installed but could not start automatically
    echo You can start it manually from Services.msc
) else (
    echo Service started successfully.
)

echo [4/4] Verifying service status...
sc query EtherTrackAgentWatchdog

echo.
echo ============================================================
echo  Installation Complete!
echo ============================================================
echo.
echo The watchdog service will now monitor the EtherTrack Agent
echo and automatically restart it if it crashes or is killed.
echo.
echo To uninstall later, run: uninstall-watchdog.bat (as Admin)
echo.
pause