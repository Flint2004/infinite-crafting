<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useUserStore } from '@/stores/useUserStore'
import { useRouter, useRoute } from 'vue-router'
import request from '@/utils/request'

const userStore = useUserStore()
const router = useRouter()
const route = useRoute()

// 游戏状态
const seedString = ref('')
const question = ref<any>(null)
const guesses = ref<Array<{ 
  character: string; 
  isInTitle: boolean; 
  titlePositions: number[];
  isInContent: boolean;
  contentPositions: number[];
}>>([])
const currentInput = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const errorTitle = ref('')
const isCompleted = ref(false)
const leaderboard = ref<Array<{ username: string; guess_count: number; completed_at: string }>>([])

// 游戏历史
const history = ref<Array<any>>([])
const showHistory = ref(false)

// 浮窗提示
const toastMessage = ref('')
const showToast = ref(false)

// 统计信息
const totalGuesses = computed(() => guesses.value.length)
const correctGuesses = computed(() => guesses.value.filter(g => g.isInTitle || g.isInContent).length)
const wrongGuesses = computed(() => guesses.value.filter(g => !g.isInTitle && !g.isInContent))

// 解码 HTML 实体（如 &#34; -> "）
function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = text
  return textarea.value
}

// 显示浮窗提示
function showToastNotification(message: string) {
  toastMessage.value = message
  showToast.value = true
  setTimeout(() => {
    showToast.value = false
  }, 2000)
}

// 显示的标题（根据已猜测的字符显示）
const displayedTitle = computed(() => {
  if (!question.value) return ''
  
  // 解码 HTML 实体
  const title = decodeHtmlEntities(question.value.title)
  
  // 如果已完成且有原始标题，显示完整内容（包括未猜测的字符）
  if (question.value.originalTitle && isCompleted.value) {
    const originalTitle = decodeHtmlEntities(question.value.originalTitle)
    const guessedChars = new Set(
      guesses.value.filter(g => g.isInTitle).map(g => g.character)
    )
    
    return originalTitle.split('').map(char => {
      // 标点符号直接显示（包括中文引号 ""''）
      if (/[\u3000-\u303F\uFF00-\uFFEF\u2018-\u201F]/.test(char)) {
        return char
      }
      // 已猜测的字符用绿色高亮
      if (guessedChars.has(char)) {
        return `<span class="bg-green-500 text-white px-1 mx-0.5 rounded">${char}</span>`
      }
      // 未猜测的字符显示原字符（完成后显示完整答案）
      return `<span class="text-gray-700">${char}</span>`
    }).join('')
  }
  
  // 未完成：根据猜测记录重建显示
  const chars = title.split('')
  const positionMap = new Map() // position -> character
  
  guesses.value.forEach(g => {
    if (g.isInTitle && g.titlePositions) {
      g.titlePositions.forEach(pos => {
        positionMap.set(pos, g.character)
      })
    }
  })
  
  return chars.map((char, index) => {
    if (/[\u3000-\u303F\uFF00-\uFFEF\u2018-\u201F]/.test(char)) {
      return char
    }
    if (positionMap.has(index)) {
      return `<span class="bg-green-500 text-white px-1 mx-0.5 rounded">${positionMap.get(index)}</span>`
    }
    return '<span class="text-gray-700">■</span>'
  }).join('')
})

// 显示的描述（根据已猜测的字符显示）
const displayedDescription = computed(() => {
  if (!question.value) return ''
  
  // 解码 HTML 实体
  const description = decodeHtmlEntities(question.value.description)
  
  // 如果已完成且有原始描述，显示完整内容（包括未猜测的字符）
  if (question.value.originalDescription && isCompleted.value) {
    const originalDescription = decodeHtmlEntities(question.value.originalDescription)
    const guessedChars = new Set(
      guesses.value.filter(g => g.isInContent).map(g => g.character)
    )
    
    return originalDescription.split('').map(char => {
      // 标点符号直接显示（包括中文引号 ""''）
      if (/[\u3000-\u303F\uFF00-\uFFEF\u2018-\u201F]/.test(char)) {
        return char
      }
      // 已猜测的字符用蓝色高亮
      if (guessedChars.has(char)) {
        return `<span class="bg-blue-500 text-white px-1 mx-0.5 rounded">${char}</span>`
      }
      // 未猜测的字符显示原字符（完成后显示完整答案）
      return `<span class="text-gray-700">${char}</span>`
    }).join('')
  }
  
  // 未完成：根据猜测记录重建显示
  const chars = description.split('')
  const positionMap = new Map() // position -> character
  
  guesses.value.forEach(g => {
    if (g.isInContent && g.contentPositions) {
      g.contentPositions.forEach(pos => {
        positionMap.set(pos, g.character)
      })
    }
  })
  
  return chars.map((char, index) => {
    if (/[\u3000-\u303F\uFF00-\uFFEF\u2018-\u201F]/.test(char)) {
      return char
    }
    if (positionMap.has(index)) {
      return `<span class="bg-blue-500 text-white px-1 mx-0.5 rounded">${positionMap.get(index)}</span>`
    }
    return '<span class="text-gray-400">■</span>'
  }).join('')
})

// 加载题目
async function loadQuestion() {
  if (!seedString.value.trim()) {
    errorTitle.value = '无效的题目'
    errorMessage.value = '请提供有效的题目标识符'
    return
  }
  
  isLoading.value = true
  errorMessage.value = ''
  errorTitle.value = ''
  
  try {
    const response = await request.get(`/guess/${encodeURIComponent(seedString.value)}`)
    question.value = response.data.question
    
    // 恢复已有的猜测记录
    if (response.data.guesses && response.data.guesses.length > 0) {
      guesses.value = response.data.guesses.map((g: any) => {
        const titlePositions = Array.isArray(g.position) ? g.position : (g.position ? g.position.split(',').filter((p: string) => p).map(Number) : [])
        const contentPositions = Array.isArray(g.content_position) ? g.content_position : (g.content_position ? g.content_position.split(',').filter((p: string) => p).map(Number) : [])
        
        return {
          character: g.character,
          isInTitle: g.is_in_title === 1,
          titlePositions: titlePositions,
          isInContent: contentPositions.length > 0,
          contentPositions: contentPositions
        }
      })
    } else {
      guesses.value = []
    }
    
    leaderboard.value = response.data.leaderboard || []
    
    // 使用后端返回的完成状态
    isCompleted.value = response.data.isCompleted || false
    
  } catch (error: any) {
    const errorData = error.response?.data
    if (error.response?.status === 404) {
      errorTitle.value = '题目不存在'
      errorMessage.value = errorData?.message || errorData?.error || '该题目尚未生成'
    } else {
      errorTitle.value = '加载失败'
      errorMessage.value = errorData?.error || '加载题目失败，请稍后重试'
    }
  } finally {
    isLoading.value = false
  }
}

// 提交猜测
async function submitGuess() {
  if (!currentInput.value || currentInput.value.trim().length === 0) {
    showToastNotification('请输入单个字（英文除外）')
    return
  }
  
  // 检查是否只有一个字符
  const trimmed = currentInput.value.trim()
  if (trimmed.length > 1) {
    showToastNotification('请只输入一个字')
    return
  }
  
  const character = trimmed
  
  // 检查是否已经猜过
  if (guesses.value.some(g => g.character === character)) {
    showToastNotification('已经猜过这个字了')
    currentInput.value = ''
    return
  }
  
  isLoading.value = true
  errorMessage.value = ''
  
  try {
    const response = await request.post(`/guess/${question.value.id}/submit`, {
      character: character
    })
    
    guesses.value.push({
      character: response.data.character,
      isInTitle: response.data.isInTitle,
      titlePositions: response.data.titlePositions,
      isInContent: response.data.isInContent,
      contentPositions: response.data.contentPositions
    })
    
    currentInput.value = ''
    
    if (response.data.isCompleted) {
      isCompleted.value = true
      
      // 如果后端返回了完整题目信息，更新 question
      if (response.data.question) {
        question.value.word = response.data.question.word
        question.value.originalTitle = response.data.question.originalTitle
        question.value.originalDescription = response.data.question.originalDescription
      }
      
      // 重新加载排行榜
      await loadQuestion()
    }
    
  } catch (error: any) {
    errorMessage.value = error.response?.data?.error || '提交失败'
  } finally {
    isLoading.value = false
  }
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
  errorTitle.value = ''
  isCompleted.value = false
  leaderboard.value = []
}

// 处理回车键
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    submitGuess()
  }
}

// 获取今日日期字符串
function getTodayString(): string {
  const today = new Date()
  return today.getFullYear() + '-' + 
         String(today.getMonth() + 1).padStart(2, '0') + '-' + 
         String(today.getDate()).padStart(2, '0')
}

// 监听路由参数变化
watch(() => route.params.str, (newStr) => {
  if (newStr && typeof newStr === 'string' && newStr.trim()) {
    // 重置游戏状态
    resetGame()
    
    // 加载新题目
    seedString.value = newStr
    loadQuestion()
  }
})

onMounted(() => {
  // 从路由参数读取 seedString
  const str = route.params.str as string
  
  if (str && str.trim()) {
    seedString.value = str
    loadQuestion()
  } else {
    errorTitle.value = '无效的题目'
    errorMessage.value = '请提供有效的题目标识符'
  }
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
            <p class="text-gray-600">题目：{{ seedString }}</p>
          </div>
          <div class="flex gap-2">
            <button
              @click="loadHistory"
              class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
            >
              📜 历史记录
            </button>
            <button
              @click="router.push(`/guess/${getTodayString()}`)"
              class="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition"
            >
              📅 今日题目
            </button>
            <button
              @click="router.push('/guess')"
              class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
            >
              🏠 返回猜词
            </button>
          </div>
        </div>
      </div>

      <!-- 错误提示 -->
      <div v-if="errorMessage" class="bg-red-100 border border-red-400 rounded-lg p-6 mb-6">
        <div class="flex items-start gap-4">
          <span class="text-4xl">❌</span>
          <div class="flex-1">
            <h2 class="text-xl font-bold text-red-700 mb-2">{{ errorTitle || '加载失败' }}</h2>
            <p class="text-red-600 mb-4">{{ errorMessage }}</p>
            <div class="flex gap-3">
              <button
                @click="router.push(`/guess/${getTodayString()}`)"
                class="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition"
              >
                🎯 进入今日题目
              </button>
              <button
                @click="router.push('/guess')"
                class="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
              >
                🏠 返回猜词
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 加载中 -->
      <div v-if="isLoading && !question" class="bg-white rounded-lg shadow-lg p-8 text-center">
        <div class="text-4xl mb-4">⏳</div>
        <p class="text-gray-600">加载题目中...</p>
      </div>

      <!-- 游戏主界面 -->
      <div v-else-if="question" class="space-y-6">
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
          <div class="mb-4 pb-4 border-b">
            <div class="flex justify-between items-center mb-2">
              <h3 class="text-sm text-gray-600">题目标题：</h3>
              <span class="text-xs text-green-600">🟢 绿色 = 标题中的字</span>
            </div>
            <div 
              class="text-2xl font-bold leading-relaxed"
              v-html="displayedTitle"
            ></div>
          </div>
          
          <div>
            <div class="flex justify-between items-center mb-2">
              <h3 class="text-sm text-gray-600">百科描述：</h3>
              <span class="text-xs text-blue-600">🔵 蓝色 = 内容中的字</span>
            </div>
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
              placeholder="输入单个字（英文除外）"
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

        <!-- 猜对的字符统计 -->
        <div v-if="guesses.length > 0" class="bg-white rounded-lg shadow-lg p-6">
          <h3 class="text-lg font-bold mb-4 text-gray-800">📊 猜测统计</h3>
          <div class="space-y-4">
            <!-- 标题中的字符 -->
            <div v-if="guesses.filter(g => g.isInTitle).length > 0">
              <h4 class="text-sm font-semibold text-green-700 mb-2">✅ 在标题中：</h4>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="guess in guesses.filter(g => g.isInTitle)"
                  :key="'title-' + guess.character"
                  class="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-base font-medium"
                >
                  {{ guess.character }}
                </span>
              </div>
            </div>
            
            <!-- 内容中的字符 -->
            <div v-if="guesses.filter(g => g.isInContent && !g.isInTitle).length > 0">
              <h4 class="text-sm font-semibold text-blue-700 mb-2">💡 仅在内容中：</h4>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="guess in guesses.filter(g => g.isInContent && !g.isInTitle)"
                  :key="'content-' + guess.character"
                  class="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-base font-medium"
                >
                  {{ guess.character }}
                </span>
              </div>
            </div>
            
            <!-- 错误的字符 -->
            <div v-if="wrongGuesses.length > 0">
              <h4 class="text-sm font-semibold text-red-700 mb-2">❌ 都不在其中：</h4>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="guess in wrongGuesses"
                  :key="'wrong-' + guess.character"
                  class="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-base font-medium"
                >
                  {{ guess.character }}
                </span>
              </div>
            </div>
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
              @click="() => { showHistory = false; router.push(`/guess/${item.seed_string}`); }"
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

    <!-- 浮窗提示 -->
    <Transition name="toast">
      <div
        v-if="showToast"
        class="fixed top-24 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-lg shadow-lg z-50"
      >
        {{ toastMessage }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translate(-50%, -20px);
}

.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -20px);
}

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

