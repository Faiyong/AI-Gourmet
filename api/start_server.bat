@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

echo ==================================
echo   美食笔记搜索 Flask API 服务
echo ==================================
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

REM 进入api目录
cd /d "%~dp0"

REM 检查 requirements.txt 是否存在
if not exist "requirements.txt" (
    echo ❌ 错误: 未找到 requirements.txt 文件
    echo 请确保在 api 目录下运行此脚本
    echo.
    pause
    exit /b 1
)

REM 检查 app.py 是否存在
if not exist "app.py" (
    echo ❌ 错误: 未找到 app.py 文件
    echo.
    pause
    exit /b 1
)

REM 检查是否已安装依赖
if not exist "venv" (
    echo 📦 首次运行，正在创建虚拟环境（可能需要1-2分钟）...
    !PYTHON_CMD! -m venv venv
    if %errorlevel% neq 0 (
        echo ❌ 创建虚拟环境失败
        echo 请检查 Python 是否正确安装
        pause
        exit /b 1
    )
    echo ✅ 虚拟环境创建完成
)

REM 激活虚拟环境
echo 🔄 激活虚拟环境...
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
) else (
    echo ❌ 虚拟环境激活脚本不存在
    pause
    exit /b 1
)

REM 安装/更新依赖（使用清华镜像源，更快更稳定）
echo 📥 安装依赖包（使用清华镜像源，首次可能需要1-2分钟）...
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
if %errorlevel% neq 0 (
    echo ❌ 依赖安装失败
    echo 提示: 可以尝试不使用镜像源: pip install -r requirements.txt
    pause
    exit /b 1
)
echo ✅ 依赖安装成功
echo.

REM 检查端口5000是否被占用
netstat -ano | findstr ":5000" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️  警告: 端口 5000 已被占用
    echo.
    echo 请先关闭占用端口的程序
    echo 查看占用端口的进程: netstat -ano ^| findstr ":5000"
    echo.
    pause
    exit /b 1
)

echo ==================================
echo   🚀 启动Flask服务器
echo ==================================
echo.
echo 启动中...
echo.

REM 启动Flask应用
!PYTHON_CMD! app.py

echo.
echo 服务器已停止
pause

