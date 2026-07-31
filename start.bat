@echo off
chcp 65001 >nul
echo ==========================================
echo   Mobile Standalone Edition 启动脚本
echo ==========================================
echo.

REM 检查 Java
where java >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到 Java，请先安装 JDK 17+
    pause
    exit /b 1
)

REM 检查 Maven
where mvn >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到 Maven，请先安装 Maven 3.6+
    pause
    exit /b 1
)

REM 检查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到 Node.js，请先安装 Node.js 18+
    pause
    exit /b 1
)

echo ✅ 环境检查通过
echo.

REM 启动后端
echo 🚀 启动后端服务...
cd /d "%~dp0\..\mobile-standalone-backend"
start "后端服务" cmd /k "mvn spring-boot:run"
cd /d "%~dp0"

echo.
echo ==========================================
echo   后端服务正在启动中...
echo   访问地址: http://127.0.0.1:3000/api
echo.
echo   现在可以在另一个终端运行前端:
echo   cd frontend ^&^& npm run dev
echo.
echo   或关闭此窗口停止后端服务
echo ==========================================
echo.
pause
