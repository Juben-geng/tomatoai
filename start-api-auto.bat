@echo off
:: 番茄旅行AI - 开机自启动服务（绝对路径版）
:: 无需管理员权限，复制到以下目录实现开机自动启动：
:: %APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\

setlocal enabledelayedexpansion

:: 绝对路径（无论从哪里启动都正确）
set "SCRIPT_DIR=C:\Users\Administrator\.qclaw\workspace\web\tomatoai"
set "SERVER_SCRIPT=%SCRIPT_DIR%\hotel-api-server.js"
set "LOG_FILE=%SCRIPT_DIR%\api-service.log"

:: 加载 .env
if exist "%SCRIPT_DIR%\.env" (
    for /f "usebackq tokens=1,* delims==" %%a in ("%SCRIPT_DIR%\.env") do (
        set "%%a=%%b"
    )
)

:: 检查端口3000是否已有服务
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [%date% %time%] 端口3000已在运行，跳过 >> "%LOG_FILE%"
    exit /b 0
)

:: 启动服务
echo [%date% %time%] 开机自动启动API服务 >> "%LOG_FILE%"
start "" /b cmd /c "node.exe "%SERVER_SCRIPT%" >> "%LOG_FILE%" 2>&1"

:: 等待服务就绪（最多15秒）
for /L %%i in (1,1,15) do (
    timeout /t 1 /nobreak >nul
    netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1
    if !errorlevel! equ 0 (
        echo [%date% %time%] API服务启动成功（端口3000） >> "%LOG_FILE%"
        exit /b 0
    )
)
exit /b 0
