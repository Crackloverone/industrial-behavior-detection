@echo off
chcp 65001 >nul
setlocal EnableExtensions

set "ROOT_DIR=%~dp0"
set "ERROR_COUNT=0"

set "CONDA_PYTHON=D:\anaconda\envs\lj\python.exe"

echo ========================================
echo  工业视觉行为检测系统 - Windows 环境安装脚本
echo ========================================
echo.

echo [检查 1/3] Python (lj conda 环境)...
if not exist "%CONDA_PYTHON%" (
    echo   [错误] 未找到 lj conda 环境: %CONDA_PYTHON%
    echo   请确认 anaconda 安装路径正确，或使用 conda 创建 lj 环境。
    pause
    exit /b 1
)
for /f "delims=" %%i in ('"%CONDA_PYTHON%" --version 2^>^&1') do set "PY_VERSION=%%i"
echo   [OK] %PY_VERSION% (lj conda)

echo.
echo [检查 2/3] Node.js 环境...
where node >nul 2>&1
if errorlevel 1 (
    echo   [错误] 未找到 Node.js。
    echo   请先安装 Node.js 18 或更高版本: https://nodejs.org/
    pause
    exit /b 1
)
for /f "delims=" %%i in ('node --version 2^>^&1') do set "NODE_VERSION=%%i"
echo   [OK] %NODE_VERSION%

echo.
echo [检查 3/3] pnpm 环境...
where pnpm >nul 2>&1
if errorlevel 1 (
    echo   未找到 pnpm，尝试启用 corepack...
    corepack enable
    where pnpm >nul 2>&1
    if errorlevel 1 (
        echo   [错误] pnpm 不可用。请手动执行 corepack enable 后重试。
        pause
        exit /b 1
    )
)
for /f "delims=" %%i in ('pnpm --version 2^>^&1') do set "PNPM_VERSION=%%i"
echo   [OK] pnpm %PNPM_VERSION%

echo.
echo [安装 1/2] 检查 Python 缺失依赖...
"%CONDA_PYTHON%" -c "import onnxruntime, websockets, passlib, aiofiles, flask" >nul 2>&1
if errorlevel 1 (
    echo   安装缺失的 Python 包...
    "%CONDA_PYTHON%" -m pip install onnxruntime websockets passlib aiofiles flask
    if errorlevel 1 (
        echo   [错误] Python 依赖安装失败。
        set /a ERROR_COUNT+=1
    ) else (
        echo   [OK] Python 依赖安装完成。
    )
) else (
    echo   [OK] Python 依赖已就绪。
)

"%CONDA_PYTHON%" -c "import behavior_detection" >nul 2>&1
if errorlevel 1 (
    echo   安装 behavior-detection-lite 模块...
    "%CONDA_PYTHON%" -m pip install -e "%ROOT_DIR%behavior-detection-lite"
    if errorlevel 1 (
        echo   [错误] behavior-detection-lite 安装失败。
        set /a ERROR_COUNT+=1
    ) else (
        echo   [OK] behavior-detection-lite 安装完成。
    )
) else (
    echo   [OK] behavior-detection-lite 已就绪。
)

echo.
echo [安装 2/2] 前端依赖...
cd /d "%ROOT_DIR%frontend"
call pnpm install --frozen-lockfile
if errorlevel 1 (
    echo   [错误] 前端依赖安装失败。
    set /a ERROR_COUNT+=1
) else (
    echo   [OK] 前端依赖安装完成。
)

echo.
echo ========================================
if "%ERROR_COUNT%"=="0" (
    echo   环境安装完成。
    echo   下一步：运行 start.bat 启动系统。
) else (
    echo   环境安装结束，但有 %ERROR_COUNT% 个错误。
    echo   请根据上方错误信息处理后重新运行 install.bat。
)
echo ========================================
echo.
pause
