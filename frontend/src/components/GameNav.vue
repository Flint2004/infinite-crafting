<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
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
      @click="router.push('/guess')"
      class="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition"
    >
      🎯 猜百科
    </button>
  </div>
</template>

