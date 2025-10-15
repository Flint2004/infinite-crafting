<script setup lang="ts">
import Resource from "@/components/Resource.vue";
import {useResourcesStore} from "@/stores/useResourcesStore";
import {useBoxesStore} from "@/stores/useBoxesStore";
import {storeToRefs} from "pinia";
import {computed, ref} from "vue";
import {useDrop} from "vue3-dnd";
import {ItemTypes} from "@/components/ItemTypes";
import {DragItem} from "@/components/interfaces";

const store = useResourcesStore()
const {resources} = storeToRefs(store)
const boxesStore = useBoxesStore()
const searchTerm = ref('')

const filteredResources = computed(() => {
  return resources.value.filter((resource) => {
    return resource.name_cn.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
           resource.name_en.toLowerCase().includes(searchTerm.value.toLowerCase())
  })
})

// 设置为可接收拖放区域（不显示提示）
const [collectDrop, drop] = useDrop(() => ({
  accept: ItemTypes.BOX,
  drop(item: DragItem, monitor) {
    // 如果是从工作区拖来的元素（有 id 表示是工作区的元素）
    if (item.id) {
      boxesStore.removeBox(item.id)
    }
    return undefined
  },
  collect: (monitor) => ({
    isOver: monitor.isOver(),
    canDrop: monitor.canDrop(),
  }),
}))
</script>

<template>
  <div 
    :ref="drop"
    class="flex gap-3 flex-wrap pt-3 select-none min-h-[100px]"
  >
    <input v-model="searchTerm" type="text" class="w-full border border-gray-300 rounded-lg px-3 py-2 select-text" placeholder="搜索元素...">
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