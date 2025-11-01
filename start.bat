@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

echo ==========================================
echo 🍜 舌尖上的AI - 一键启动
echo ==========================================
echo.

REM 检查Python（先尝试python，再尝试python3，最后尝试py）
set PYTHON_CMD=
where python >nul 2>nul
if %errorlevel% equ 0 (
    set PYTHON_CMD=python
) else (
    where python3 >nul 2>nul
    if %errorlevel% equ 0 (
        set PYTHON_CMD=python3
    ) else (
        where py >nul 2>nul
        if %errorlevel% equ 0 (
            set PYTHON_CMD=py
        )
    )
)

if "!PYTHON_CMD!"=="" (
    echo ❌ 错误: 未找到 Python
    echo.
    echo 请先安装 Python 3.7 或更高版本
    echo 下载地址: https://www.python.org/downloads/
    echo.
    echo 安装时请勾选 "Add Python to PATH" 选项！
    echo.
    pause
    exit /b 1
)

echo ✅ 找到 Python 命令: !PYTHON_CMD!
echo ✅ Python 版本:
!PYTHON_CMD! --version
if %errorlevel% neq 0 (
    echo ❌ Python 版本检查失败
    pause
    exit /b 1
)
echo.

REM 检查 api 目录是否存在
if not exist "api" (
    echo ❌ 错误: 未找到 api 目录
    echo 请确保在项目根目录下运行此脚本
    echo.
    pause
    exit /b 1
)

REM 启动后端服务器
echo 🚀 启动后端服务器 (端口 5000)...
cd api
if %errorlevel% neq 0 (
    echo ❌ 进入 api 目录失败
    cd ..
    pause
    exit /b 1
)

REM 检查 requirements.txt 是否存在
if not exist "requirements.txt" (
    echo ❌ 错误: 未找到 requirements.txt 文件
    cd ..
    pause
    exit /b 1
)

REM 检查虚拟环境
if not exist "venv" (
    echo 📦 创建虚拟环境（首次运行，可能需要1-2分钟）...
    !PYTHON_CMD! -m venv venv
    if %errorlevel% neq 0 (
        echo ❌ 创建虚拟环境失败
        echo 请检查 Python 是否正确安装
        cd ..
        pause
        exit /b 1
    )
    echo ✅ 虚拟环境创建成功
)

REM 激活虚拟环境
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
) else (
    echo ❌ 虚拟环境激活脚本不存在
    cd ..
    pause
    exit /b 1
)

REM 安装依赖
echo 📦 安装依赖包（首次可能需要1-2分钟）...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ❌ 依赖安装失败
    echo 提示: 可以尝试手动运行: pip install -r requirements.txt
    cd ..
    pause
    exit /b 1
)
echo ✅ 依赖安装成功
echo.

REM 检查端口5000是否被占用
netstat -ano | findstr ":5000" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️  警告: 端口 5000 已被占用
    echo 请关闭占用端口的程序，或修改 api/app.py 中的端口号
    echo.
    cd ..
    pause
    exit /b 1
)

REM 后台启动Flask
echo 启动 Flask 应用...
start /b !PYTHON_CMD! app.py >nul 2>&1
timeout /t 2 /nobreak >nul
echo ✅ 后端服务器已启动 (端口 5000)
echo.

REM 返回根目录
cd ..

REM 检查端口8000是否被占用
netstat -ano | findstr ":8000" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️  警告: 端口 8000 已被占用
    echo 请关闭占用端口的程序
    echo.
    pause
    exit /b 1
)

REM 启动前端服务器
echo 🚀 启动前端服务器 (端口 8000)...
start /b !PYTHON_CMD! -m http.server 8000 >nul 2>&1
timeout /t 2 /nobreak >nul
echo ✅ 前端服务器已启动
echo.

REM 显示访问信息
echo ==========================================
echo 🎉 服务器启动成功！
echo ==========================================
echo.
echo 📱 访问地址: http://localhost:8000/index.html
echo.
echo 💡 提示:
echo   - 首次访问需要授权GPS定位
echo   - 按 Ctrl+C 停止服务
echo   - 或直接关闭此窗口
echo.
echo ==========================================
echo.
echo 浏览器将在3秒后自动打开...
timeout /t 3 /nobreak >nul

REM 自动打开浏览器
start http://localhost:8000/index.html

REM 保持窗口打开
echo.
echo 服务器正在运行中，请勿关闭此窗口...
echo.
pause >nul

