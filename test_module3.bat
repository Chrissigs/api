@echo off
setlocal

REM Module 3: Webhook Admin Sync Test
REM Tests the Green Light Protocol end-to-end

set API_AUTH_TOKEN=DEMO_TOKEN_123
set WEBHOOK_SECRET=shared-secret-key-demo-123

echo ========================================
echo MODULE 3: WEBHOOK ADMIN SYNC TEST
echo ========================================
echo.

echo Step 1: Checking prerequisites...
echo.

REM Check Redis
powershell -Command "Get-Process -Name redis-server -ErrorAction SilentlyContinue" >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Redis not running. Starting Redis...
    start /MIN "Redis Server" cmd /c "%CD%\redis\redis-server.exe"
    timeout /t 2 >nul
) else (
    echo [OK] Redis is running
)

echo.
echo Step 2: Starting Bank Node (Port 3001)...
start /MIN "Bank Node" cmd /c "set API_AUTH_TOKEN=%API_AUTH_TOKEN% && node scripts\bank_node.js"
timeout /t 3 >nul

echo.
echo Step 3: Starting Main Server (Port 3000)...
start /MIN "Main Server" cmd /c "set API_AUTH_TOKEN=%API_AUTH_TOKEN% && set WEBHOOK_SECRET=%WEBHOOK_SECRET% && node src\server.js"
timeout /t 5 >nul

echo.
echo Step 4: Starting Mock Admin Server (Port 4000)...
start /MIN "Mock Admin" cmd /c "set WEBHOOK_SECRET=%WEBHOOK_SECRET% && node scripts\mock_admin_server.js"
timeout /t 3 >nul

echo.
echo ========================================
echo Running End-to-End Webhook Test
echo ========================================
echo.
set API_AUTH_TOKEN=%API_AUTH_TOKEN%
node scripts\test_webhook.js

echo.
echo ========================================
echo Test Complete!
echo ========================================
echo.
echo Stopping servers...
taskkill /FI "WINDOWTITLE eq Bank Node*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Main Server*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Mock Admin*" /F >nul 2>&1
echo.
echo Module 3 testing completed!
pause
