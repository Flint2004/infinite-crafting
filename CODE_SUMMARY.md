我来为你生成一个精简的项目概览文档，方便其他 AI 助手快速理解项目结构：

[4 tools called]

基于项目结构，我为你生成一个精简的项目概览文档：

---

# 🎮 OpenCraft - 项目快速参考手册

## 📋 项目概述

**类型**: 无限元素合成游戏（类似 Infinite Craft）  
**技术栈**: Vue 3 + Node.js + SQLite + AI (本地/API)  
**部署**: Docker / 本地开发  
**AI 模式**: 支持本地 LLM (node-llama-cpp) 或外部 API (SiliconFlow DeepSeek-V3)

---

## 📁 项目结构

```
opencraft/
├── server/              # 后端服务 (Node.js + Express)
│   ├── index.js        # ★ 核心业务逻辑
│   ├── cache.db        # SQLite 数据库
│   ├── package.json    # 依赖: express, better-sqlite3, node-llama-cpp(可选), axios
│   ├── Dockerfile      # API 模式容器
│   ├── Dockerfile.local# 本地模型模式容器 (支持 GPU)
│   └── data/           # 数据持久化目录
│
├── frontend/           # 前端应用 (Vue 3 + TypeScript)
│   ├── src/
│   │   ├── components/ # ★ 核心 UI 组件
│   │   │   ├── Container.vue      # 主布局容器
│   │   │   ├── Box.vue            # 合成区元素包装器
│   │   │   ├── ItemCard.vue       # ★★ 元素卡片（显示/交互）
│   │   │   ├── Resource.vue       # ★★ 资源区元素（拖拽/长按）
│   │   │   ├── AvailableResources.vue # 可用元素列表容器
│   │   │   ├── Example.vue        # DndProvider 配置
│   │   │   ├── CustomDragLayer.vue# 自定义拖拽层（移动端）
│   │   │   ├── interfaces.ts      # 类型定义
│   │   │   └── ItemTypes.ts       # 拖拽类型常量
│   │   │
│   │   ├── stores/     # ★ Pinia 状态管理
│   │   │   ├── useUserStore.ts    # 用户认证 (localStorage)
│   │   │   ├── useResourcesStore.ts # 已发现元素 (localStorage)
│   │   │   └── useBoxesStore.ts   # 合成区元素 (localStorage)
│   │   │
│   │   ├── views/      # 页面组件
│   │   │   ├── HomeView.vue       # 主游戏界面
│   │   │   ├── LoginView.vue      # ★ 登录/注册（token 提示）
│   │   │   └── AboutView.vue      # 关于页面
│   │   │
│   │   ├── router/     # Vue Router 配置
│   │   ├── App.vue     # ★ 根组件（用户菜单/清理弹窗）
│   │   └── main.ts     # 应用入口
│   │
│   └── package.json    # 依赖: vue, pinia, vue3-dnd, react-dnd-touch-backend
│
├── docker-compose.yml  # 标准部署配置
├── docker-compose.gpu.yml # GPU 加速配置
└── env.example         # 环境变量模板
```

---

## 🎯 核心功能模块

### 1. **用户认证系统** 🔐
- **位置**: `frontend/src/stores/useUserStore.ts`
- **功能**: Token 认证、localStorage 持久化
- **关键点**: 6位字符 token、刷新不丢失

### 2. **元素合成引擎** ⚗️
- **位置**: `server/index.js` → `craftNewElement()`
- **功能**: 接收两个元素 → AI 生成新元素
- **AI 模式**:
  - `AI_MODE=local`: node-llama-cpp 本地模型
  - `AI_MODE=api`: SiliconFlow DeepSeek-V3 API

### 3. **拖拽交互系统** 🖱️
- **核心组件**:
  - `Box.vue`: 合成区元素（可拖拽、双击复制）
  - `Resource.vue`: 资源区元素（长按查看详情、拖拽到合成区）
  - `CustomDragLayer.vue`: 移动端拖拽预览层
- **交互逻辑**:
  - **桌面端**: HTML5Backend
  - **移动端**: TouchBackend (delayTouchStart=0, touchSlop=5)
  - **长按检测**: 1秒无移动 → 显示详情（防止拖拽中重新计时）
  - **双击合成区**: 复制元素（偏移位置）
  - **拖回资源区**: 移除元素

### 4. **状态持久化** 💾
- **位置**: `frontend/src/stores/*.ts`
- **存储方案**:
  - `userStore`: localStorage `'opencraft_user'`
  - `resourcesStore`: localStorage `'opencraft_resources'`
  - `boxesStore`: localStorage `'opencraft_boxes'`
- **清理策略**: 
  - `App.vue` → 清理弹窗（4个选项：仅退出/清工作区/清元素区/清所有）

### 5. **数据库设计** 🗄️
- **位置**: `server/index.js` → `initializeDatabase()`
- **表结构**:
  ```sql
  users: id, username, token, created_at
  elements: id, word_cn, word_en, emoji, discoverer_name, created_at
  first_discoveries: element_id, recipe_a, recipe_b, discoverer_name, created_at
  ```

### 6. **响应式布局** 📱
- **位置**: `frontend/src/components/Container.vue`
- **布局策略**:
  - **移动端**: `flex-col-reverse` (元素列表固定底部 35vh)
  - **桌面端**: `flex-row` (右侧固定元素列表)
- **滚动控制**: 仅元素列表可滚动，合成区固定

---

## 🔧 关键修改点速查

### ✅ 添加新元素属性
- **后端**: `server/index.js` → `craftNewElement()` 生成逻辑
- **数据库**: `initializeDatabase()` 表结构
- **前端类型**: `frontend/src/components/interfaces.ts`
- **UI 显示**: `ItemCard.vue`

### ✅ 修改 AI 生成逻辑
- **位置**: `server/index.js`
  - `generateElementLocal()`: 本地模型
  - `generateElementAPI()`: 外部 API
  - `systemPrompt` / `userPrompt`: AI 提示词

### ✅ 调整拖拽行为
- **位置**: 
  - `frontend/src/components/Example.vue`: 后端配置
  - `Box.vue` / `Resource.vue`: 拖拽逻辑
  - `CustomDragLayer.vue`: 移动端预览

### ✅ 修改布局样式
- **位置**: `frontend/src/components/Container.vue`
- **关键 CSS**: TailwindCSS 响应式类 (`md:`, `h-[35vh]`, `flex-col-reverse`)

### ✅ 增加用户交互
- **位置**: 
  - `ItemCard.vue`: 双击/长按逻辑
  - `Resource.vue`: 长按详情（防拖拽重计时）
  - `App.vue`: 用户菜单/清理弹窗

---

## 🚀 快速定位常见需求

| 需求 | 文件位置 | 关键函数/变量 |
|------|---------|--------------|
| **修改 AI 提示词** | `server/index.js` | `systemPrompt`, `userPrompt` |
| **改变元素卡片样式** | `frontend/src/components/ItemCard.vue` | template 部分 |
| **调整长按时间** | `Resource.vue` | `setTimeout(..., 1000)` |
| **修改 token 长度** | `server/index.js` | `generateToken()` |
| **添加新数据表** | `server/index.js` | `initializeDatabase()` |
| **修改移动端布局** | `Container.vue` | `h-[35vh]`, `flex-col-reverse` |
| **配置环境变量** | `env.example` | 所有 ENV 变量 |
| **修改持久化逻辑** | `frontend/src/stores/*.ts` | `watch()`, `localStorage` |

---

## ⚙️ 环境配置关键变量

```bash
# AI 配置
AI_MODE=local|api           # ★ 模式切换
LOCAL_MODEL_PATH=./models/  # 本地模型路径
SILICONFLOW_API_KEY=sk-xxx  # API 密钥
AI_MODEL=deepseek-v3        # 模型名称

# 数据库
DB_PATH=./data/cache.db     # 数据库文件路径

# 前端
VITE_API_BASE_URL=/api      # API 基础路径
```

---

## 🎨 核心交互流程

```
用户拖拽元素 A → 合成区
  ↓
用户拖拽元素 B → 合成区 (重叠)
  ↓
前端: Box.vue → drop() → craftNewElement()
  ↓
后端: /craft → AI 生成 → 返回新元素
  ↓
前端: resourcesStore.addResource() → 更新 UI
  ↓
localStorage 自动保存
```

---

## 📝 重要注意事项

1. ⚠️ **移动端拖拽**: 必须使用 `TouchBackend` + `CustomDragLayer`
2. ⚠️ **长按与拖拽**: 用 `isDraggingStarted` 标志防止冲突
3. ⚠️ **GPU 支持**: 使用 `docker-compose.gpu.yml` 启动
4. ⚠️ **Token 持久化**: 手动 `localStorage` + `watch`，不用 `useLocalStorage`
5. ⚠️ **双击逻辑**: 根据 `size` 属性区分合成区/资源区

---

**快速搜索关键词**: 拖拽 (`useDrag`)、合成 (`craftNewElement`)、AI (`generateElement`)、持久化 (`localStorage`)、长按 (`longPressTimer`)