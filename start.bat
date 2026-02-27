@echo off
chcp 65001 >nul 2>&1
title Alpha-Vibe AI Investment Terminal

echo.
echo  ╔══════════════════════════════════════╗
echo  ║   Alpha-Vibe AI Investment Agent     ║
echo  ╚══════════════════════════════════════╝
echo.

:: Node.js 확인
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [오류] Node.js가 설치되어 있지 않습니다.
    echo        https://nodejs.org 에서 설치 후 다시 실행해주세요.
    pause
    exit /b 1
)

:: node_modules 확인
if not exist node_modules (
    echo [알림] 패키지가 설치되지 않았습니다. 자동 설치를 진행합니다...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo [오류] 패키지 설치에 실패했습니다. setup.bat을 먼저 실행해주세요.
        pause
        exit /b 1
    )
)

:: .env.local 확인
if not exist .env.local (
    echo [경고] .env.local 파일이 없습니다!
    echo        API 키 설정이 필요합니다.
    echo        .env.example 파일을 복사하여 .env.local로 만들고 키를 입력해주세요.
    echo.
    pause
    exit /b 1
)

:: 서버 시작
echo [시작] 서버를 시작합니다...
echo [안내] 브라우저에서 http://localhost:3000 을 열어주세요.
echo [안내] 종료하려면 Ctrl+C 를 누르세요.
echo.
echo ────────────────────────────────────────
echo.

npm run dev
