# 🚀 快速启动指南

## 第一步：启动后端服务

后端项目位置：`/Volumes/MOVESPEED/qa_coding/mobile-standalone-backend`

### Windows 用户
双击运行 `start.bat` 或在命令行执行：
```bash
cd /Volumes/MOVESPEED/qa_coding/mobile-standalone-backend
mvn spring-boot:run
```

### Mac/Linux 用户
运行启动脚本：
```bash
./start.sh
```

或手动启动：
```bash
cd /Volumes/MOVESPEED/qa_coding/mobile-standalone-backend
mvn spring-boot:run
```

**后端服务地址**: http://127.0.0.1:3000/api

---

## 第二步：启动前端

### 首次运行（需要安装依赖）
```bash
cd frontend
npm install
npm run dev
```

### 后续运行
```bash
cd frontend
npm run dev
```

**前端访问地址**: http://localhost:5173

---

## 第三步：使用 Electron 桌面应用（可选）

```bash
cd frontend
npm run electron:dev
```

---

## ✅ 验证启动成功

1. **检查后端**: 浏览器访问 http://127.0.0.1:3000/api/health
   - 应该返回: `{"status":"ok","timestamp":"..."}`

2. **检查前端**: 浏览器访问 http://localhost:5173
   - 应该看到应用界面

---

## 📋 功能模块

启动成功后，你可以使用以下功能：

- 🏠 **首页**: 查看统计信息和概览
- 📱 **设备管理**: 查看和管理连接的设备
- 📝 **测试任务**: 创建和管理测试任务
- 📊 **测试报告**: 查看测试报告
- 📈 **性能监控**: 查看性能监控图表
- ⚙️ **设置**: 配置应用设置

---

## ❗ 常见问题

### 后端启动失败
- 检查 Java 版本: `java -version` (需要 17+)
- 检查 Maven: `mvn -version` (需要 3.6+)
- 检查端口 3000 是否被占用

### 前端启动失败
- 检查 Node.js 版本: `node -version` (需要 18+)
- 运行 `npm install` 安装依赖
- 检查端口 5173 是否被占用

### 前端无法连接后端
- 确认后端服务已启动
- 检查后端地址是否为 http://127.0.0.1:3000/api
- 查看浏览器控制台错误信息

---

## 📞 需要帮助？

查看详细文档：
- [后端文档](/Volumes/MOVESPEED/qa_coding/mobile-standalone-backend/README.md)
