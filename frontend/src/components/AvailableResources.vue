<script setup lang="ts">
import Resource from './Resource.vue'
import { useResourcesStore } from '@/stores/useResourcesStore'
import { computed } from 'vue'

const resourcesStore = useResourcesStore()

const sortedResources = computed(() => {
  return [...resourcesStore.resources].sort((a, b) => {
    //
    const dateA = new Date(a.discovered_at || 0).getTime()
    const dateB = new Date(b.discovered_at || 0).getTime()
    return dateB - dateA
  })
})
</script>

<template>
  <div class="available-resources p-4 bg-gray-100 border-t border-gray-200">
    <h2 class="text-xl font-bold mb-4 text-gray-800">已发现的元素</h2>
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      <Resource
        v-for="element in sortedResources"
        :key="element.id"
        :element="element"
      />
    </div>
  </div>
</template>

<style scoped>

</style>