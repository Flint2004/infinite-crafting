<script setup lang="ts">
import {RouterLink, RouterView, useRouter} from 'vue-router'
import { useUserStore } from '@/stores/useUserStore'
import { useResourcesStore } from '@/stores/useResourcesStore'

const router = useRouter()
const userStore = useUserStore()
const resourcesStore = useResourcesStore()

function handleLogout() {
  userStore.clearUser()
  resourcesStore.clearResources()
  router.push('/login')
}
</script>

<template>
  <header v-if="userStore.isLoggedIn()" class="border-b border-gray-300 py-4 px-4 fixed z-20 w-full bg-white shadow-sm">
    <div class="flex w-full px-4 mx-auto justify-between items-center">
      <div class="flex items-center space-x-3">
        <div class="border-2 border-gray-200 shadow-sm px-2.5 rounded-lg py-1 text-gray-500 text-xl font-semibold">
          <span class="text-sky-400">Open</span>Craft
        </div>
        <div class="text-sm text-gray-500">
          玩家: <span class="font-semibold text-gray-700">{{ userStore.user?.username }}</span>
        </div>
      </div>
      <nav class="flex space-x-5 items-center">
        <RouterLink class="text-gray-500 transition hover:text-gray-600 font-semibold" to="/">游戏</RouterLink>
        <RouterLink class="text-gray-500 transition hover:text-gray-600 font-semibold" to="/about">关于</RouterLink>
        <button 
          @click="handleLogout"
          class="text-gray-500 transition hover:text-gray-600 font-semibold"
        >
          退出
        </button>
      </nav>
    </div>
  </header>
  <div class="bg-gray-50 min-h-screen px-4" :class="userStore.isLoggedIn() ? 'pt-24' : 'pt-4'">
    <div class="">
      <RouterView/>
    </div>
  </div>

</template>

<style scoped>

</style>
