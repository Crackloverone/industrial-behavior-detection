@echo off
chcp 65001 >nul
setlocal EnableExtensions

set ROOT_DIR=%~dp0
if "%BACKEND_PORT%"=="" set BACKEND_PORT=8000
if "%FRONTEND_PORT%"=="" set FRONTEND_PORT=3000
set CONDA_PYTHON=D:\anaconda\envs\lj\python.exe

echo ========================================
echo  Industrial Vision Behavior System
echo ========================================
echo.

if not exist "%CONDA_PYTHON%" (
    echo [ERROR] Python not found: %CONDA_PYTHON%
    pause
    exit /b 1
)
echo [OK] Python: lj conda

where pnpm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] pnpm not found
    pause
    exit /b 1
)
echo [OK] pnpm

if not exist "%ROOT_DIR%frontend\node_modules" (
    echo [ERROR] frontend\node_modules missing, run install.bat first
    pause
    exit /b 1
)
echo [OK] Frontend deps

echo.
echo [1/2] Starting backend on port %BACKEND_PORT% ...
start "Backend" /D "%ROOT_DIR%" cmd /k "%CONDA_PYTHON% -m uvicorn backend.main:app --host 127.0.0.1 --port %BACKEND_PORT%"

echo [2/2] Starting frontend on port %FRONTEND_PORT% ...
start "Frontend" /D "%ROOT_DIR%frontend" cmd /k "set API_BASE=http://localhost:%BACKEND_PORT%&& set NEXT_PUBLIC_API_BASE=http://localhost:%BACKEND_PORT%&& pnpm exec next dev -p %FRONTEND_PORT%"

echo.
echo Waiting for services...
timeout /t 6 >nul
start http://localhost:%FRONTEND_PORT%

echo.
echo ========================================
echo   Frontend: http://localhost:%FRONTEND_PORT%
echo   Backend:  http://localhost:%BACKEND_PORT%
echo   Keep the two cmd windows open.
echo ========================================
echo.
pause
