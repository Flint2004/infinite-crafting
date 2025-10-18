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
  if (!searchTerm.value) {
    return resources.value;
  }
  return resources.value.filter((resource) => {
    return resource.name_cn.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
           resource.name_en.toLowerCase().includes(searchTerm.value.toLowerCase())
  })
})

const [, drop] = useDrop(() => ({
  accept: ItemTypes.BOX,
  drop(item: DragItem) {
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
    class="available-resources p-4 bg-gray-100 border-t border-gray-200 flex flex-col"
  >
    <h2 class="text-xl font-bold mb-4 text-gray-800">已发现的元素 ({{ filteredResources.length }})</h2>
    <input v-model="searchTerm" type="text" class="w-full border border-gray-300 rounded-lg px-3 py-2 select-text mb-3 sticky top-0" placeholder="搜索元素...">
    <div class="flex-grow overflow-y-auto">
      <div class="flex gap-3 flex-wrap select-none">
        <Resource
          v-for="resource in filteredResources"
          :key="resource.id"
          :element="resource"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>