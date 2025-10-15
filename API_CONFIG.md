# API 配置指南

## 环境变量配置

### 后端环境变量

在 `server/.env` 或 Docker 的 `.env` 文件中配置：

#### 必需配置

```bash
# 硅基流动 API Key (必须)
SILICONFLOW_API_KEY=sk-your-api-key-here
```

#### AI 配置

```bash
# AI API 地址
SILICONFLOW_API_URL=https://api.siliconflow.cn/v1/chat/completions

# AI 模型名称
AI_MODEL=deepseek-ai/DeepSeek-V3

# AI 温度参数 (0.0-2.0)
AI_TEMPERATURE=0.7

# AI 最大生成Token数
AI_MAX_TOKENS=200
```

#### 服务器配置

```bash
# 服务器端口
PORT=3000

# 数据库路径
DB_PATH=/app/data/cache.db
```

### 前端环境变量

在 `frontend/.env.development` 或 `frontend/.env.production` 中配置：

```bash
# API 基础 URL
VITE_API_BASE_URL=http://localhost:3000

# 应用标题
VITE_APP_TITLE=OpenCraft
```

## 支持的 AI 模型

### 硅基流动可用模型

| 模型名称 | 描述 | 推荐场景 |
|---------|------|---------|
| `deepseek-ai/DeepSeek-V3` | 最新DeepSeek模型 | **推荐** - 最佳中文理解 |
| `deepseek-ai/DeepSeek-V2.5` | DeepSeek上一代 | 稳定性更高 |
| `Qwen/Qwen2.5-72B-Instruct` | 通义千问大模型 | 高准确率 |
| `Qwen/Qwen2.5-7B-Instruct` | 通义千问轻量版 | 快速响应 |

### 切换模型

只需修改 `AI_MODEL` 环境变量：

```bash
# 使用 DeepSeek-V3 (推荐)
AI_MODEL=deepseek-ai/DeepSeek-V3

# 或使用通义千问
AI_MODEL=Qwen/Qwen2.5-72B-Instruct
```

重启服务后生效：
```bash
docker-compose restart backend
```

## 温度参数调整

`AI_TEMPERATURE` 控制生成的随机性：

- **0.0-0.3**: 非常确定性，结果一致
- **0.4-0.7**: 平衡（推荐）
- **0.8-1.2**: 更有创造性
- **1.3-2.0**: 非常随机

### 示例场景

```bash
# 追求稳定结果
AI_TEMPERATURE=0.3

# 平衡创造性和稳定性 (推荐)
AI_TEMPERATURE=0.7

# 追求创意和多样性
AI_TEMPERATURE=1.2
```

## Token 数量配置

`AI_MAX_TOKENS` 控制生成长度：

```bash
# 简短结果 (推荐)
AI_MAX_TOKENS=200

# 更详细结果
AI_MAX_TOKENS=500

# 最大结果
AI_MAX_TOKENS=1000
```

**注意**：Token 越多，API 调用成本越高，响应时间越长。

## 前端 API 代理配置

### 开发环境

Vite 自动将 `/api` 请求代理到后端：

```typescript
// vite.config.ts
proxy: {
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, '')
  }
}
```

前端请求示例：
```typescript
// 自动代理到 http://localhost:3000/register
await request.post('/register', { username: 'player' })
```

### 生产环境

在生产环境部署时，配置 `VITE_API_BASE_URL`：

```bash
# .env.production
VITE_API_BASE_URL=https://api.yourdomain.com
```

或在 Nginx 中配置反向代理。

## Docker 配置示例

### 完整的 .env 文件

```bash
# ==================== 必需配置 ====================
SILICONFLOW_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxx

# ==================== AI 配置 ====================
SILICONFLOW_API_URL=https://api.siliconflow.cn/v1/chat/completions
AI_MODEL=deepseek-ai/DeepSeek-V3
AI_TEMPERATURE=0.7
AI_MAX_TOKENS=200

# ==================== 前端配置 ====================
VITE_API_BASE_URL=http://backend:3000
VITE_APP_TITLE=OpenCraft

# ==================== Traefik (可选) ====================
NETWORK_NAME=reverse-proxy-docker-traefik_routing
FRONTEND_DOMAIN=opencraft.yourdomain.com
BACKEND_DOMAIN=api.opencraft.yourdomain.com
```

### 启动服务

```bash
docker-compose up -d
```

### 查看配置

```bash
# 查看后端配置
docker-compose logs backend | grep "服务器启动成功" -A 5

# 输出示例：
# ✅ 服务器启动成功
#    端口: 3000
#    AI模型: deepseek-ai/DeepSeek-V3
#    API地址: https://api.siliconflow.cn/v1/chat/completions
#    API Key: sk-xxxxxxxx...
```

## API 请求流程

### 开发环境

```
浏览器 → Vite Dev Server (5173)
                ↓ /api 代理
         后端服务器 (3000)
                ↓
         硅基流动 API
```

### Docker 环境

```
浏览器 → 前端容器 (5173)
                ↓ /api 代理
         后端容器 (3000)
           ↓ 容器网络
    硅基流动 API (互联网)
```

## 常见问题

### Q1: 如何切换到其他 AI 服务商？

只需修改 `SILICONFLOW_API_URL` 和认证方式：

```bash
# 使用 OpenAI
SILICONFLOW_API_URL=https://api.openai.com/v1/chat/completions
SILICONFLOW_API_KEY=sk-your-openai-key
AI_MODEL=gpt-4

# 使用阿里云百炼
SILICONFLOW_API_URL=https://dashscope.aliyuncs.com/v1/chat/completions
SILICONFLOW_API_KEY=your-dashscope-key
AI_MODEL=qwen-max
```

### Q2: 前端请求跨域怎么办？

开发环境使用 Vite 代理（已配置），生产环境有三个选择：

1. **使用同域部署**（推荐）
2. **配置 Nginx 反向代理**
3. **后端开启 CORS**（已默认开启）

### Q3: 如何测试 API 配置？

```bash
# 测试后端健康
curl http://localhost:3000/elements/base

# 测试前端代理
# 启动前端后访问
curl http://localhost:5173/api/elements/base
```

### Q4: Docker 容器内如何访问后端？

容器间使用容器名称通信：

```bash
# 前端容器内访问后端
VITE_API_BASE_URL=http://backend:3000

# 而不是
VITE_API_BASE_URL=http://localhost:3000
```

## 性能优化建议

1. **模型选择**：
   - 开发测试：使用轻量级模型（Qwen2.5-7B）
   - 生产环境：使用高性能模型（DeepSeek-V3）

2. **温度参数**：
   - 追求稳定性：0.3-0.5
   - 平衡体验：0.7（推荐）
   - 追求创意：1.0-1.2

3. **Token 限制**：
   - 保持在 200 以内，既能保证质量又能控制成本

4. **缓存策略**：
   - 相同组合自动使用缓存，无需重复调用 API
   - 定期备份数据库，避免缓存丢失

---

**配置完成后，享受高效的 AI 元素合成游戏吧！** 🎮✨

