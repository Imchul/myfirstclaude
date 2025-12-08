@echo off
chcp 65001 > nul
title AI MC Project

echo ========================================
echo    AI MC Project - 자동 설치 및 실행
echo ========================================
echo.

:: Node.js 확인
where node > nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [오류] Node.js가 설치되어 있지 않습니다.
    echo https://nodejs.org/ 에서 Node.js를 먼저 설치해주세요.
    echo.
    pause
    exit /b 1
)

echo [1/4] Node.js 버전 확인...
node --version
echo.

:: 루트 의존성 설치
echo [2/4] 루트 패키지 설치 중...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [오류] 루트 패키지 설치 실패
    pause
    exit /b 1
)
echo.

:: 백엔드 의존성 설치
echo [3/4] 백엔드 패키지 설치 중...
cd backend
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [오류] 백엔드 패키지 설치 실패
    pause
    exit /b 1
)
cd ..
echo.

:: 프론트엔드 의존성 설치
echo [4/4] 프론트엔드 패키지 설치 중...
cd frontend
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [오류] 프론트엔드 패키지 설치 실패
    pause
    exit /b 1
)
cd ..
echo.

:: .env 파일 확인
if not exist "backend\.env" (
    echo [경고] backend\.env 파일이 없습니다!
    echo backend\.env.example 파일을 참고하여 .env 파일을 생성해주세요.
    echo.
    pause
    exit /b 1
)

echo ========================================
echo    설치 완료! 서버를 시작합니다...
echo ========================================
echo.
echo 메인 스테이지: http://localhost:5173
echo 운영자 콘솔:   http://localhost:5173/operator
echo.
echo 종료하려면 이 창을 닫으세요.
echo ========================================
echo.

:: 서버 실행
call npm run dev

pause
