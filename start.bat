@echo off
title Alpha-Vibe AI Investment Terminal

echo.
echo  ======================================
echo    Alpha-Vibe AI Investment Agent
echo  ======================================
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed.
    echo         Please install from https://nodejs.org and try again.
    pause
    exit /b 1
)

:: Check node_modules
if not exist node_modules (
    echo [INFO] Packages not installed. Running auto-install...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Package install failed. Please run setup.bat first.
        pause
        exit /b 1
    )
)

:: Check .env.local
if not exist .env.local (
    echo [WARN] .env.local file not found!
    echo        API keys are required.
    echo        Copy .env.example to .env.local and enter your keys.
    echo.
    pause
    exit /b 1
)

:: Start server
echo [START] Starting server...
echo [INFO] Open http://localhost:3000 in your browser.
echo [INFO] Press Ctrl+C to stop.
echo.
echo ----------------------------------------
echo.

npm run dev
