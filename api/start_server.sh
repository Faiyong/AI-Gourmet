#!/bin/bash

# 美食笔记Flask后端服务启动脚本

echo "=================================="
echo "  美食笔记搜索 Flask API 服务"
echo "=================================="
echo ""

# 检查Python是否安装
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误: Python3 未安装"
    echo "请先安装Python3:"
    echo "  macOS: brew install python3"
    echo "  Ubuntu: sudo apt install python3"
    exit 1
fi

echo "✅ Python版本: $(python3 --version)"
echo ""

# 进入api目录
cd "$(dirname "$0")"

# 检查是否已安装依赖
if [ ! -d "venv" ]; then
    echo "📦 首次运行，正在创建虚拟环境..."
    python3 -m venv venv
    echo "✅ 虚拟环境创建完成"
fi

# 激活虚拟环境
echo "🔄 激活虚拟环境..."
source venv/bin/activate

# 安装/更新依赖（使用清华镜像源，更快更稳定）
echo "📥 安装依赖包（使用清华镜像源）..."
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple --quiet

echo ""
echo "=================================="
echo "  🚀 启动Flask服务器"
echo "=================================="
echo ""

# 启动Flask应用
python app.py

