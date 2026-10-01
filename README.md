# Mobile Standalone Edition

基于 Electron + Vue 3 的移动端自动化测试框架桌面客户端。

## 📋 项目结构

本项目是**前端项目**，后端已分离到独立项目：

```
qa_coding/
├── mobile-standalone-backend/    # 后端项目（独立）
│   └── Spring Boot + MyBatis + MySQL
└── mobile-standalone-edition/    # 前端项目（当前项目）
    └── Electron + Vue 3 + Vite
```

## 🚀 快速启动

### 前置要求

- **Node.js** 18.0+
- **npm** 9.0+
- **Java JDK** 17+（用于后端）
- **Maven** 3.6+（用于后端）
- **MySQL** 8.0+（用于后端）

### 启动步骤

#### 1. 启动后端服务

```bash
cd /Volumes/MOVESPEED/qa_coding/mobile-standalone-backend
mvn spring-boot:run
```

后端服务运行在：`http://127.0.0.1:3080/api`

#### 2. 启动前端（开发模式）

```bash
cd /Volumes/MOVESPEED/qa_coding/mobile-standalone-edition
npm install  # 首次运行
npm run dev
```

访问：`http://localhost:5173`

#### 3. 启动 Electron（桌面应用）

```bash
# 确保后端已启动
cd /Volumes/MOVESPEED/qa_coding/mobile-standalone-edition
npm run dev:electron
```

## 📦 构建应用

### Mac 构建

```bash
npm run build:mac
```

构建产物在 `release` 目录：
- `Mobile Standalone Edition-1.0.0-arm64.dmg`
- `Mobile Standalone Edition-1.0.0-arm64-mac.zip`

## ⚙️ 技术栈

- **前端框架**: Vue 3 + Vite
- **UI 组件**: Element Plus
- **状态管理**: Pinia
- **桌面框架**: Electron
- **数据可视化**: ECharts
- **后端通信**: HTTP RESTful API

## 🔗 后端项目

后端项目位置：`/Volumes/MOVESPEED/qa_coding/mobile-standalone-backend`

- **技术栈**: Spring Boot 3.2.0 + MyBatis 3.0.3 + MySQL
- **API 地址**: `http://127.0.0.1:3080/api`
- **详细文档**: 查看后端项目的 README.md

## 📝 开发说明

### 前端开发

```bash
npm run dev          # 启动 Vite 开发服务器
npm run dev:electron # 启动 Electron 开发模式
```

### 后端开发

```bash
cd /Volumes/MOVESPEED/qa_coding/mobile-standalone-backend
mvn spring-boot:run
```

## 🔧 配置

### API 地址配置

前端通过环境变量配置后端地址：

```bash
# .env
VITE_API_BASE_URL=http://127.0.0.1:3080/api
```

默认使用：`http://127.0.0.1:3080/api`

## 📞 需要帮助？

- 查看 [QUICK_START.md](./QUICK_START.md)
- 查看后端项目文档：`/Volumes/MOVESPEED/qa_coding/mobile-standalone-backend/README.md`
