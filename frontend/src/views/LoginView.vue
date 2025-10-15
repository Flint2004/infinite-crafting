<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/useUserStore'
import { useResourcesStore } from '@/stores/useResourcesStore'
import request from '@/utils/request'

const router = useRouter()
const userStore = useUserStore()
const resourcesStore = useResourcesStore()

const mode = ref<'login' | 'register'>('login')
const username = ref('')
const token = ref('')
const error = ref('')
const loading = ref(false)

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
      userStore.setUser(response.data.user)
      await loadBaseElements()
      router.push('/')
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
      router.push('/')
    }
  } catch (err: any) {
    error.value = err.response?.data?.error || '登录失败'
  } finally {
    loading.value = false
  }
}

async function loadBaseElements() {
  try {
    const response = await request.get('/elements/base')
    resourcesStore.setResources(response.data.elements)
  } catch (err) {
    console.error('加载基础元素失败', err)
  }
}
</script>

<template>
  <div class="min-h-[80vh] flex items-center justify-center">
    <div class="bg-white shadow-lg rounded-lg p-8 w-full max-w-md border border-gray-200">
      <div class="flex items-center justify-center mb-6">
        <div class="border-2 border-gray-200 shadow-sm px-3 rounded-lg py-1.5 text-gray-500 text-2xl font-semibold">
          <span class="text-sky-400">Open</span>Craft
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
  </div>
</template>

<style scoped>
</style>

