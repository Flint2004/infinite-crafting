<script setup lang="ts">
import Resource from "@/components/Resource.vue";
import {useResourcesStore} from "@/stores/useResourcesStore";
import {storeToRefs} from "pinia";
import {computed, ref} from "vue";

const store = useResourcesStore()
const {resources} = storeToRefs(store)
const searchTerm = ref('')

const filteredResources = computed(() => {
  return resources.value.filter((resource) => {
    return resource.name_cn.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
           resource.name_en.toLowerCase().includes(searchTerm.value.toLowerCase())
  })
})
</script>

<template>
  <div class="flex gap-3 flex-wrap pt-3">
    <input v-model="searchTerm" type="text" class="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="搜索元素...">
    <Resource 
      v-for="resource in filteredResources" 
      :key="resource.id" 
      :id="resource.id"
      :name_cn="resource.name_cn"
      :name_en="resource.name_en"
      :emoji="resource.emoji"
      :discoverer_name="resource.discoverer_name"
    />
  </div>
</template>

<style scoped>

</style>