<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/useUserStore'
import { useResourcesStore } from '@/stores/useResourcesStore'
import request from '@/utils/request'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const resourcesStore = useResourcesStore()

const mode = ref<'login' | 'register'>('login')
const username = ref('')
const token = ref('')
const error = ref('')
const loading = ref(false)
const showTokenModal = ref(false)
const registeredToken = ref('')

async function handleRegister() {
  if (username.value.trim().length < 2) {
    error.value = '用户名至少需要2个字符'
    return
  }
  
  loading.value = true
  error.value = ''
  
  try {
    const response = await request.post('/register', {
      username: username.value.trim()
    })
    
    if (response.data.success) {
      // 显示token提示
      registeredToken.value = response.data.user.token
      showTokenModal.value = true
      
      userStore.setUser(response.data.user)
      await loadBaseElements()
    }
  } catch (err: any) {
    error.value = err.response?.data?.error || '注册失败'
  } finally {
    loading.value = false
  }
}

async function handleLogin() {
  if (!token.value.trim()) {
    error.value = '请输入token'
    return
  }
  
  loading.value = true
  error.value = ''
  
  try {
    const response = await request.post('/login', {
      token: token.value.trim()
    })
    
    if (response.data.success) {
      userStore.setUser(response.data.user)
      await loadBaseElements()
      
      // 如果有 redirect 参数，跳转到原页面，否则跳转到首页
      const redirect = route.query.redirect as string
      router.push(redirect || '/')
    }
  } catch (err: any) {
    error.value = err.response?.data?.error || '登录失败'
  } finally {
    loading.value = false
  }
}

async function loadBaseElements() {
  try {
    // 只在没有任何元素时才加载基础元素
    if (resourcesStore.resources.length === 0) {
      const response = await request.get('/elements/base')
      resourcesStore.setResources(response.data.elements)
    }
    // 如果已有元素，则保持不变，不重新加载
  } catch (err) {
    console.error('加载基础元素失败', err)
  }
}

async function copyTokenAndContinue() {
  try {
    // 尝试使用现代 Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(registeredToken.value)
      alert('Token已复制到剪贴板！')
    } else {
      // 降级方案：使用传统的 document.execCommand
      const textArea = document.createElement('textarea')
      textArea.value = registeredToken.value
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      try {
        const successful = document.execCommand('copy')
        if (successful) {
          alert('Token已复制到剪贴板！')
        } else {
          alert('复制失败，请手动复制Token')
        }
      } catch (err) {
        console.error('复制失败:', err)
        alert('复制失败，请手动复制Token')
      }
      document.body.removeChild(textArea)
    }
  } catch (err) {
    console.error('复制失败:', err)
    alert('复制失败，请手动复制Token')
  }
  showTokenModal.value = false
  
  // 如果有 redirect 参数，跳转到原页面，否则跳转到首页
  const redirect = route.query.redirect as string
  router.push(redirect || '/')
}

function skipAndContinue() {
  showTokenModal.value = false
  
  // 如果有 redirect 参数，跳转到原页面，否则跳转到首页
  const redirect = route.query.redirect as string
  router.push(redirect || '/')
}
</script>

<template>
  <div class="min-h-[80vh] flex items-center justify-center">
    <div class="bg-white shadow-lg rounded-lg p-8 w-full max-w-md border border-gray-200">
      <div class="flex items-center justify-center mb-6">
        <div class="border-2 border-gray-200 shadow-sm px-3 rounded-lg py-1.5 text-gray-500 text-2xl font-semibold">
          <a 
            href="https://www.szucraft.cn" 
            target="_blank"
            rel="noopener noreferrer"
            class="border-2 border-gray-200 shadow-sm px-2.5 rounded-lg py-1 text-xl font-semibold select-none cursor-pointer hover:border-gray-300 transition"
          >
            <span class="text-red-500">SZU</span><span class="text-gray-400">Craft</span>
          </a>
        </div>
      </div>
      
      <div class="flex border-b border-gray-200 mb-6">
        <button
          @click="mode = 'register'"
          :class="[
            'flex-1 py-2 text-center font-semibold transition',
            mode === 'register' ? 'text-sky-500 border-b-2 border-sky-500' : 'text-gray-400 hover:text-gray-600'
          ]"
        >
          注册
        </button>
        <button
          @click="mode = 'login'"
          :class="[
            'flex-1 py-2 text-center font-semibold transition',
            mode === 'login' ? 'text-sky-500 border-b-2 border-sky-500' : 'text-gray-400 hover:text-gray-600'
          ]"
        >
          登录
        </button>
      </div>
      
      <div v-if="error" class="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
        {{ error }}
      </div>
      
      <div v-if="mode === 'register'">
        <div class="mb-4">
          <label class="block text-gray-700 font-medium mb-2">用户名</label>
          <input
            v-model="username"
            type="text"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-500"
            placeholder="输入用户名"
            @keyup.enter="handleRegister"
          />
        </div>
        <button
          @click="handleRegister"
          :disabled="loading"
          class="w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ loading ? '注册中...' : '注册' }}
        </button>
        <p class="mt-4 text-sm text-gray-500 text-center">
          注册后会自动生成一个token，请妥善保存！
        </p>
      </div>
      
      <div v-else>
        <div class="mb-4">
          <label class="block text-gray-700 font-medium mb-2">Token</label>
          <input
            v-model="token"
            type="text"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-sky-500"
            placeholder="输入你的token"
            @keyup.enter="handleLogin"
          />
        </div>
        <button
          @click="handleLogin"
          :disabled="loading"
          class="w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ loading ? '登录中...' : '登录' }}
        </button>
      </div>
    </div>
    
    <!-- Token提示模态框 -->
    <div v-if="showTokenModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <h3 class="text-lg font-semibold text-gray-800 mb-3">🎉 注册成功！</h3>
        <p class="text-sm text-gray-600 mb-3">您的登录Token已生成，请妥善保存：</p>
        <div class="bg-gray-50 border border-gray-200 rounded p-3 mb-4">
          <div class="text-xs text-gray-500 mb-1">您的Token：</div>
          <div class="font-mono text-sm text-gray-800 break-all">{{ registeredToken }}</div>
        </div>
        <div class="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
          <p class="text-xs text-yellow-800">
            ⚠️ 重要提示：请务必复制并保存此Token，下次登录时需要使用。Token丢失后无法找回！
          </p>
        </div>
        <div class="flex space-x-3">
          <button
            @click="copyTokenAndContinue"
            class="flex-1 bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2 rounded-lg transition"
          >
            复制并继续
          </button>
          <button
            @click="skipAndContinue"
            class="px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 rounded-lg transition"
          >
            跳过
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>

