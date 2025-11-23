@echo off
echo Starting Redis Test Environment...
echo.

REM Set environment variable
set API_AUTH_TOKEN=DEMO_TOKEN_123

echo [1/3] Starting Bank Node (Port 3001)...
start /MIN "Bank Node" cmd /c "node scripts\bank_node.js"
timeout /t 3 /nobreak >nul

echo [2/3] Starting Main Server (Port 3000)...
start /MIN "Main Server" cmd /c "node src\server.js"
timeout /t 5 /nobreak >nul

echo [3/3] Running Tests...
echo.
echo ========================================
echo Test 1: ISO 20022 Compliance Test
echo ========================================
node scripts\test_iso20022_payload.js

timeout /t 2 /nobreak >nul
echo.
echo ========================================
echo Test 2: Audit Trail Verification
echo ========================================
node scripts\verify_audit_trail.js

echo.
echo ========================================
echo Testing Complete!
echo ========================================
echo.
echo Press any key to stop servers...
pause >nul

REM Clean up: Kill node processes
taskkill /F /FI "WINDOWTITLE eq Bank Node*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq Main Server*" >nul 2>&1

echo Servers stopped.
