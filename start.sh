#!/bin/bash

echo "=========================================="
echo "🍜 舌尖上的AI - 一键启动"
echo "=========================================="
echo ""

# 检查Python
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误: 未找到 Python 3"
    echo "请先安装 Python 3.7 或更高版本"
    exit 1
fi

echo "✅ Python 版本: $(python3 --version)"
echo ""

# 启动后端服务器
echo "🚀 启动后端服务器 (端口 5000)..."
cd api

# 检查虚拟环境
if [ ! -d "venv" ]; then
    echo "📦 创建虚拟环境..."
    python3 -m venv venv
fi

# 激活虚拟环境
source venv/bin/activate

# 安装依赖
echo "📦 安装依赖包..."
pip install -q -r requirements.txt

# 后台启动Flask
python3 app.py > /dev/null 2>&1 &
BACKEND_PID=$!
echo "✅ 后端服务器已启动 (PID: $BACKEND_PID)"
echo ""

# 返回根目录
cd ..

# 启动前端服务器
echo "🚀 启动前端服务器 (端口 8000)..."
python3 -m http.server 8000 > /dev/null 2>&1 &
FRONTEND_PID=$!
echo "✅ 前端服务器已启动 (PID: $FRONTEND_PID)"
echo ""

# 显示访问信息
echo "=========================================="
echo "🎉 服务器启动成功！"
echo "=========================================="
echo ""
echo "📱 访问地址: http://localhost:8000/index.html"
echo ""
echo "💡 提示:"
echo "  - 首次访问需要授权GPS定位"
echo "  - 按 Ctrl+C 停止服务"
echo ""
echo "=========================================="
echo ""

# 等待用户中断
wait

# 清理：关闭所有服务器
echo ""
echo "🛑 正在关闭服务器..."
kill $BACKEND_PID 2>/dev/null
kill $FRONTEND_PID 2>/dev/null
echo "✅ 服务器已关闭"

