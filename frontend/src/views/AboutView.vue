<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function goBack() {
  router.back()
}
</script>

<template>
  <div class="bg-gradient-to-br from-gray-50 to-gray-100 p-4 sm:p-8">
    <div class="max-w-2xl mx-auto w-full bg-white rounded-2xl shadow-lg p-8 sm:p-12 border border-gray-200">
      <div class="text-center mb-8">
        <h1 class="text-4xl sm:text-5xl font-bold text-gray-800 mb-3">关于 本项目</h1>
        <p class="text-gray-500 text-lg">创造与发现的小游戏合集</p>
      </div>

      <div class="space-y-6 text-gray-700">
        <div>
          <h2 class="text-xl font-semibold text-gray-800 mb-2 border-b pb-2">Author</h2>
          <div class="space-y-3 mt-3 text-base">
            <div class="flex items-center gap-3">
              <img src="https://api.rms.net.cn/head/onriC9" alt="Author Avatar" class="w-6 h-6 rounded-md object-cover">
              <span>Flint Ting @ SZU (Four_Yi)</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="w-6 text-center">📧</span>
              <a href="mailto:fouryi2004@gmail.com" class="text-blue-500 hover:underline">fouryi2004@gmail.com</a>
            </div>
          </div>
        </div>

        <div>
          <h2 class="text-xl font-semibold text-gray-800 mb-2 border-b pb-2">Statement</h2>
          <div class="flex items-start gap-3 mt-3 text-base">
            <span class="w-6 text-center pt-1">🤖</span>
            <p>This website is developed mostly by AI, and the game is inspired by Infinite Craft & CaiYan.</p>
          </div>
        </div>
      </div>
      
      <div class="mt-12 text-center">
        <button
          @click="goBack"
          class="px-8 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-transform transform hover:scale-105 shadow-md"
        >
          ← 返回上一页
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* You can add custom styles here if needed */
</style>
