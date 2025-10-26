<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useUserStore } from '@/stores/useUserStore'
import { useRouter } from 'vue-router'
import request from '@/utils/request'

const userStore = useUserStore()
const router = useRouter()

// 游戏状态
const seedString = ref('')
const question = ref<any>(null)
const guesses = ref<Array<{ character: string; isInTitle: boolean; positions: number[] }>>([])
const currentInput = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const isCompleted = ref(false)
const leaderboard = ref<Array<{ username: string; guess_count: number; completed_at: string }>>([])

// 游戏历史
const history = ref<Array<any>>([])
const showHistory = ref(false)

// 统计信息
const totalGuesses = computed(() => guesses.value.length)
const correctGuesses = computed(() => guesses.value.filter(g => g.isInTitle).length)
const wrongGuesses = computed(() => guesses.value.filter(g => !g.isInTitle))

// 显示的标题（根据已猜测的字符显示）
const displayedTitle = computed(() => {
  if (!question.value) return ''
  
  const title = question.value.originalTitle
  const guessedChars = new Set(
    guesses.value.filter(g => g.isInTitle).map(g => g.character)
  )
  
  return title.split('').map(char => {
    // 标点符号直接显示
    if (/[\u3000-\u303F\uFF00-\uFFEF]/.test(char)) {
      return char
    }
    // 已猜测的字符显示，并加绿色背景
    if (guessedChars.has(char)) {
      return `<span class="bg-green-500 text-white px-1 mx-0.5 rounded">${char}</span>`
    }
    // 未猜测的显示方块
    return '<span class="text-gray-700">■</span>'
  }).join('')
})

// 显示的描述（根据已猜测的字符显示）
const displayedDescription = computed(() => {
  if (!question.value) return ''
  
  const description = question.value.description
  const guessedChars = new Set(
    guesses.value.filter(g => g.isInTitle).map(g => g.character)
  )
  
  return description.split('').map(char => {
    // 标点符号直接显示
    if (/[\u3000-\u303F\uFF00-\uFFEF]/.test(char)) {
      return char
    }
    // 已猜测的字符显示，并加绿色背景
    if (guessedChars.has(char)) {
      return `<span class="bg-green-500 text-white px-1 mx-0.5 rounded">${char}</span>`
    }
    // 未猜测的显示方块
    return '<span class="text-gray-400">■</span>'
  }).join('')
})

// 开始游戏
async function startGame() {
  if (!seedString.value.trim()) {
    errorMessage.value = '请输入一个字符串'
    return
  }
  
  isLoading.value = true
  errorMessage.value = ''
  
  try {
    const response = await request.get(`/guess/${encodeURIComponent(seedString.value)}`)
    question.value = response.data.question
    
    // 恢复已有的猜测记录
    if (response.data.guesses && response.data.guesses.length > 0) {
      guesses.value = response.data.guesses.map((g: any) => ({
        character: g.character,
        isInTitle: g.is_in_title === 1,
        positions: g.position ? g.position.split(',').map(Number) : []
      }))
    } else {
      guesses.value = []
    }
    
    leaderboard.value = response.data.leaderboard || []
    
    // 检查是否已完成
    checkCompletion()
    
  } catch (error: any) {
    const errorData = error.response?.data
    if (errorData?.message) {
      errorMessage.value = `${errorData.error}: ${errorData.message}`
    } else {
      errorMessage.value = errorData?.error || '加载题目失败'
    }
  } finally {
    isLoading.value = false
  }
}

// 提交猜测
async function submitGuess() {
  if (!currentInput.value || currentInput.value.length !== 1) {
    errorMessage.value = '请输入单个汉字'
    return
  }
  
  // 检查是否已经猜过
  if (guesses.value.some(g => g.character === currentInput.value)) {
    errorMessage.value = '已经猜过这个字了'
    currentInput.value = ''
    return
  }
  
  isLoading.value = true
  errorMessage.value = ''
  
  try {
    const response = await request.post(`/guess/${question.value.id}/submit`, {
      character: currentInput.value
    })
    
    guesses.value.push({
      character: response.data.character,
      isInTitle: response.data.isInTitle,
      positions: response.data.positions
    })
    
    currentInput.value = ''
    
    if (response.data.isCompleted) {
      isCompleted.value = true
      // 重新加载排行榜
      await startGame()
    }
    
  } catch (error: any) {
    errorMessage.value = error.response?.data?.error || '提交失败'
  } finally {
    isLoading.value = false
  }
}

// 检查是否完成
function checkCompletion() {
  if (!question.value) return
  
  const guessedChars = new Set(
    guesses.value.filter(g => g.isInTitle).map(g => g.character)
  )
  const titleChars = new Set(
    question.value.originalTitle.split('').filter((c: string) => /[\u4e00-\u9fff]/.test(c))
  )
  
  isCompleted.value = Array.from(titleChars).every(c => guessedChars.has(c))
}

// 加载历史记录
async function loadHistory() {
  try {
    const response = await request.get('/guess/history')
    history.value = response.data.history
    showHistory.value = true
  } catch (error: any) {
    errorMessage.value = error.response?.data?.error || '加载历史失败'
  }
}

// 重置游戏
function resetGame() {
  question.value = null
  guesses.value = []
  currentInput.value = ''
  errorMessage.value = ''
  isCompleted.value = false
  leaderboard.value = []
}

// 处理回车键
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    if (!question.value) {
      startGame()
    } else {
      submitGuess()
    }
  }
}

onMounted(() => {
  // 路由守卫已经处理了认证，这里不需要再检查
  console.log('GuessView mounted, user:', userStore.user)
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4 pt-24">
    <div class="max-w-4xl mx-auto">
      <!-- 标题栏 -->
      <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-3xl font-bold text-purple-600 mb-2">🎯 猜百科</h1>
            <p class="text-gray-600">根据提示猜出百科词条的标题</p>
          </div>
          <div class="flex gap-2">
            <button
              @click="loadHistory"
              class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
            >
              📜 历史记录
            </button>
            <button
              v-if="question"
              @click="resetGame"
              class="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
            >
              🔄 新游戏
            </button>
            <button
              @click="router.push('/')"
              class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
            >
              🏠 返回主页
            </button>
          </div>
        </div>
      </div>

      <!-- 错误提示 -->
      <div v-if="errorMessage" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
        {{ errorMessage }}
      </div>

      <!-- 开始游戏 -->
      <div v-if="!question" class="bg-white rounded-lg shadow-lg p-8">
        <h2 class="text-xl font-bold mb-4 text-gray-800">输入一个字符串开始游戏</h2>
        <div class="flex gap-4">
          <input
            v-model="seedString"
            @keydown="handleKeydown"
            type="text"
            placeholder="例如：2025-10-26"
            class="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            @click="startGame"
            :disabled="isLoading"
            class="px-8 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition disabled:bg-gray-400"
          >
            {{ isLoading ? '生成中...' : '开始游戏' }}
          </button>
        </div>
        <div class="mt-4 space-y-2">
          <p class="text-sm text-blue-600">
            📅 <strong>每日题目：</strong>输入日期格式（YYYY-MM-DD）可自动生成题目，如：2025-10-26
          </p>
          <p class="text-sm text-gray-500">
            🎯 <strong>关键词题目：</strong>其他关键词需要管理员预先生成
          </p>
          <p class="text-sm text-gray-500">
            💡 提示：相同的字符串会生成相同的题目，你可以和朋友挑战同一道题！
          </p>
        </div>
      </div>

      <!-- 游戏主界面 -->
      <div v-else class="space-y-6">
        <!-- 完成提示 -->
        <div v-if="isCompleted" class="bg-green-100 border border-green-400 text-green-700 px-6 py-4 rounded-lg">
          <div class="flex items-center gap-3">
            <span class="text-3xl">🎉</span>
            <div>
              <p class="font-bold text-lg">恭喜完成！</p>
              <p>你用了 {{ totalGuesses }} 次猜测完成了这道题</p>
            </div>
          </div>
        </div>

        <!-- 题目显示 -->
        <div class="bg-white rounded-lg shadow-lg p-6">
          <div class="mb-4">
            <h3 class="text-sm text-gray-600 mb-2">题目标题：</h3>
            <div 
              class="text-2xl font-bold mb-4 leading-relaxed"
              v-html="displayedTitle"
            ></div>
          </div>
          
          <div>
            <h3 class="text-sm text-gray-600 mb-2">百科描述：</h3>
            <div 
              class="text-base leading-relaxed text-gray-700"
              v-html="displayedDescription"
            ></div>
          </div>
        </div>

        <!-- 统计信息 -->
        <div class="grid grid-cols-3 gap-4">
          <div class="bg-white rounded-lg shadow p-4 text-center">
            <div class="text-3xl font-bold text-purple-600">{{ totalGuesses }}</div>
            <div class="text-sm text-gray-600">总猜测次数</div>
          </div>
          <div class="bg-white rounded-lg shadow p-4 text-center">
            <div class="text-3xl font-bold text-green-600">{{ correctGuesses }}</div>
            <div class="text-sm text-gray-600">正确字符</div>
          </div>
          <div class="bg-white rounded-lg shadow p-4 text-center">
            <div class="text-3xl font-bold text-red-600">{{ wrongGuesses.length }}</div>
            <div class="text-sm text-gray-600">错误字符</div>
          </div>
        </div>

        <!-- 输入区域 -->
        <div v-if="!isCompleted" class="bg-white rounded-lg shadow-lg p-6">
          <h3 class="text-lg font-bold mb-4 text-gray-800">猜一个字：</h3>
          <div class="flex gap-4">
            <input
              v-model="currentInput"
              @keydown="handleKeydown"
              type="text"
              maxlength="1"
              placeholder="输入单个汉字"
              class="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-center text-2xl"
            />
            <button
              @click="submitGuess"
              :disabled="isLoading || !currentInput"
              class="px-8 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition disabled:bg-gray-400"
            >
              提交
            </button>
          </div>
        </div>

        <!-- 错误的字符 -->
        <div v-if="wrongGuesses.length > 0" class="bg-white rounded-lg shadow-lg p-6">
          <h3 class="text-lg font-bold mb-4 text-gray-800">❌ 不在标题中的字符：</h3>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="guess in wrongGuesses"
              :key="guess.character"
              class="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-lg font-medium"
            >
              {{ guess.character }}
            </span>
          </div>
        </div>

        <!-- 排行榜 -->
        <div v-if="leaderboard.length > 0" class="bg-white rounded-lg shadow-lg p-6">
          <h3 class="text-lg font-bold mb-4 text-gray-800">🏆 排行榜</h3>
          <div class="space-y-2">
            <div
              v-for="(entry, index) in leaderboard"
              :key="index"
              class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div class="flex items-center gap-3">
                <span class="text-2xl">
                  {{ index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.` }}
                </span>
                <span class="font-medium">{{ entry.username }}</span>
              </div>
              <div class="text-right">
                <div class="font-bold text-purple-600">{{ entry.guess_count }} 次</div>
                <div class="text-xs text-gray-500">
                  {{ new Date(entry.completed_at).toLocaleString('zh-CN') }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 历史记录弹窗 -->
      <div
        v-if="showHistory"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
        @click.self="showHistory = false"
      >
        <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto">
          <div class="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
            <h2 class="text-xl font-bold text-gray-800">📜 游戏历史</h2>
            <button
              @click="showHistory = false"
              class="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>
          <div class="p-4 space-y-3">
            <div
              v-for="item in history"
              :key="item.id"
              class="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
              @click="() => { seedString = item.seed_string; showHistory = false; resetGame(); startGame(); }"
            >
              <div class="flex justify-between items-start">
                <div>
                  <div class="font-bold text-lg">{{ item.title }}</div>
                  <div class="text-sm text-gray-600">种子：{{ item.seed_string }}</div>
                </div>
                <div class="text-right">
                  <div v-if="item.guess_count" class="text-green-600 font-bold">
                    ✅ {{ item.guess_count }} 次完成
                  </div>
                  <div v-else class="text-gray-500">
                    🔄 {{ item.attempts }} 次尝试
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
    </div>
  </div>
</template>

<style scoped>
/* 自定义样式 */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type="text"] {
  font-family: inherit;
}
</style>

