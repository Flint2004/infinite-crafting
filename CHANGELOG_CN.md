# 更新日志 - 中文版改造

## 版本 2.0.0 - 中文五行版本

### 🎉 重大更新

#### 后端改造

1. **数据库结构重构**
   - ✅ 新增 `users` 表：用户认证系统
   - ✅ 重构 `elements` 表：支持中英双语、记录发现者
   - ✅ 重构 `craft_cache` 表：使用元素ID替代文本
   - ✅ 初始化五行基础元素：金、木、水、火、土

2. **用户认证系统**
   - ✅ POST `/register` - 用户注册
   - ✅ POST `/login` - Token登录
   - ✅ 中间件：Bearer Token认证
   - ✅ 自动生成64位安全Token

3. **元素管理API**
   - ✅ GET `/elements/base` - 获取基础元素
   - ✅ GET `/elements/discovered` - 获取用户发现的元素
   - ✅ POST `/craft` - 合成元素（需认证）

4. **AI合成逻辑升级**
   - ✅ 中文提示词：完整中文对话
   - ✅ 双语输出：生成中文名和英文翻译
   - ✅ 发现者记录：首次合成记录玩家信息
   - ✅ 元素去重：基于中文名+英文名判断唯一性
   - ✅ 改进的验证逻辑：避免结果包含原词

#### 前端改造

5. **状态管理重构**
   - ✅ `useUserStore` - 新增用户状态管理
   - ✅ `useResourcesStore` - 支持新的元素数据结构
   - ✅ `useBoxesStore` - 工作区元素支持完整信息

6. **数据结构更新**
   ```typescript
   // 旧结构
   { title: string, emoji: string }
   
   // 新结构
   { 
     id: string,
     word_cn: string,
     word_en: string,
     emoji: string,
     discoverer_name?: string
   }
   ```

7. **登录注册界面**
   - ✅ `/login` - 新增登录页面
   - ✅ 注册功能：输入用户名自动生成token
   - ✅ 登录功能：使用token认证
   - ✅ 路由守卫：未登录自动跳转

8. **UI组件升级**
   - ✅ `App.vue` - 显示用户名、退出按钮
   - ✅ `ItemCard.vue` - 显示发现者信息
   - ✅ `Container.vue` - 支持新数据结构
   - ✅ `Resource.vue` - 双语支持
   - ✅ `AvailableResources.vue` - 中英文搜索

9. **API集成**
   - ✅ 所有请求携带Authorization header
   - ✅ 合成接口使用新的数据格式
   - ✅ 错误处理和提示
   - ✅ 首次发现特殊提示

### 📋 接口变更对照

#### 旧接口
```javascript
// 获取预定义组合
GET /

// 合成元素
POST /
{
  "first": "Water",
  "second": "Fire"
}

// 响应
{
  "result": "Steam",
  "emoji": "💨"
}
```

#### 新接口
```javascript
// 注册
POST /register
{
  "username": "玩家名"
}

// 登录
POST /login
{
  "token": "xxx"
}

// 获取基础元素
GET /elements/base

// 合成元素
POST /craft
Headers: { Authorization: "Bearer xxx" }
{
  "firstElementId": "base_metal",
  "secondElementId": "base_fire"
}

// 响应
{
  "success": true,
  "element": {
    "id": "xxx",
    "word_cn": "钢铁",
    "word_en": "Steel",
    "emoji": "🔩",
    "discoverer_name": "玩家名"
  },
  "isNew": true
}
```

### 🗂️ 文件变更清单

#### 后端文件
- ✏️ `server/index.js` - 完全重写

#### 前端文件（修改）
- ✏️ `frontend/src/stores/useResourcesStore.ts`
- ✏️ `frontend/src/stores/useBoxesStore.ts`
- ✏️ `frontend/src/components/interfaces.ts`
- ✏️ `frontend/src/components/ItemCard.vue`
- ✏️ `frontend/src/components/Resource.vue`
- ✏️ `frontend/src/components/AvailableResources.vue`
- ✏️ `frontend/src/components/Container.vue`
- ✏️ `frontend/src/router/index.ts`
- ✏️ `frontend/src/App.vue`

#### 前端文件（新增）
- ➕ `frontend/src/stores/useUserStore.ts`
- ➕ `frontend/src/views/LoginView.vue`

#### 文档
- ➕ `README_CN.md` - 中文使用说明
- ➕ `CHANGELOG_CN.md` - 本文件

### 🔄 数据迁移

**注意：** 本次更新不兼容旧版本数据！

如果你有旧版本的 `server/cache.db`，需要：
1. 备份旧数据库
2. 删除 `server/cache.db`
3. 重启后端，系统会自动创建新数据库

### 🎮 游戏玩法变化

#### 之前
- 直接开始游戏
- 4个基础元素：Fire, Water, Earth, Air
- 无用户系统
- 无发现者记录

#### 现在
- 需要注册/登录
- 5个基础元素：金、木、水、火、土
- 每个玩家独立账号
- 首次发现记录玩家名

### 🐛 已知问题

- AI模型仍使用英文模型，但通过提示词工程支持中文
- 建议将来使用中文优化的LLM模型以获得更好的中文生成效果

### 📈 性能优化

- 使用元素ID替代文本查询，提升数据库性能
- 保持原有的缓存机制
- 添加数据库索引（外键约束）

### 🔐 安全性

- Token采用64位随机字符串
- 所有用户操作需要认证
- 防止未授权访问

### 🌐 国际化准备

- 数据结构支持多语言
- 前端可扩展为多语言切换
- 后端API响应包含双语信息

---

## 升级指南

### 从旧版本升级

1. **备份数据**
   ```bash
   cp server/cache.db server/cache.db.backup
   ```

2. **更新代码**
   ```bash
   git pull
   ```

3. **安装依赖**
   ```bash
   cd server && npm install
   cd ../frontend && npm install
   ```

4. **清理数据库**（如果需要）
   ```bash
   rm server/cache.db
   ```

5. **启动服务**
   ```bash
   # 启动后端
   cd server && npm start
   
   # 启动前端
   cd frontend && npm run dev
   ```

6. **注册账号**
   - 访问 http://localhost:5173
   - 会自动跳转到登录页
   - 点击"注册"创建账号
   - 保存生成的token

### 测试清单

- [ ] 用户注册成功
- [ ] Token登录成功
- [ ] 基础元素正确显示（5个五行元素）
- [ ] 拖拽元素到工作区
- [ ] 合成两个元素生成新元素
- [ ] 新元素显示发现者信息
- [ ] 新元素添加到资源列表
- [ ] 搜索功能正常
- [ ] 退出登录功能正常

---

**更新完成！享受全新的中文版OpenCraft！** 🎉

