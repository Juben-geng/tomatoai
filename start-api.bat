@echo off
:: 番茄旅行AI - API服务启动器
:: 使用方式：双击运行，或放到 C:\Users\Administrator\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup 实现开机自动启动

setlocal

:: 配置区域
set "PROJECT_DIR=%~dp0"
set "SERVER_SCRIPT=%PROJECT_DIR%hotel-api-server.js"
set "LOG_FILE=%PROJECT_DIR%api-service.log"

:: 进入项目目录
cd /d "%PROJECT_DIR%"

:: 加载 .env（如果存在）
if exist "%PROJECT_DIR%.env" (
    for /f "usebackq tokens=1,* delims==" %%a in ("%PROJECT_DIR%.env") do (
        set "%%a=%%b"
    )
)

:: 检查是否已在运行
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
    echo [%date% %time%] API服务已在运行中，跳过启动 >> "%LOG_FILE%"
    echo API服务已在运行中（端口3000），无需重复启动。
    echo 访问地址: http://localhost:3000
    pause
    exit /b
)

:: 启动API服务（后台运行）
echo [%date% %time%] 启动API服务 >> "%LOG_FILE%"
start "" /min "cmd.exe" /c "node \"%SERVER_SCRIPT%\" >> \"%LOG_FILE%\" 2>&1"

:: 等待服务就绪
echo 正在启动番茄旅行AI API服务...
timeout /t 3 /nobreak >nul

:: 验证启动成功
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
    echo [%date% %time%] API服务启动成功 >> "%LOG_FILE%"
    echo.
    echo  ✅ API服务启动成功！
    echo  本地地址: http://localhost:3000
    echo  线上地址: https://tomatoai.vercel.app
    echo.
    echo  已添加到开机启动，开机自动运行。
) else (
    echo [%date% %time%] 启动失败 >> "%LOG_FILE%"
    echo.
    echo  ❌ API服务启动失败，请检查日志：
    echo  %LOG_FILE%
)
pause
