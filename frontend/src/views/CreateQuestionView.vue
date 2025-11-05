<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/stores/useUserStore'
import { useRouter } from 'vue-router'
import request from '@/utils/request'

const userStore = useUserStore()
const router = useRouter()

// 权限状态
const hasPermission = ref(false)
const isCheckingPermission = ref(true)

// 表单状态
const questionType = ref<'normal' | 'mc'>('normal')
const seedString = ref('')
const title = ref('')
const description = ref('')
const itemName = ref('')

// UI状态
const isSubmitting = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

// 检查出题权限
async function checkPermission() {
  isCheckingPermission.value = true
  try {
    const response = await request.get('/creator/status')
    hasPermission.value = response.data.hasPermission
  } catch (error: any) {
    console.error('检查权限失败:', error)
    hasPermission.value = false
  } finally {
    isCheckingPermission.value = false
  }
}

// 提交题目
async function submitQuestion() {
  errorMessage.value = ''
  successMessage.value = ''
  
  // 验证输入
  if (!seedString.value.trim()) {
    errorMessage.value = '请输入种子字符串'
    return
  }
  
  if (!title.value.trim()) {
    errorMessage.value = '请输入标题'
    return
  }
  
  if (!description.value.trim()) {
    errorMessage.value = '请输入描述'
    return
  }
  
  if (questionType.value === 'mc' && !itemName.value.trim()) {
    errorMessage.value = '请输入物品名称'
    return
  }
  
  isSubmitting.value = true
  
  try {
    let response
    
    if (questionType.value === 'mc') {
      response = await request.post('/creator/submit-mc-question', {
        seedString: seedString.value.trim(),
        itemName: itemName.value.trim(),
        title: title.value.trim(),
        description: description.value.trim()
      })
    } else {
      response = await request.post('/creator/submit-question', {
        seedString: seedString.value.trim(),
        title: title.value.trim(),
        description: description.value.trim()
      })
    }
    
    successMessage.value = response.data.message
    
    // 清空表单
    seedString.value = ''
    title.value = ''
    description.value = ''
    itemName.value = ''
    
    // 3秒后跳转到题目页面
    setTimeout(() => {
      router.push(`/guess/${response.data.question.seedString}`)
    }, 2000)
    
  } catch (error: any) {
    errorMessage.value = error.response?.data?.error || '提交失败'
  } finally {
    isSubmitting.value = false
  }
}

// 切换题目类型时清空表单
function onTypeChange() {
  seedString.value = ''
  title.value = ''
  description.value = ''
  itemName.value = ''
  errorMessage.value = ''
  successMessage.value = ''
}

onMounted(() => {
  checkPermission()
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
    <div class="max-w-4xl mx-auto">
      <!-- 标题栏 -->
      <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-3xl font-bold text-green-600 mb-2">📝 创建题目</h1>
            <p class="text-gray-600">为猜百科游戏创建新题目</p>
          </div>
          <button
            @click="router.push('/guess')"
            class="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
          >
            🏠 返回猜词
          </button>
        </div>
      </div>

      <!-- 检查权限中 -->
      <div v-if="isCheckingPermission" class="bg-white rounded-lg shadow-lg p-8 text-center">
        <div class="text-4xl mb-4">⏳</div>
        <p class="text-gray-600">检查权限中...</p>
      </div>

      <!-- 无权限提示 -->
      <div v-else-if="!hasPermission" class="bg-red-100 border border-red-400 rounded-lg p-8">
        <div class="flex items-start gap-4">
          <span class="text-4xl">🚫</span>
          <div class="flex-1">
            <h2 class="text-2xl font-bold text-red-700 mb-2">没有出题权限</h2>
            <p class="text-red-600 mb-4">
              您当前没有创建题目的权限。如需获取权限，请联系管理员。
            </p>
            <button
              @click="router.push('/guess')"
              class="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
            >
              返回猜词
            </button>
          </div>
        </div>
      </div>

      <!-- 创建题目表单 -->
      <div v-else class="space-y-6">
        <!-- 成功提示 -->
        <div v-if="successMessage" class="bg-green-100 border border-green-400 text-green-700 px-6 py-4 rounded-lg">
          <div class="flex items-center gap-3">
            <span class="text-3xl">✅</span>
            <div>
              <p class="font-bold text-lg">{{ successMessage }}</p>
              <p class="text-sm">即将跳转到题目页面...</p>
            </div>
          </div>
        </div>

        <!-- 错误提示 -->
        <div v-if="errorMessage" class="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg">
          <div class="flex items-center gap-3">
            <span class="text-3xl">❌</span>
            <p>{{ errorMessage }}</p>
          </div>
        </div>

        <!-- 题目类型选择 -->
        <div class="bg-white rounded-lg shadow-lg p-6">
          <h3 class="text-lg font-bold mb-4 text-gray-800">题目类型</h3>
          <div class="flex gap-4">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                v-model="questionType"
                value="normal"
                @change="onTypeChange"
                class="w-4 h-4"
              />
              <span class="text-gray-700">📚 普通题目</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                v-model="questionType"
                value="mc"
                @change="onTypeChange"
                class="w-4 h-4"
              />
              <span class="text-gray-700">⛏️ Minecraft 题目</span>
            </label>
          </div>
        </div>

        <!-- 普通题目表单 -->
        <div v-if="questionType === 'normal'" class="bg-white rounded-lg shadow-lg p-6">
          <h3 class="text-lg font-bold mb-4 text-gray-800">📚 普通题目信息</h3>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                种子字符串 <span class="text-red-500">*</span>
              </label>
              <input
                v-model="seedString"
                type="text"
                placeholder="例如: question-001"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p class="mt-1 text-xs text-gray-500">
                只能包含字母、数字、连字符和下划线，不能以 mc- 开头
              </p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                标题 <span class="text-red-500">*</span>
              </label>
              <input
                v-model="title"
                type="text"
                placeholder="例如: 长城"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p class="mt-1 text-xs text-gray-500">
                玩家需要猜测的主题词，会被遮挡显示
              </p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                描述 <span class="text-red-500">*</span>
              </label>
              <textarea
                v-model="description"
                rows="6"
                placeholder="例如: 长城，又称万里长城，是中国古代的军事防御工事..."
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              ></textarea>
              <p class="mt-1 text-xs text-gray-500">
                关于主题的详细描述，会被遮挡显示
              </p>
            </div>
          </div>
        </div>

        <!-- Minecraft 题目表单 -->
        <div v-if="questionType === 'mc'" class="bg-white rounded-lg shadow-lg p-6">
          <h3 class="text-lg font-bold mb-4 text-gray-800">⛏️ Minecraft 题目信息</h3>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                种子字符串 <span class="text-red-500">*</span>
              </label>
              <input
                v-model="seedString"
                type="text"
                placeholder="例如: mc-diamond"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p class="mt-1 text-xs text-gray-500">
                必须以 mc- 开头，后接字母、数字、连字符或下划线
              </p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                物品名称 <span class="text-red-500">*</span>
              </label>
              <input
                v-model="itemName"
                type="text"
                placeholder="例如: 钻石"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p class="mt-1 text-xs text-gray-500">
                Minecraft 中的物品名称
              </p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                标题 <span class="text-red-500">*</span>
              </label>
              <input
                v-model="title"
                type="text"
                placeholder="例如: 钻石"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p class="mt-1 text-xs text-gray-500">
                通常与物品名称相同，玩家需要猜测的主题词
              </p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                描述 <span class="text-red-500">*</span>
              </label>
              <textarea
                v-model="description"
                rows="6"
                placeholder="例如: 钻石是《Minecraft》中的一种珍贵矿物..."
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              ></textarea>
              <p class="mt-1 text-xs text-gray-500">
                关于该物品的详细描述
              </p>
            </div>
          </div>
        </div>

        <!-- 提交按钮 -->
        <div class="flex justify-end gap-4">
          <button
            @click="router.push('/guess')"
            class="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
          >
            取消
          </button>
          <button
            @click="submitQuestion"
            :disabled="isSubmitting"
            class="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:bg-gray-400"
          >
            {{ isSubmitting ? '提交中...' : '提交题目' }}
          </button>
        </div>

        <!-- 说明 -->
        <div class="bg-blue-50 border border-blue-300 rounded-lg p-6">
          <h3 class="text-lg font-bold mb-3 text-blue-800">📖 出题说明</h3>
          <ul class="space-y-2 text-sm text-blue-700">
            <li>• <strong>种子字符串</strong>：题目的唯一标识符，建议使用有意义的命名</li>
            <li>• <strong>普通题目</strong>：可以是任何百科知识、名词、事物等</li>
            <li>• <strong>Minecraft 题目</strong>：专门用于 Minecraft 游戏相关的物品、方块、生物等</li>
            <li>• <strong>标题</strong>：玩家需要猜测的核心词汇，所有汉字会被遮挡</li>
            <li>• <strong>描述</strong>：提供关于标题的详细信息，帮助玩家猜测，所有汉字会被遮挡</li>
            <li>• 题目创建后，玩家通过猜测汉字来逐步揭开标题和描述</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
textarea {
  resize: vertical;
  min-height: 120px;
}
</style>

