#!/bin/bash

echo "=========================================="
echo "  Mobile Standalone Edition - Mac 安装"
echo "=========================================="
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js"
    echo "请先安装 Node.js 18+: https://nodejs.org/"
    exit 1
fi

# 检查 Java
if ! command -v java &> /dev/null; then
    echo "❌ 错误: 未找到 Java"
    echo "请先安装 Java JDK 17+: https://adoptium.net/"
    exit 1
fi

# 检查 Maven
if ! command -v mvn &> /dev/null; then
    echo "❌ 错误: 未找到 Maven"
    echo "请先安装 Maven 3.6+: https://maven.apache.org/"
    exit 1
fi

echo "✅ 环境检查通过"
echo ""

# 安装依赖
echo "📦 安装依赖..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ 依赖安装失败"
    exit 1
fi

echo ""
echo "🔨 开始构建 Mac 应用..."
echo "这可能需要 5-10 分钟，请耐心等待..."
echo ""

# 构建应用
npm run build:mac

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "  ✅ 构建成功！"
    echo "=========================================="
    echo ""
    echo "📦 安装包位置:"
    echo "  - DMG: release/Mobile Standalone Edition-*.dmg"
    echo "  - ZIP: release/Mobile Standalone Edition-*-mac.zip"
    echo ""
    echo "📝 安装步骤:"
    echo "  1. 打开 release 目录"
    echo "  2. 双击 DMG 文件"
    echo "  3. 将应用拖拽到 Applications 文件夹"
    echo "  4. 启动应用"
    echo ""
    echo "⚠️  首次启动可能需要:"
    echo "  系统设置 → 隐私与安全性 → 仍要打开"
    echo ""
else
    echo ""
    echo "❌ 构建失败，请检查错误信息"
    exit 1
fi
