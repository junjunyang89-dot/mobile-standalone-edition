#!/bin/bash

echo "=========================================="
echo "  Mobile Standalone Edition 启动脚本"
echo "=========================================="
echo ""

# 检查 Java
if ! command -v java &> /dev/null; then
    echo "❌ 错误: 未找到 Java，请先安装 JDK 17+"
    exit 1
fi

# 检查 Maven
if ! command -v mvn &> /dev/null; then
    echo "❌ 错误: 未找到 Maven，请先安装 Maven 3.6+"
    exit 1
fi

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js，请先安装 Node.js 18+"
    exit 1
fi

echo "✅ 环境检查通过"
echo ""

# 启动后端
echo "🚀 启动后端服务..."
cd /Volumes/MOVESPEED/qa_coding/mobile-standalone-backend
mvn spring-boot:run &
BACKEND_PID=$!
cd - > /dev/null

# 等待后端启动
echo "⏳ 等待后端服务启动..."
sleep 10

# 检查后端是否启动成功
if curl -s http://127.0.0.1:3000/api/health > /dev/null; then
    echo "✅ 后端服务启动成功 (http://127.0.0.1:3000/api)"
else
    echo "⚠️  后端服务可能未完全启动，请稍候..."
fi

echo ""
echo "=========================================="
echo "  后端服务已启动"
echo "  访问地址: http://127.0.0.1:3000/api"
echo ""
echo "  现在可以在另一个终端运行前端:"
echo "  cd frontend && npm run dev"
echo ""
echo "  或按 Ctrl+C 停止后端服务"
echo "=========================================="

# 等待用户中断
wait $BACKEND_PID
