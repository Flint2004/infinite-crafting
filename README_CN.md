# OpenCraft - 中文版

OpenCraft 是一个开源的元素合成游戏，灵感来自 InfiniteCraft。通过拖拽和组合不同的元素，使用AI创造出无限可能的新元素！

## 🎮 游戏特色

### 中文五行元素
- ⚙️ **金** (Metal)
- 🌲 **木** (Wood)
- 💧 **水** (Water)
- 🔥 **火** (Fire)
- 🌍 **土** (Earth)

### 核心功能
- ✅ **用户系统**：注册登录，每个玩家拥有独立的token
- ✅ **首次发现记录**：第一个合成新元素的玩家将被永久记录
- ✅ **中文AI合成**：使用本地LLM模型，支持中文提示词
- ✅ **双语元素**：每个元素包含中文名和英文翻译
- ✅ **智能缓存**：合成结果自动缓存，避免重复计算
- ✅ **持久化存储**：游戏进度自动保存

## 🚀 快速开始

### 方式一：Docker 部署（推荐）

**最简单的部署方式，无需安装 Node.js！**

1. 获取硅基流动 API Key
   - 访问：https://cloud.siliconflow.cn/
   - 免费注册并获取 API Key

2. 配置环境变量
   ```bash
   cp env.example .env
   # 编辑 .env 文件，填入你的 SILICONFLOW_API_KEY
   ```

3. 启动服务
   ```bash
   docker-compose up -d
   ```

4. 访问应用
   - 前端：http://localhost:5173
   - 后端：http://localhost:3000

📖 详细的 Docker 部署指南：[DOCKER_DEPLOY.md](DOCKER_DEPLOY.md)

### 方式二：本地开发部署

#### 环境要求
- Node.js 18+
- npm 或 yarn
- 硅基流动 API Key

#### 后端设置

1. 配置环境变量：
   ```bash
   cd server
   cp env.example .env
   # 编辑 .env 文件，填入你的 SILICONFLOW_API_KEY
   ```

2. 安装依赖并启动：
   ```bash
   npm install
   npm start
   ```
   后端将在 `http://localhost:3000` 运行

#### 前端设置

```bash
cd frontend
npm install
npm run dev
```
前端将在 `http://localhost:5173` 运行

## 📖 使用说明

### 1. 注册/登录
- 首次使用选择"注册"，输入用户名
- 系统会自动生成一个token，**请妥善保存！**
- 之后可使用token登录

### 2. 开始游戏
- 从右侧元素列表拖拽元素到工作区
- 将两个元素拖到一起进行合成
- AI会生成一个与两个元素相关的新元素

### 3. 发现新元素
- 合成出新元素后，会自动添加到你的元素列表
- 如果你是第一个发现该元素的玩家，你的名字将被永久记录
- 元素卡片上会显示发现者信息

### 4. 搜索功能
- 在元素列表中搜索中文名或英文名
- 快速找到想要的元素

## 🗄️ 数据库结构

### 用户表 (users)
```sql
- id: 用户ID
- username: 用户名
- token: 认证token
- created_at: 创建时间
```

### 元素表 (elements)
```sql
- id: 元素唯一ID
- name_cn: 中文名称
- name_en: 英文名称
- emoji: 表情符号
- discoverer_id: 发现者ID
- discoverer_name: 发现者名称
- discovered_at: 发现时间
```

### 合成缓存表 (craft_cache)
```sql
- id: 记录ID
- first_element_id: 第一个元素ID
- second_element_id: 第二个元素ID
- result_element_id: 结果元素ID
- created_at: 创建时间
```

## 🔧 API接口

### 用户认证
- `POST /register` - 注册新用户
- `POST /login` - 使用token登录

### 元素管理
- `GET /elements/base` - 获取基础元素列表
- `GET /elements/discovered` - 获取用户发现的所有元素（需要认证）

### 游戏功能
- `POST /craft` - 合成新元素（需要认证）
  ```json
  {
    "firstElementId": "base_metal",
    "secondElementId": "base_fire"
  }
  ```

## 🎨 技术栈

### 后端
- **框架**: Fastify
- **数据库**: SQLite3
- **AI模型**: 硅基流动 API（DeepSeek-V3）
- **认证**: Token-based
- **容器化**: Docker

### 前端
- **框架**: Vue 3 + TypeScript
- **状态管理**: Pinia
- **拖拽**: vue3-dnd
- **样式**: TailwindCSS
- **HTTP**: Axios
- **容器化**: Docker

## 🌟 游戏机制详解

### 元素唯一性
- 元素基于 **中文名 + 英文名** 判断唯一性
- 同一个中文名但英文不同视为不同元素
- 每个元素拥有唯一ID

### 合成规则
- 任意两个元素可以合成
- 合成结果由AI生成，确保与两个元素都相关
- 结果不能包含原始元素的名称
- 自动生成对应的emoji

### 发现者系统
- 每个新元素只记录第一个发现者
- 后续玩家合成相同元素不会改变发现者
- 发现者信息显示在元素卡片上

### 缓存机制
- 合成结果永久缓存
- A+B 和 B+A 视为相同合成
- 避免重复AI计算，提升响应速度

## 📝 开发说明

### 添加新的基础元素
编辑 `server/index.js` 中的 `baseElements` 数组：
```javascript
const baseElements = [
    { id: 'base_xxx', name_cn: '元素名', name_en: 'Element', emoji: '🌟' }
]
```

### 修改AI提示词
在 `server/index.js` 中找到 `generateElement` 函数，修改 `systemPrompt` 变量。

### 自定义前端样式
前端使用 TailwindCSS，可在各组件中直接修改样式类。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

提交PR前请确保：
1. 代码通过 linter 检查
2. 已测试核心功能
3. 更新相关文档

## 📄 许可证

本项目基于原始 OpenCraft 项目，遵循相同的开源协议。

## 🙏 致谢

- 原始项目：[OpenCraft](https://github.com/bufferhead-code/opencraft)
- AI 服务商：[硅基流动](https://cloud.siliconflow.cn/)
- AI 模型：[DeepSeek-V3](https://www.deepseek.com/)

---

**祝你玩得开心！探索无限可能的元素组合吧！** 🎮✨

## 📚 相关文档

- [快速启动指南](QUICKSTART_CN.md)
- [Docker 部署指南](DOCKER_DEPLOY.md)
- [API 配置指南](API_CONFIG.md) 🆕
- [V2.0 更新日志](CHANGELOG_V2.md)
- [V1.0 更新日志](CHANGELOG_CN.md)

