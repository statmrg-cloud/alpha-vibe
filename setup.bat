@echo off
chcp 65001 >nul 2>&1
title Alpha-Vibe 설치

echo.
echo  ╔══════════════════════════════════════╗
echo  ║   Alpha-Vibe 초기 설치 스크립트      ║
echo  ╚══════════════════════════════════════╝
echo.

:: Node.js 확인
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [오류] Node.js가 설치되어 있지 않습니다.
    echo        https://nodejs.org 에서 설치 후 다시 실행해주세요.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [확인] Node.js %NODE_VER% 감지됨

:: npm 패키지 설치
echo.
echo [1/3] 패키지 설치 중... (1~2분 소요)
call npm install
if %errorlevel% neq 0 (
    echo [오류] 패키지 설치에 실패했습니다.
    pause
    exit /b 1
)
echo [완료] 패키지 설치 성공!

:: .env.local 생성 여부 확인
echo.
if exist .env.local (
    echo [확인] .env.local 파일이 이미 존재합니다.
) else (
    echo [2/3] 환경 변수 파일을 생성합니다...
    copy .env.example .env.local >nul 2>&1
    if exist .env.local (
        echo [완료] .env.local 파일이 생성되었습니다.
        echo [중요] .env.local 을 메모장으로 열어 API 키를 입력해주세요!
    ) else (
        echo [경고] .env.example 파일이 없습니다. 직접 .env.local을 생성해주세요.
    )
)

:: 빌드 테스트
echo.
echo [3/3] 빌드 테스트 중...
call npm run build >nul 2>&1
if %errorlevel% neq 0 (
    echo [경고] 빌드에 문제가 있습니다. .env.local 설정을 확인해주세요.
) else (
    echo [완료] 빌드 테스트 성공!
)

echo.
echo  ════════════════════════════════════════
echo   설치 완료! 아래 명령으로 실행하세요:
echo.
echo     start.bat
echo.
echo   또는 직접 실행:
echo     npm run dev
echo  ════════════════════════════════════════
echo.
pause
