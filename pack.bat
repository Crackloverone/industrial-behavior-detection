@echo off
chcp 65001 >nul
setlocal EnableExtensions

set "ROOT_DIR=%~dp0"
set "PACKAGE_NAME=industrial_vision_behavior_windows"
set "PACKAGE_PATH=%ROOT_DIR%%PACKAGE_NAME%"

echo ========================================
echo  工业视觉行为检测系统 - Windows 迁移包打包脚本
echo ========================================
echo.
echo 将创建干净迁移包，并排除开发缓存、训练数据和本机虚拟环境。
echo.

if exist "%PACKAGE_PATH%" (
    echo [清理] 删除旧迁移包目录...
    rmdir /s /q "%PACKAGE_PATH%"
)
mkdir "%PACKAGE_PATH%"

echo [复制] 后端、前端、行为检测模块、模型、数据和训练脚本...
xcopy "%ROOT_DIR%backend" "%PACKAGE_PATH%\backend\" /s /e /y /i >nul
xcopy "%ROOT_DIR%frontend" "%PACKAGE_PATH%\frontend\" /s /e /y /i >nul
xcopy "%ROOT_DIR%behavior-detection-lite" "%PACKAGE_PATH%\behavior-detection-lite\" /s /e /y /i >nul
xcopy "%ROOT_DIR%data" "%PACKAGE_PATH%\data\" /s /e /y /i >nul
if exist "%ROOT_DIR%models" xcopy "%ROOT_DIR%models" "%PACKAGE_PATH%\models\" /s /e /y /i >nul
if exist "%ROOT_DIR%scripts" xcopy "%ROOT_DIR%scripts" "%PACKAGE_PATH%\scripts\" /s /e /y /i >nul

echo [复制] 项目配置和说明文档...
copy "%ROOT_DIR%pyproject.toml" "%PACKAGE_PATH%\" >nul
copy "%ROOT_DIR%uv.lock" "%PACKAGE_PATH%\" >nul
copy "%ROOT_DIR%requirements.txt" "%PACKAGE_PATH%\" >nul
copy "%ROOT_DIR%install.bat" "%PACKAGE_PATH%\" >nul
copy "%ROOT_DIR%start.bat" "%PACKAGE_PATH%\" >nul
copy "%ROOT_DIR%stop.bat" "%PACKAGE_PATH%\" >nul
copy "%ROOT_DIR%README.md" "%PACKAGE_PATH%\" >nul
copy "%ROOT_DIR%README_交付文档.md" "%PACKAGE_PATH%\" >nul
copy "%ROOT_DIR%README_WINDOWS.md" "%PACKAGE_PATH%\" >nul

echo [清理] 删除不应进入迁移包的内容...
if exist "%PACKAGE_PATH%\datasets" rmdir /s /q "%PACKAGE_PATH%\datasets"
if exist "%PACKAGE_PATH%\frontend\node_modules" rmdir /s /q "%PACKAGE_PATH%\frontend\node_modules"
if exist "%PACKAGE_PATH%\frontend\.next" rmdir /s /q "%PACKAGE_PATH%\frontend\.next"
if exist "%PACKAGE_PATH%\frontend\.next-dev" rmdir /s /q "%PACKAGE_PATH%\frontend\.next-dev"
if exist "%PACKAGE_PATH%\behavior-detection-lite\models\backups" rmdir /s /q "%PACKAGE_PATH%\behavior-detection-lite\models\backups"
if exist "%PACKAGE_PATH%\models\trained" rmdir /s /q "%PACKAGE_PATH%\models\trained"
if exist "%PACKAGE_PATH%\data\alarm_videos" rmdir /s /q "%PACKAGE_PATH%\data\alarm_videos"

for /d /r "%PACKAGE_PATH%" %%D in (__pycache__) do rmdir /s /q "%%D" 2>nul
for /d /r "%PACKAGE_PATH%" %%D in (.pytest_cache) do rmdir /s /q "%%D" 2>nul
for /d /r "%PACKAGE_PATH%" %%D in (.venv) do rmdir /s /q "%%D" 2>nul

del /s /q "%PACKAGE_PATH%\*.pyc" >nul 2>&1
del /s /q "%PACKAGE_PATH%\*.log" >nul 2>&1
del /s /q "%PACKAGE_PATH%\*.bak" >nul 2>&1
del /s /q "%PACKAGE_PATH%\.DS_Store" >nul 2>&1

echo.
echo ========================================
echo   迁移包已生成：
echo   %PACKAGE_PATH%
echo.
echo   Windows 机器上运行顺序：
echo   1. install.bat
echo   2. start.bat
echo.
echo   访问地址：http://localhost:3000
echo ========================================
echo.
pause
explorer "%PACKAGE_PATH%"
