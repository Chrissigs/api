@echo off
setlocal

REM Set API token
set API_AUTH_TOKEN=DEMO_TOKEN_123

echo ========================================
echo RELIANCE RAIL - LIVE INTEGRATION TEST
echo ========================================
echo.

echo Step 1: Checking Redis...
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
start /MIN "Main Server" cmd /c "set API_AUTH_TOKEN=%API_AUTH_TOKEN% && node src\server.js"
timeout /t 6 >nul

echo.
echo ========================================
echo Test 1: ISO 20022 Compliance
echo ========================================
echo.
set API_AUTH_TOKEN=%API_AUTH_TOKEN%
node scripts\test_iso20022_payload.js
echo.

echo ========================================
echo Test 2: Audit Trail Verification
echo ========================================
echo.
node scripts\verify_audit_trail.js

echo.
echo ========================================
echo Test Complete!
echo ========================================
echo.
echo Stopping servers...
taskkill /FI "WINDOWTITLE eq Bank Node*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Main Server*" /F >nul 2>&1
echo.
echo All tests completed successfully!
pause
