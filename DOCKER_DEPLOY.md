# OpenCraft Docker 部署指南

## 🚀 Docker 快速部署

### 前置要求
- Docker 20.10+
- Docker Compose 2.0+
- 硅基流动 API Key（免费注册：https://cloud.siliconflow.cn/）

### 第一步：配置环境变量

1. 复制环境变量模板
```bash
cp env.example .env
```

2. 编辑 `.env` 文件，填入你的 API Key
```bash
SILICONFLOW_API_KEY=sk-your-actual-api-key-here
```

### 第二步：创建数据目录

```bash
mkdir -p server/data
```

### 第三步：启动服务

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### 第四步：访问应用

- 前端：http://localhost:5173
- 后端API：http://localhost:3000

## 📋 常用命令

### 启动服务
```bash
docker-compose up -d
```

### 停止服务
```bash
docker-compose down
```

### 重启服务
```bash
docker-compose restart
```

### 查看日志
```bash
# 查看所有服务日志
docker-compose logs -f

# 只查看后端日志
docker-compose logs -f backend

# 只查看前端日志
docker-compose logs -f frontend
```

### 重新构建
```bash
# 重新构建所有服务
docker-compose up -d --build

# 只重新构建后端
docker-compose up -d --build backend
```

### 进入容器
```bash
# 进入后端容器
docker exec -it opencraft-backend sh

# 进入前端容器
docker exec -it opencraft-frontend sh
```

## 💾 数据持久化

数据库文件存储在 `./server/data/cache.db`，通过 Docker volume 挂载到容器中。

### 备份数据库
```bash
# 备份数据库
cp server/data/cache.db server/data/cache.db.backup.$(date +%Y%m%d)
```

### 恢复数据库
```bash
# 停止服务
docker-compose down

# 恢复数据库
cp server/data/cache.db.backup.20240101 server/data/cache.db

# 启动服务
docker-compose up -d
```

### 清空数据库
```bash
# 停止服务
docker-compose down

# 删除数据库
rm server/data/cache.db

# 启动服务（会自动创建新数据库）
docker-compose up -d
```

## 🌐 使用 Traefik 反向代理

如果你使用 Traefik 作为反向代理，docker-compose.yml 已经配置好了相关标签。

### 配置域名

1. 编辑 `.env` 文件：
```bash
FRONTEND_DOMAIN=opencraft.yourdomain.com
BACKEND_DOMAIN=api.opencraft.yourdomain.com
NETWORK_NAME=your-traefik-network
```

2. 确保 Traefik 网络存在：
```bash
docker network create your-traefik-network
```

3. 启动服务：
```bash
docker-compose up -d
```

## 🔧 环境变量说明

### 必需的环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| SILICONFLOW_API_KEY | 硅基流动API密钥 | sk-xxxxxxxxxx |

### AI 配置（可选）

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| SILICONFLOW_API_URL | API地址 | https://api.siliconflow.cn/v1/chat/completions |
| AI_MODEL | 模型名称 | deepseek-ai/DeepSeek-V3 |
| AI_TEMPERATURE | 温度参数(0-2) | 0.7 |
| AI_MAX_TOKENS | 最大Token数 | 200 |

### 服务配置（可选）

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| PORT | 后端端口 | 3000 |
| DB_PATH | 数据库路径 | /app/data/cache.db |
| VITE_API_BASE_URL | 前端API地址 | http://backend:3000 |
| VITE_APP_TITLE | 应用标题 | OpenCraft |

### Traefik 配置（可选）

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| NETWORK_NAME | Traefik网络名 | reverse-proxy-docker-traefik_routing |
| FRONTEND_DOMAIN | 前端域名 | opencraft.bufferhead.com |
| BACKEND_DOMAIN | 后端域名 | api.opencraft.bufferhead.com |

📖 **详细配置说明**：查看 [API 配置指南](API_CONFIG.md)

## 📊 监控和健康检查

### 检查容器状态
```bash
docker-compose ps
```

### 检查容器资源使用
```bash
docker stats opencraft-backend opencraft-frontend
```

### 后端健康检查
```bash
curl http://localhost:3000/elements/base
```

## 🐛 故障排查

### 问题1：后端启动失败
**症状**：容器不断重启
```bash
docker-compose logs backend
```
**可能原因**：
- 未设置 SILICONFLOW_API_KEY
- 端口3000已被占用
- 数据目录权限问题

**解决方案**：
```bash
# 检查环境变量
docker-compose config

# 检查端口占用
netstat -ano | findstr :3000  # Windows
lsof -i :3000                 # Mac/Linux

# 修复数据目录权限
chmod 755 server/data
```

### 问题2：前端无法连接后端
**症状**：合成功能无法使用
**解决方案**：
```bash
# 检查网络连接
docker exec opencraft-frontend ping backend

# 检查后端是否正常
curl http://localhost:3000/elements/base
```

### 问题3：数据丢失
**症状**：重启后数据不见了
**解决方案**：
```bash
# 确保 volume 挂载正确
docker-compose down
docker-compose up -d

# 检查挂载
docker inspect opencraft-backend | grep Mounts -A 10
```

### 问题4：API 调用失败
**症状**：合成时报错
```bash
docker-compose logs backend | grep "硅基流动API"
```
**可能原因**：
- API Key 无效或过期
- API 配额用完
- 网络连接问题

**解决方案**：
```bash
# 检查 API Key
docker exec opencraft-backend env | grep SILICONFLOW_API_KEY

# 手动测试 API
curl -X POST https://api.siliconflow.cn/v1/chat/completions \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-ai/DeepSeek-V3","messages":[{"role":"user","content":"test"}]}'
```

## 🔄 更新应用

```bash
# 拉取最新代码
git pull

# 重新构建并启动
docker-compose up -d --build

# 查看新版本运行情况
docker-compose logs -f
```

## 🛡️ 安全建议

1. **保护 API Key**：
   - 不要将 `.env` 文件提交到 Git
   - 定期轮换 API Key
   - 使用环境变量管理工具（如 Docker Secrets）

2. **数据库备份**：
   - 定期备份 `server/data/cache.db`
   - 使用自动化备份脚本

3. **访问控制**：
   - 如果部署到公网，使用防火墙限制访问
   - 考虑添加身份验证

4. **HTTPS**：
   - 使用 Traefik + Let's Encrypt 自动配置 HTTPS
   - 或者在前面使用 Nginx 反向代理配置 SSL

## 📈 性能优化

### 增加资源限制
在 `docker-compose.yml` 中添加：
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

### 使用生产模式
```bash
# 前端构建优化
cd frontend
npm run build

# 使用 nginx 提供静态文件
# 参考 frontend/Dockerfile 进行多阶段构建
```

## 🎯 最佳实践

1. **始终使用命名容器**：方便管理和日志查看
2. **配置自动重启**：`restart: unless-stopped`
3. **使用 volume 持久化数据**：避免数据丢失
4. **定期备份**：数据库和配置文件
5. **监控日志**：及时发现和解决问题
6. **限制资源**：防止单个容器占用过多资源

---

**需要帮助？** 查看完整文档：[README_CN.md](README_CN.md)

