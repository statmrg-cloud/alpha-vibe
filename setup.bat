@echo off
title Alpha-Vibe Setup

echo.
echo  ======================================
echo    Alpha-Vibe Initial Setup
echo  ======================================
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed.
    echo         Please install from https://nodejs.org and try again.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [OK] Node.js %NODE_VER% detected

:: Install npm packages
echo.
echo [1/3] Installing packages... (1-2 min)
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Package installation failed.
    pause
    exit /b 1
)
echo [DONE] Packages installed successfully!

:: Check .env.local
echo.
if exist .env.local (
    echo [OK] .env.local file already exists.
) else (
    echo [2/3] Creating environment file...
    copy .env.example .env.local >nul 2>&1
    if exist .env.local (
        echo [DONE] .env.local file created.
        echo [IMPORTANT] Open .env.local with Notepad and enter your API keys!
    ) else (
        echo [WARN] .env.example not found. Please create .env.local manually.
    )
)

:: Build test
echo.
echo [3/3] Running build test...
call npm run build >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARN] Build issue detected. Please check your .env.local settings.
) else (
    echo [DONE] Build test passed!
)

echo.
echo  ======================================
echo   Setup complete! Run the app with:
echo.
echo     start.bat
echo.
echo   Or manually:
echo     npm run dev
echo  ======================================
echo.
pause
