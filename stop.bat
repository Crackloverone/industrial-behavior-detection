@echo off
chcp 65001 >nul
setlocal EnableExtensions

set "BACKEND_PORT=%BACKEND_PORT%"
set "FRONTEND_PORT=%FRONTEND_PORT%"
if "%BACKEND_PORT%"=="" set "BACKEND_PORT=8000"
if "%FRONTEND_PORT%"=="" set "FRONTEND_PORT=3000"

echo ========================================
echo  工业视觉行为检测系统 - Windows 停止脚本
echo ========================================
echo.
echo 将尝试停止监听端口 %BACKEND_PORT% 和 %FRONTEND_PORT% 的进程。
echo.

for %%P in (%BACKEND_PORT% %FRONTEND_PORT%) do (
    for /f "tokens=5" %%A in ('netstat -ano ^| findstr /R /C:":%%P .*LISTENING"') do (
        echo 停止端口 %%P 的进程 PID %%A
        taskkill /PID %%A /T /F >nul 2>&1
    )
)

echo.
echo 停止命令已执行。
pause
