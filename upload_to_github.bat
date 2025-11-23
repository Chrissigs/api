@echo off
REM Git Upload Script for Project Passport (Using full path to Git)
REM Upload to: https://github.com/Chrissigs/api1.git

setlocal

REM Set Git path
set GIT_PATH=C:\Program Files\Git\bin\git.exe

echo ========================================
echo PROJECT PASSPORT - GITHUB UPLOAD
echo ========================================
echo.
echo Repository: https://github.com/Chrissigs/api1.git
echo.

REM Check if git exists at the expected location
if not exist "%GIT_PATH%" (
    echo [ERROR] Git not found at: %GIT_PATH%
    echo.
    echo Trying to find git in PATH...
    where git >nul 2>&1
    if errorlevel 1 (
        echo Git is not installed or not in PATH.
        echo Please install Git from: https://git-scm.com/download/win
        echo After installing, restart your terminal and try again.
        echo.
        pause
        exit /b 1
    )
    REM Found in PATH, use regular git
    set GIT_PATH=git
)

echo [✓] Git found at: %GIT_PATH%
echo.

echo [1/7] Initializing git repository...
"%GIT_PATH%" init
if errorlevel 1 goto error

echo.
echo [2/7] Configuring git user...
"%GIT_PATH%" config user.name "Chrissigs"
"%GIT_PATH%" config user.email "chris@example.com"
if errorlevel 1 goto error

echo.
echo [3/7] Adding files to git...
"%GIT_PATH%" add .
if errorlevel 1 goto error

echo.
echo [4/7] Creating initial commit...
"%GIT_PATH%" commit -m "Initial commit: Project Passport - Multi-tenant investor onboarding with webhook admin sync"
if errorlevel 1 goto error

echo.
echo [5/7] Setting main branch...
"%GIT_PATH%" branch -M main
if errorlevel 1 goto error

echo.
echo [6/7] Adding remote repository...
"%GIT_PATH%" remote add origin https://github.com/Chrissigs/api1.git 2>nul
if errorlevel 1 (
    REM Remote might already exist, try to set URL instead
    echo Remote already exists, updating URL...
    "%GIT_PATH%" remote set-url origin https://github.com/Chrissigs/api1.git
)

echo.
echo [7/7] Pushing to GitHub...
echo.
echo ========================================
echo GITHUB AUTHENTICATION REQUIRED
echo ========================================
echo.
echo You will be prompted for your GitHub credentials.
echo.
echo IMPORTANT: If you have two-factor authentication:
echo   Username: Your GitHub username (Chrissigs)
echo   Password: Use a Personal Access Token (NOT your password)
echo.
echo To create a Personal Access Token:
echo   1. Go to: https://github.com/settings/tokens
echo   2. Click "Generate new token (classic)"
echo   3. Select "repo" scope
echo   4. Generate and copy the token
echo   5. Use the token as your password below
echo.
pause

"%GIT_PATH%" push -u origin main
if errorlevel 1 goto error

echo.
echo ========================================
echo SUCCESS!
echo ========================================
echo.
echo ✓ Project uploaded to GitHub successfully!
echo.
echo View your repository at:
echo https://github.com/Chrissigs/api1
echo.
pause
exit /b 0

:error
echo.
echo ========================================
echo ERROR OCCURRED
echo ========================================
echo.
echo An error occurred during git operations.
echo.
echo Common issues and solutions:
echo.
echo 1. Authentication Failed:
echo    - Make sure you're using a Personal Access Token (not password)
echo    - Token must have 'repo' scope
echo    - Get token from: https://github.com/settings/tokens
echo.
echo 2. Repository Already Exists:
echo    - Delete the .git folder in this directory
echo    - Or use: git push -f origin main (WARNING: overwrites remote)
echo.
echo 3. Remote Rejected:
echo    - The repository might not be empty on GitHub
echo    - Create a new empty repository or use git pull first
echo.
pause
exit /b 1
