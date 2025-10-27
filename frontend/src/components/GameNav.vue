<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

// 获取今日日期字符串
function getTodayString(): string {
  const today = new Date()
  return today.getFullYear() + '-' + 
         String(today.getMonth() + 1).padStart(2, '0') + '-' + 
         String(today.getDate()).padStart(2, '0')
}
</script>

<template>
  <div class="flex gap-2">
    <button
      @click="router.push('/')"
      class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
    >
      🎮 合成游戏
    </button>
    <button
      @click="router.push(`/guess/${getTodayString()}`)"
      class="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition"
    >
      🎯 今日题目
    </button>
  </div>
</template>

