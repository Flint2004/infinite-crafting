<script setup lang="ts">
import {RouterLink, RouterView, useRouter} from 'vue-router'
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/stores/useUserStore'
import { useResourcesStore } from '@/stores/useResourcesStore'
import { useBoxesStore } from '@/stores/useBoxesStore'

const router = useRouter()
const userStore = useUserStore()
const resourcesStore = useResourcesStore()
const boxesStore = useBoxesStore()

const showUserMenu = ref(false)
const showLogoutModal = ref(false)

onMounted(() => {
  userStore.initializeUser()
})

function showLogoutDialog() {
  showUserMenu.value = false
  showLogoutModal.value = true
}

function onlyLogout() {
  // 只清除用户信息，保留所有数据（首次发现人信息保留在元素数据中）
  userStore.clearUser()
  showLogoutModal.value = false
  router.push('/login')
}

function logoutAndClearWorkArea() {
  // 清除用户信息和工作区
  userStore.clearUser()
  boxesStore.clearBoxes()
  showLogoutModal.value = false
  router.push('/login')
}

function logoutAndClearElements() {
  // 清除用户信息和元素列表
  userStore.clearUser()
  resourcesStore.clearResources()
  showLogoutModal.value = false
  router.push('/login')
}

function logoutAndClearAll() {
  // 清除所有数据
  userStore.clearUser()
  resourcesStore.clearResources()
  boxesStore.clearBoxes()
  showLogoutModal.value = false
  router.push('/login')
}

function cancelLogout() {
  showLogoutModal.value = false
}

async function copyToken() {
  if (userStore.user?.token) {
    try {
      // 尝试使用现代 Clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(userStore.user.token)
        alert('Token已复制到剪贴板！')
      } else {
        // 降级方案：使用传统的 document.execCommand
        const textArea = document.createElement('textarea')
        textArea.value = userStore.user.token
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
            alert('复制失败，请手动复制')
          }
        } catch (err) {
          console.error('复制失败:', err)
          alert('复制失败，请手动复制')
        }
        document.body.removeChild(textArea)
      }
    } catch (err) {
      console.error('复制失败:', err)
      alert('复制失败，请手动复制')
    }
  }
}
</script>

<template>
  <header v-if="userStore.isLoggedIn()" class="border-b border-gray-300 py-4 px-4 fixed z-20 w-full bg-white shadow-sm select-none">
    <div class="flex w-full px-4 mx-auto justify-between items-center">
      <div class="flex items-center space-x-3">
        <div class="border-2 border-gray-200 shadow-sm px-2.5 rounded-lg py-1 text-gray-500 text-xl font-semibold">
          <span class="text-sky-400">Open</span>Craft
        </div>
        <div class="relative">
          <button
            @click="showUserMenu = !showUserMenu"
            class="text-sm text-gray-500 hover:text-gray-700 transition flex items-center space-x-1"
          >
            <span>玩家: <span class="font-semibold text-gray-700">{{ userStore.user?.username }}</span></span>
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
          <div v-if="showUserMenu" @click="showUserMenu = false" class="fixed inset-0 z-10"></div>
          <div v-if="showUserMenu" class="absolute left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
            <div class="p-3">
              <div class="text-xs text-gray-500 mb-1 select-none">您的Token</div>
              <div class="flex items-center space-x-2">
                <input
                  :value="userStore.user?.token"
                  readonly
                  class="flex-1 text-xs px-2 py-1 border border-gray-300 rounded bg-gray-50 font-mono select-text"
                  type="text"
                />
                <button
                  @click="copyToken"
                  class="px-2 py-1 bg-sky-500 text-white text-xs rounded hover:bg-sky-600 transition select-none"
                >
                  复制
                </button>
              </div>
              <div class="text-xs text-gray-400 mt-1 select-none">请妥善保存，用于下次登录</div>
            </div>
          </div>
        </div>
      </div>
      <nav class="flex space-x-5 items-center">
        <RouterLink class="text-gray-500 transition hover:text-gray-600 font-semibold" to="/">游戏</RouterLink>
        <RouterLink class="text-gray-500 transition hover:text-gray-600 font-semibold" to="/about">关于</RouterLink>
        <button 
          @click="showLogoutDialog"
          class="text-gray-500 transition hover:text-gray-600 font-semibold"
        >
          清理
        </button>
      </nav>
    </div>
  </header>
  <div class="bg-gray-50 h-screen flex flex-col" :class="userStore.isLoggedIn() ? 'pt-24' : 'pt-4'">
    <div class="flex-grow min-h-0">
      <RouterView/>
    </div>
  </div>

  <!-- 退出登录弹窗 -->
  <div v-if="showLogoutModal" @click="cancelLogout" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div @click.stop class="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
      <h3 class="text-xl font-semibold text-gray-800 mb-4">选择清理方式</h3>
      <p class="text-sm text-gray-600 mb-6">请选择要执行的操作：</p>
      
      <div class="space-y-3">
        <!-- 仅退出登录 -->
        <button
          @click="onlyLogout"
          class="w-full text-left p-4 border-2 border-gray-200 rounded-lg hover:border-sky-500 hover:bg-sky-50 transition group"
        >
          <div class="flex items-start">
            <div class="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center group-hover:bg-sky-500 group-hover:text-white transition">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </div>
            <div class="ml-3 flex-1">
              <div class="font-semibold text-gray-800 group-hover:text-sky-600 transition">仅退出登录</div>
              <div class="text-xs text-gray-500 mt-1">保留所有已发现元素和工作区数据</div>
            </div>
          </div>
        </button>

        <!-- 清除工作区 -->
        <button
          @click="logoutAndClearWorkArea"
          class="w-full text-left p-4 border-2 border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition group"
        >
          <div class="flex items-start">
            <div class="flex-shrink-0 w-8 h-8 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div class="ml-3 flex-1">
              <div class="font-semibold text-gray-800 group-hover:text-orange-600 transition">清除工作区</div>
              <div class="text-xs text-gray-500 mt-1">退出登录并清空工作区，保留元素列表</div>
            </div>
          </div>
        </button>

        <!-- 清除元素区 -->
        <button
          @click="logoutAndClearElements"
          class="w-full text-left p-4 border-2 border-gray-200 rounded-lg hover:border-red-500 hover:bg-red-50 transition group"
        >
          <div class="flex items-start">
            <div class="flex-shrink-0 w-8 h-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <div class="ml-3 flex-1">
              <div class="font-semibold text-gray-800 group-hover:text-red-600 transition">清除元素列表</div>
              <div class="text-xs text-gray-500 mt-1">退出登录并清空元素列表，保留工作区</div>
            </div>
          </div>
        </button>

        <!-- 清除全部 -->
        <button
          @click="logoutAndClearAll"
          class="w-full text-left p-4 border-2 border-red-300 rounded-lg hover:border-red-600 hover:bg-red-50 transition group"
        >
          <div class="flex items-start">
            <div class="flex-shrink-0 w-8 h-8 bg-red-200 text-red-700 rounded-full flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div class="ml-3 flex-1">
              <div class="font-semibold text-gray-800 group-hover:text-red-600 transition">清除所有数据</div>
              <div class="text-xs text-gray-500 mt-1">退出登录并清空所有元素和工作区</div>
            </div>
          </div>
        </button>
      </div>

      <!-- 取消按钮 -->
      <div class="mt-6 flex justify-end">
        <button
          @click="cancelLogout"
          class="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition"
        >
          取消
        </button>
      </div>
    </div>
  </div>

</template>

<style scoped>

</style>
