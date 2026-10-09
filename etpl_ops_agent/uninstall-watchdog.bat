@echo off
REM ============================================================
REM EtherTrack Agent Watchdog - Windows Service Uninstaller
REM Run this file AS ADMINISTRATOR (right-click -> Run as Administrator)
REM ============================================================

echo.
echo ============================================================
echo  EtherTrack Agent Watchdog Service Uninstallation
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

echo [1/2] Stopping watchdog service...
net stop EtherTrackAgentWatchdog >nul 2>&1

echo [2/2] Uninstalling watchdog service...
node "%~dp0\uninstall-service.js"
if %errorLevel% neq 0 (
    echo Failed to uninstall service
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  Uninstallation Complete!
echo ============================================================
echo.
pause