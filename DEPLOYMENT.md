# OpenCraft 部署指南

本文档介绍 OpenCraft 的两种部署模式：API 模式和本地模型模式。

## 目录

- [快速开始（API 模式）](#快速开始api-模式)
- [本地模型部署](#本地模型部署)
- [GPU 加速配置](#gpu-加速配置)
- [持久化说明](#持久化说明)
- [环境变量说明](#环境变量说明)

---

## 快速开始（API 模式）

API 模式使用外部 AI API（如硅基流动），无需下载大型模型文件，响应速度快。

### 1. 配置环境变量

```bash
# 复制环境变量示例文件
cp env.example .env

# 编辑 .env 文件，设置以下必需参数
# SILICONFLOW_API_KEY=your_api_key_here  # 在 https://cloud.siliconflow.cn/ 获取
# AI_MODE=api
# DOCKERFILE=Dockerfile
```

### 2. 启动服务

```bash
docker-compose up -d
```

### 3. 访问应用

- 前端：http://localhost:5173
- 后端：http://localhost:3000

---

## 本地模型部署

本地模型模式完全离线运行，无需外部 API，支持 GPU 加速。

### 1. 准备模型文件

```bash
# 创建模型目录
mkdir -p server/models

# 下载模型文件（推荐使用 HuggingFace 镜像）
# 方式 1: 使用 git-lfs（需先安装 git-lfs）
cd server/models
git lfs install
git clone https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.1-GGUF
mv Mistral-7B-Instruct-v0.1-GGUF/mistral-7b-instruct-v0.1.Q8_0.gguf ./model.gguf

# 方式 2: 手动下载
# 访问 https://hf-mirror.com/TheBloke/Mistral-7B-Instruct-v0.1-GGUF
# 下载 mistral-7b-instruct-v0.1.Q8_0.gguf 文件，重命名为 model.gguf
# 放置到 server/models/ 目录
```

### 2. 配置环境变量

```bash
# 编辑 .env 文件
AI_MODE=local
DOCKERFILE=Dockerfile.local
LOCAL_MODEL_DIR=./server/models
LOCAL_MODEL_PATH=/app/models/model.gguf
HF_ENDPOINT=https://hf-mirror.com
```

### 3. 启动服务（CPU 模式）

```bash
docker-compose up -d
```

---

## GPU 加速配置

使用本地模型时，可以启用 GPU 加速显著提升推理速度。

### 前提条件

1. 安装 NVIDIA Docker Runtime

```bash
# Ubuntu/Debian
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
  sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt-get update
sudo apt-get install -y nvidia-docker2
sudo systemctl restart docker
```

2. 验证 GPU 可用性

```bash
docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi
```

### 启用 GPU 支持

1. 配置环境变量

```bash
# 编辑 .env 文件
AI_MODE=local
DOCKERFILE=Dockerfile.local
LOCAL_MODEL_DIR=./server/models
LOCAL_MODEL_PATH=/app/models/model.gguf
```

2. 使用 GPU 配置启动

```bash
docker-compose -f docker-compose.yml -f docker-compose.gpu.yml up -d
```

---

## 持久化说明

OpenCraft 通过 Docker volumes 实现数据持久化，确保数据不会因容器重启而丢失。

### 后端持久化

1. **数据库持久化**
   - 宿主机目录：`./server/data/`
   - 容器内路径：`/app/data/`
   - 存储内容：用户数据、元素数据、合成记录、发现记录

2. **模型文件持久化**（仅本地模型模式）
   - 宿主机目录：`./server/models/`（可通过 `LOCAL_MODEL_DIR` 配置）
   - 容器内路径：`/app/models/`
   - 存储内容：AI 模型文件（.gguf 格式）

### 前端持久化

1. **浏览器 LocalStorage**
   - 用户 token（自动登录）
   - 已发现元素列表
   - 合成工作区内容

### 数据备份

```bash
# 备份数据库
cp server/data/cache.db server/data/cache.db.backup

# 备份模型文件（如果使用本地模型）
tar -czf models-backup.tar.gz server/models/
```

---

## 环境变量说明

### Docker 配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `DOCKERFILE` | Dockerfile 选择 | `Dockerfile` |
| `LOCAL_MODEL_DIR` | 本地模型目录（宿主机） | `./server/models` |

### AI 模式配置

| 变量名 | 说明 | 可选值 | 默认值 |
|--------|------|--------|--------|
| `AI_MODE` | AI 运行模式 | `api` / `local` | `api` |

### API 模式配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `SILICONFLOW_API_KEY` | 硅基流动 API Key | - |
| `SILICONFLOW_API_URL` | API 地址 | `https://api.siliconflow.cn/v1/chat/completions` |
| `AI_MODEL` | 模型名称 | `deepseek-ai/DeepSeek-V3.2-Exp` |

### 本地模型配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `LOCAL_MODEL_PATH` | 模型文件路径（容器内） | `/app/models/model.gguf` |
| `HF_ENDPOINT` | HuggingFace 镜像源 | `https://hf-mirror.com` |

### 通用 AI 配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `AI_TEMPERATURE` | AI 温度参数（0.0-2.0） | `0.7` |
| `AI_MAX_TOKENS` | 最大生成 Token 数 | `200` |

### 前端配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `VITE_API_BASE_URL` | 后端 API 地址 | `http://backend:3000` |
| `VITE_APP_TITLE` | 应用标题 | `OpenCraft` |

---

## 常见问题

### Q1: 如何切换 API 模式和本地模型模式？

修改 `.env` 文件中的 `AI_MODE` 和 `DOCKERFILE`：

**切换到 API 模式：**
```bash
AI_MODE=api
DOCKERFILE=Dockerfile
```

**切换到本地模型模式：**
```bash
AI_MODE=local
DOCKERFILE=Dockerfile.local
```

修改后重新构建并启动：
```bash
docker-compose down
docker-compose up -d --build
```

### Q2: 本地模型推理很慢怎么办？

1. 使用 GPU 加速（参考 [GPU 加速配置](#gpu-加速配置)）
2. 选择较小的量化模型（如 Q4_0 而非 Q8_0）
3. 增加服务器内存和 CPU 资源

### Q3: GPU 模式下内存不足

1. 选择较小的模型文件
2. 减少 `AI_MAX_TOKENS` 值
3. 限制 GPU 使用数量（修改 `docker-compose.gpu.yml` 中的 `count` 参数）

### Q4: 如何查看日志？

```bash
# 查看所有日志
docker-compose logs -f

# 查看后端日志
docker-compose logs -f backend

# 查看前端日志
docker-compose logs -f frontend
```

### Q5: 如何更新模型文件？

直接替换 `server/models/` 目录下的模型文件，然后重启容器：

```bash
# 停止服务
docker-compose down

# 替换模型文件
cp /path/to/new-model.gguf server/models/model.gguf

# 启动服务
docker-compose up -d
```

---

## 生产环境部署建议

1. **使用反向代理**（如 Nginx、Traefik）
2. **启用 HTTPS**
3. **配置防火墙规则**
4. **定期备份数据库**
5. **监控资源使用情况**
6. **使用环境变量管理敏感信息**（不要提交 `.env` 文件到版本控制）

---

## 技术支持

如有问题，请访问项目 GitHub 仓库提交 Issue。

