# OpenCraft 中文版 - 快速启动指南

## 🚀 3分钟快速开始

### 方式一：Docker 部署（推荐）⭐

**最简单！无需安装 Node.js，无需下载大模型！**

#### 第一步：获取 API Key

1. 访问：https://cloud.siliconflow.cn/
2. 注册账号（完全免费）
3. 获取 API Key（格式：sk-xxxxxxxxxx）

#### 第二步：配置环境

```bash
# 复制环境变量模板
cp env.example .env

# 编辑 .env 文件
# 必需：将 your_api_key_here 替换为你的真实 API Key
# 可选：修改 AI 模型、温度等参数
```

**最小配置**（只需这一个）：
```bash
SILICONFLOW_API_KEY=sk-your-real-api-key-here
```

#### 第三步：启动服务

```bash
# 一键启动！
docker-compose up -d

# 查看启动日志
docker-compose logs -f
```

✅ 看到 "✅ 服务器启动成功" 表示成功

#### 第四步：开始游戏

1. 打开浏览器访问：http://localhost:5173
2. 点击"注册"，输入你的用户名
3. **重要：保存系统生成的token！**
4. 开始游戏，合成新元素！

---

### 方式二：本地开发部署

**适合开发者，需要 Node.js 环境**

#### 第一步：获取 API Key

同上，访问 https://cloud.siliconflow.cn/ 获取

#### 第二步：配置后端

```bash
cd server
cp env.example .env
# 编辑 .env，填入 API Key
```

#### 第三步：启动后端

```bash
npm install
npm start
```

✅ 看到 "✅ 服务器启动成功" 表示成功

#### 第四步：启动前端

**新建一个终端窗口**

```bash
cd frontend
npm install
npm run dev
```

✅ 看到 "Local: http://localhost:5173" 表示成功

#### 第五步：开始游戏

1. 打开浏览器访问：http://localhost:5173
2. 点击"注册"，输入你的用户名
3. **重要：保存系统生成的token！**
4. 开始游戏，合成新元素！

## 🎮 游戏操作

### 基础操作
1. **拖拽元素**：从右侧元素列表拖拽元素到工作区
2. **合成元素**：将一个元素拖到另一个元素上
3. **等待生成**：AI会在几秒内生成新元素
4. **查看发现**：新元素自动添加到右侧列表

### 初始元素
- ⚙️ 金 (Metal)
- 🌲 木 (Wood)
- 💧 水 (Water)
- 🔥 火 (Fire)
- 🌍 土 (Earth)

### 示例组合
试试这些有趣的组合：
- 金 + 火 = ？
- 木 + 水 = ？
- 土 + 火 = ？
- 水 + 火 = ？

## 🔧 常见问题

### Q1: Docker 启动失败？
**A:** 检查以下几点：
1. Docker 是否正在运行？
2. 是否设置了 SILICONFLOW_API_KEY？
3. 端口 3000/5173 是否被占用？

```bash
# 查看详细错误
docker-compose logs backend

# 检查环境变量
docker-compose config
```

### Q2: API Key 无效？
**A:** 确保：
1. API Key 格式正确（sk-开头）
2. 没有多余的空格或换行
3. 在硅基流动控制台确认 Key 有效

### Q3: 前端无法连接后端？
**A:** 检查后端是否在 3000 端口运行
```bash
# Docker 方式
docker-compose ps

# 本地方式
netstat -ano | findstr :3000  # Windows
lsof -i :3000                 # Mac/Linux
```

### Q4: 合成速度如何？
**A:** 使用 DeepSeek-V3 API，合成通常在 1-3 秒内完成。首次合成可能稍慢，但已有缓存的组合会立即返回。

### Q4: 忘记token了？
**A:** Token存储在浏览器 LocalStorage 中：
- 按 F12 打开开发者工具
- 找到 Application/Storage → Local Storage
- 查看 `opencraft/user` 字段

### Q5: 想重置数据？
```bash
# 删除数据库文件
rm server/cache.db

# 重启后端
cd server
npm start
```

## 📝 下次启动

### Docker 方式
```bash
# 启动
docker-compose up -d

# 停止
docker-compose down
```

### 本地开发方式
```bash
# 终端1：启动后端
cd server
npm start

# 终端2：启动前端  
cd frontend
npm run dev
```

然后使用之前的token登录即可！

## 💡 小提示

- 🎯 **发现新元素**：第一个合成某个元素的玩家会被记录为发现者
- 💾 **自动保存**：你的元素列表会自动保存到浏览器
- 🔍 **搜索功能**：右侧搜索框支持中英文搜索
- 🎨 **无限可能**：理论上可以合成无限多的元素
- ⚡ **快速响应**：使用云端 AI，无需等待模型加载
- 🔒 **数据持久化**：Docker 方式部署，数据永久保存在 `server/data/`
- 🤖 **自定义 AI**：可以切换不同的 AI 模型，调整创造性参数

## 🆘 需要帮助？

查看完整文档：
- [中文说明](README_CN.md)
- [Docker 部署指南](DOCKER_DEPLOY.md)
- [API 配置指南](API_CONFIG.md) 🆕
- [更新日志](CHANGELOG_CN.md)
- [原始README](README.md)

---

**祝你玩得开心！🎮✨**

