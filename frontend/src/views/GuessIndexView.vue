<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/stores/useUserStore'
import { useRouter } from 'vue-router'
import request from '@/utils/request'

const userStore = useUserStore()
const router = useRouter()

// 状态
const seedString = ref('')
const errorMessage = ref('')
const isLoading = ref(false)
const history = ref<Array<any>>([])
const showHistory = ref(false)
const allSeeds = ref<Array<any>>([])
const showAllSeeds = ref(false)
const hasCreatorPermission = ref(false)

// 获取今日日期字符串
function getTodayString(): string {
  const today = new Date()
  return today.getFullYear() + '-' + 
         String(today.getMonth() + 1).padStart(2, '0') + '-' + 
         String(today.getDate()).padStart(2, '0')
}

// 进入题目
function enterQuestion() {
  if (!seedString.value.trim()) {
    errorMessage.value = '请输入关键词或日期'
    return
  }
  
  router.push(`/guess/${encodeURIComponent(seedString.value)}`)
}

// 进入今日题目
function enterTodayQuestion() {
  router.push(`/guess/${getTodayString()}`)
}

// 加载历史记录
async function loadHistory() {
  isLoading.value = true
  try {
    const response = await request.get('/guess/history')
    history.value = response.data.history
    showHistory.value = true
  } catch (error: any) {
    errorMessage.value = error.response?.data?.error || '加载历史失败'
  } finally {
    isLoading.value = false
  }
}

// 加载所有题目种子
async function loadAllSeeds() {
  isLoading.value = true
  try {
    const response = await request.get('/guess/seeds')
    allSeeds.value = response.data.seeds
    showAllSeeds.value = true
  } catch (error: any) {
    errorMessage.value = error.response?.data?.error || '加载题目列表失败'
  } finally {
    isLoading.value = false
  }
}

// 处理回车键
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    enterQuestion()
  }
}

// 检查出题权限
async function checkCreatorPermission() {
  try {
    const response = await request.get('/creator/status')
    hasCreatorPermission.value = response.data.hasPermission
  } catch (error) {
    hasCreatorPermission.value = false
  }
}

onMounted(() => {
  console.log('GuessIndexView mounted, user:', userStore.user)
  checkCreatorPermission()
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4">
    <div class="max-w-4xl mx-auto">
      <!-- 标题栏 -->
      <div class="bg-white rounded-lg shadow-lg p-8 mb-6">
        <div class="text-center mb-6">
          <h1 class="text-4xl font-bold text-purple-600 mb-3">🎯 猜百科游戏</h1>
          <p class="text-gray-600 text-lg">根据提示猜出百科词条的标题</p>
        </div>
        
        <div class="flex flex-wrap justify-center gap-3 mb-6">
          <button
            @click="loadHistory"
            :disabled="isLoading"
            class="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50"
          >
            📜 我的历史
          </button>
          <button
            @click="loadAllSeeds"
            :disabled="isLoading"
            class="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition disabled:opacity-50"
          >
            📚 所有题目
          </button>
          <button
            v-if="hasCreatorPermission"
            @click="router.push('/create-question')"
            class="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
          >
            📝 创建题目
          </button>
          <button
            @click="router.push('/')"
            class="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
          >
            🏠 返回主页
          </button>
        </div>
      </div>

      <!-- 错误提示 -->
      <div v-if="errorMessage" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
        {{ errorMessage }}
      </div>

      <!-- 今日题目 -->
      <div class="bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg shadow-lg p-8 mb-6 text-white">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
          <div>
            <h2 class="text-2xl font-bold mb-2">📅 今日题目</h2>
            <p class="text-purple-100">每天都有新的挑战等着你！</p>
          </div>
          <button
            @click="enterTodayQuestion"
            class="px-8 py-4 bg-white text-purple-600 rounded-lg hover:bg-purple-50 transition font-bold text-lg shadow-md"
          >
            开始挑战 →
          </button>
        </div>
      </div>

      <!-- 输入关键词 -->
      <div class="bg-white rounded-lg shadow-lg p-8 mb-6">
        <h2 class="text-2xl font-bold mb-4 text-gray-800">🔍 输入关键词或日期</h2>
        <div class="flex flex-col sm:flex-row gap-4 mb-4">
          <input
            v-model="seedString"
            @keydown="handleKeydown"
            type="text"
            placeholder="例如：2025-10-26 或自定义关键词"
            class="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-lg"
          />
          <button
            @click="enterQuestion"
            :disabled="!seedString.trim()"
            class="px-8 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
          >
            进入题目
          </button>
        </div>
        
        <div class="space-y-3 text-sm">
          <div class="flex items-start gap-2 text-blue-600">
            <span>📅</span>
            <div>
              <strong>每日题目：</strong>输入日期格式（YYYY-MM-DD）可自动生成题目，如：{{ getTodayString() }}
            </div>
          </div>
          <div class="flex items-start gap-2 text-green-600">
            <span>⛏️</span>
            <div>
              <strong>Minecraft 题目：</strong>输入 mc- 开头的关键词（如 mc-1），由管理员从 Minecraft Wiki 生成
            </div>
          </div>
          <div class="flex items-start gap-2 text-gray-600">
            <span>🎯</span>
            <div>
              <strong>关键词题目：</strong>其他关键词需要管理员预先生成
            </div>
          </div>
          <div class="flex items-start gap-2 text-gray-600">
            <span>💡</span>
            <div>
              <strong>提示：</strong>相同的字符串会生成相同的题目，你可以和朋友挑战同一道题！
            </div>
          </div>
        </div>
      </div>

      <!-- 游戏规则 -->
      <div class="bg-white rounded-lg shadow-lg p-8">
        <h2 class="text-2xl font-bold mb-4 text-gray-800">📖 游戏规则</h2>
        <div class="space-y-4 text-gray-700">
          <div class="flex gap-3">
            <span class="text-2xl">1️⃣</span>
            <div>
              <strong class="text-gray-900">查看提示：</strong>
              <p>系统会显示一个百科词条的标题和描述，但所有汉字都被遮挡为 ■</p>
            </div>
          </div>
          <div class="flex gap-3">
            <span class="text-2xl">2️⃣</span>
            <div>
              <strong class="text-gray-900">猜测汉字：</strong>
              <p>每次猜测一个汉字，系统会告诉你这个字是否在标题或描述中</p>
            </div>
          </div>
          <div class="flex gap-3">
            <span class="text-2xl">3️⃣</span>
            <div>
              <strong class="text-gray-900">揭示位置：</strong>
              <p>猜对的字会在对应位置显示出来，帮助你推理出完整答案</p>
            </div>
          </div>
          <div class="flex gap-3">
            <span class="text-2xl">4️⃣</span>
            <div>
              <strong class="text-gray-900">完成挑战：</strong>
              <p>猜出标题中的所有汉字即可完成，用最少的次数挑战排行榜！</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 历史记录弹窗 -->
    <div
      v-if="showHistory"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 sm:pt-20 pt-32 z-50"
      @click.self="showHistory = false"
    >
      <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] sm:max-h-[60vh] flex flex-col">
        <div class="sticky top-0 bg-white border-b p-4 flex justify-between items-center flex-shrink-0">
          <h2 class="text-xl font-bold text-gray-800">📜 游戏历史</h2>
          <button
            @click="showHistory = false"
            class="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>
        <div class="p-4 space-y-3 overflow-y-auto">
          <div
            v-for="item in history"
            :key="item.id"
            class="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition"
            @click="() => { showHistory = false; router.push(`/guess/${item.seed_string}`); }"
          >
            <div class="flex justify-between items-start">
              <div>
                <div class="font-bold text-lg text-gray-900">{{ item.title || '未完成的题目' }}</div>
                <div class="text-sm text-gray-600 mt-1">关键词：{{ item.seed_string }}</div>
              </div>
              <div class="text-right">
                <div v-if="item.guess_count" class="text-green-600 font-bold">
                  ✅ {{ item.guess_count }} 次完成
                </div>
                <div v-else class="text-gray-500">
                  🔄 {{ item.attempts }} 次尝试
                </div>
                <div v-if="item.completed_at" class="text-xs text-gray-400 mt-1">
                  {{ new Date(item.completed_at).toLocaleString('zh-CN') }}
                </div>
              </div>
            </div>
          </div>
          <div v-if="history.length === 0" class="text-center py-8 text-gray-500">
            暂无游戏记录
          </div>
        </div>
      </div>
    </div>

    <!-- 所有题目弹窗 -->
    <div
      v-if="showAllSeeds"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 sm:pt-20 pt-32 z-50"
      @click.self="showAllSeeds = false"
    >
      <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] sm:max-h-[60vh] flex flex-col">
        <div class="sticky top-0 bg-white border-b p-4 flex justify-between items-center flex-shrink-0">
          <h2 class="text-xl font-bold text-gray-800">📚 所有已生成题目</h2>
          <button
            @click="showAllSeeds = false"
            class="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>
        <div class="p-4 space-y-3 overflow-y-auto">
          <div
            v-for="seed in allSeeds"
            :key="seed.seedString"
            class="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition"
            @click="() => { showAllSeeds = false; router.push(`/guess/${seed.seedString}`); }"
          >
            <div class="flex justify-between items-start">
              <div>
                <div class="font-bold text-lg text-gray-900">{{ seed.seedString }}</div>
                <div class="text-xs text-gray-500 mt-1">
                  创建于：{{ new Date(seed.createdAt).toLocaleString('zh-CN') }}
                </div>
              </div>
              <div class="text-right">
                <div class="text-purple-600 font-bold">
                  👥 {{ seed.completedCount }} 人完成
                </div>
              </div>
            </div>
          </div>
          <div v-if="allSeeds.length === 0" class="text-center py-8 text-gray-500">
            暂无题目
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type="text"] {
  font-family: inherit;
}
</style>

