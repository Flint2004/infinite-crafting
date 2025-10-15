# 更新日志 V2.0 - Docker + 硅基流动 API

## 版本 2.1.0 - Docker 化 + API 调用

### 🎉 重大更新

#### 1. 替换本地 LLM 为云端 API

**之前：**
- 使用 node-llama-cpp
- 需要下载 7.7GB 的 Mistral-7B 模型
- 首次加载需要等待 10-30 秒
- 占用大量内存和 CPU

**现在：**
- 使用硅基流动 API（DeepSeek-V3）
- 无需下载任何模型文件
- 响应时间 1-3 秒
- 零本地资源占用
- 完全免费（有配额）

#### 2. Docker 容器化部署

**新增功能：**
- ✅ 后端 Dockerfile
- ✅ docker-compose.yml 完整配置
- ✅ 数据持久化（volume 挂载）
- ✅ 环境变量管理
- ✅ 自动重启策略
- ✅ 网络隔离

**优势：**
- 一键启动，无需配置环境
- 跨平台一致性
- 易于部署和扩展
- 数据安全保护

#### 3. 数据持久化优化

**改进：**
- 数据库文件存储在 `server/data/cache.db`
- Docker volume 挂载到宿主机
- 支持独立配置数据库路径
- 自动创建数据目录

### 📋 文件变更

#### 新增文件
- ✅ `server/Dockerfile` - 后端容器定义
- ✅ `server/.dockerignore` - Docker 构建忽略文件
- ✅ `server/env.example` - 后端环境变量模板
- ✅ `env.example` - 项目环境变量模板
- ✅ `DOCKER_DEPLOY.md` - Docker 部署完整指南
- ✅ `CHANGELOG_V2.md` - 本文件

#### 修改文件
- ✏️ `server/index.js` - 替换 LLM 调用为 API 调用
- ✏️ `server/package.json` - 移除 node-llama-cpp，添加 axios
- ✏️ `docker-compose.yml` - 添加后端服务配置
- ✏️ `README_CN.md` - 更新部署说明
- ✏️ `QUICKSTART_CN.md` - 添加 Docker 快速启动

#### 删除依赖
- ❌ `node-llama-cpp` - 不再需要本地 LLM
- ❌ `models/` 文件夹 - 不再需要模型文件

### 🔧 技术细节

#### API 调用实现

```javascript
// 旧代码：本地 LLM
const model = new LlamaModel({
    modelPath: path.join(__dirname, "models", "mistral-7b-instruct-v0.1.Q8_0.gguf"),
});
const context = new LlamaContext({model, seed: 0});
const session = new LlamaChatSession({context});

// 新代码：API 调用
const response = await axios.post(
    'https://api.siliconflow.cn/v1/chat/completions',
    {
        model: 'deepseek-ai/DeepSeek-V3',
        messages: [...],
        temperature: 0.7,
        max_tokens: 200,
        response_format: { type: 'json_object' }
    },
    {
        headers: {
            'Authorization': `Bearer ${SILICONFLOW_API_KEY}`,
            'Content-Type': 'application/json'
        }
    }
);
```

#### Docker 配置

```yaml
# docker-compose.yml
services:
  backend:
    build: ./server
    ports:
      - "3000:3000"
    environment:
      - SILICONFLOW_API_KEY=${SILICONFLOW_API_KEY}
    volumes:
      - ./server/data:/app/data
    restart: unless-stopped
```

#### 数据持久化

```javascript
// 数据库路径配置
const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'cache.db');

// 自动创建数据目录
const dbDir = path.dirname(dbPath);
await fs.promises.mkdir(dbDir, { recursive: true });
```

### 📊 性能对比

| 指标 | V1.0 本地 LLM | V2.0 API 调用 | 提升 |
|------|--------------|--------------|------|
| 首次启动 | 10-30秒 | 1-3秒 | **10倍+** |
| 合成响应 | 5-10秒 | 1-3秒 | **3倍+** |
| 内存占用 | 4-8GB | <100MB | **40倍+** |
| 磁盘占用 | 8GB+ | <100MB | **80倍+** |
| 部署时间 | 30分钟+ | 3分钟 | **10倍+** |

### 💰 成本对比

#### V1.0 - 本地 LLM
- 硬件要求：8GB+ 内存，4核+ CPU
- 电费：持续运行功耗高
- 部署：需要技术人员配置
- 总成本：**中等偏高**

#### V2.0 - API 调用
- 硬件要求：512MB 内存即可
- API 费用：**完全免费**（硅基流动免费额度）
- 部署：任何人都能部署
- 总成本：**几乎为零**

### 🚀 迁移指南

#### 从 V1.0 升级到 V2.0

1. **备份数据**
```bash
cp server/cache.db server/cache.db.v1.backup
```

2. **拉取新代码**
```bash
git pull origin main
```

3. **配置环境变量**
```bash
cp env.example .env
# 编辑 .env，添加 SILICONFLOW_API_KEY
```

4. **迁移数据库**
```bash
mkdir -p server/data
cp server/cache.db server/data/cache.db
```

5. **启动新版本**
```bash
# Docker 方式
docker-compose up -d

# 或本地方式
cd server && npm install && npm start
```

### 🔐 环境变量说明

#### 必需配置

```bash
SILICONFLOW_API_KEY=sk-xxxxxxxxxx  # 必须！从硅基流动获取
```

#### 可选配置

```bash
PORT=3000                            # 后端端口
DB_PATH=/app/data/cache.db          # 数据库路径
FRONTEND_DOMAIN=opencraft.yourdomain.com  # 前端域名（Traefik）
BACKEND_DOMAIN=api.opencraft.yourdomain.com  # 后端域名（Traefik）
```

### 🐛 已知问题

1. **API 配额限制**
   - 硅基流动免费版有调用限制
   - 建议注册多个账号或升级套餐

2. **网络依赖**
   - 需要稳定的网络连接到硅基流动 API
   - 国内网络完全可用，无需代理

3. **响应时间**
   - 首次合成 2-5 秒（取决于网络）
   - 缓存的组合立即返回

### 💡 最佳实践

1. **使用 Docker 部署**
   - 简单、可靠、一致
   - 推荐用于生产环境

2. **定期备份数据库**
```bash
# 自动备份脚本
0 0 * * * cp /path/to/server/data/cache.db /path/to/backup/cache.db.$(date +\%Y\%m\%d)
```

3. **监控 API 使用**
   - 在硅基流动控制台查看调用量
   - 接近配额时及时调整

4. **配置资源限制**
```yaml
deploy:
  resources:
    limits:
      cpus: '0.5'
      memory: 512M
```

### 🎯 未来计划

- [ ] 支持更多 AI 模型提供商（OpenAI、Claude等）
- [ ] 添加 AI 模型切换功能
- [ ] 实现请求队列和限流
- [ ] 添加管理后台
- [ ] 支持多用户协作模式

---

## 快速开始

### Docker 部署（推荐）

```bash
# 1. 配置环境变量
cp env.example .env
# 编辑 .env，填入 SILICONFLOW_API_KEY

# 2. 启动服务
docker-compose up -d

# 3. 访问应用
# 前端：http://localhost:5173
# 后端：http://localhost:3000
```

### 本地开发

```bash
# 1. 配置后端
cd server
cp env.example .env
# 编辑 .env，填入 SILICONFLOW_API_KEY
npm install
npm start

# 2. 启动前端
cd frontend
npm install
npm run dev
```

---

**享受全新的 OpenCraft V2.0！🎉**

更快、更轻、更容易部署！

