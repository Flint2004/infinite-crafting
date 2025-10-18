<script lang="ts" setup>
import {useDrop, XYCoord} from 'vue3-dnd'
import {ItemTypes} from './ItemTypes'
import Box from './Box.vue'
import type {DragItem} from './interfaces'
import {reactive, ref} from 'vue'
import ItemCard from "@/components/ItemCard.vue";
import AvailableResources from "@/components/AvailableResources.vue";
import CustomDragLayer from "@/components/CustomDragLayer.vue";
import {useBoxesStore} from "@/stores/useBoxesStore";
import {storeToRefs} from "pinia";

const store = useBoxesStore()
const { boxes } = store
const moveBox = (
  id: string, 
  left: number, 
  top: number, 
  elementId?: string, 
  word_cn?: string, 
  word_en?: string, 
  emoji?: string, 
  discoverer_name?: string
) => {
  if (id) {
    Object.assign(boxes[id], {left, top})
  } else {
    const key = Math.random().toString(36).substring(7);
    boxes[key] = {
      top, 
      left, 
      elementId, 
      word_cn, 
      word_en, 
      emoji, 
      discoverer_name
    }
    console.log(boxes)
  }
}

const containerElement = ref<HTMLElement | null>(null)

const [, drop] = useDrop(() => ({
  accept: ItemTypes.BOX,
  drop(item: DragItem, monitor) {
    if (item.id && item.left !== null && item.top !== null) {
      const delta = monitor.getDifferenceFromInitialOffset() as XYCoord
      if(delta && delta.x && delta.y){
        const left = Math.round((item.left) + delta.x)
        const top = Math.round((item.top) + delta.y )
        moveBox(item.id, left, top)
      }
    } else {
      const delta = monitor.getClientOffset() as XYCoord
      // current mouse position relative to drop
      const containerCoords = containerElement.value.getBoundingClientRect()
      if(delta && delta.x && delta.y){
        const left = Math.round(delta.x - containerCoords.left - 40)
        const top = Math.round(delta.y - containerCoords.top - 15)
        moveBox(
          null, 
          left, 
          top, 
          item.elementId, 
          item.word_cn, 
          item.word_en, 
          item.emoji, 
          item.discoverer_name
        )
      }
    }
    return undefined
  },
}))
</script>

<template>
  <div ref="containerElement" class="select-none">
    <!-- 自定义拖拽层 - 用于移动端显示拖拽预览 -->
    <CustomDragLayer />

    <main class="flex flex-row gap-3 h-[calc(100vh-120px)] overflow-hidden">
      <!-- 工作区 - 固定高度，不可滚动 -->
      <div class="w-full md:w-3/4 h-[calc(100vh-35vh-80px)] md:h-full overflow-hidden relative">
        <div :ref="drop" class="container">
          <Box
              v-for="(value, key) in boxes"
              :id="key"
              :key="key"
              :left="value.left"
              :top="value.top"
              :loading="value.loading"
              :element-id="value.elementId"
              :word_cn="value.word_cn"
              :word_en="value.word_en"
              :emoji="value.emoji"
              :discoverer_name="value.discoverer_name"
          >
            <ItemCard 
              :size="'large'"
              :id="key" 
              :element-id="value.elementId"
              :word_cn="value.word_cn"
              :word_en="value.word_en"
              :emoji="value.emoji"
              :discoverer_name="value.discoverer_name"
            />
          </Box>
        </div>
      </div>
      
      <!-- 元素列表 - 移动端固定在底部，桌面端固定在右侧 -->
      <div class="fixed md:relative bottom-0 left-0 right-0 w-full md:w-1/4 h-[35vh] md:h-full bg-white shadow px-4 py-3 border-t md:border border-gray-200 rounded-t-xl md:rounded-lg overflow-y-auto z-40">
        <h2 class="font-semibold select-none mb-2">元素列表</h2>
        <AvailableResources></AvailableResources>
      </div>
    </main>


  </div>

</template>

<style scoped>
.container {
  position: relative;
  width: 100%;
  height: 100%; /* 填满父容器 */
  overflow: hidden; /* 不允许滚动 */
}

@media (min-width: 768px) {
  .container {
    height: 100%; /* 桌面端填满父容器 */
  }
}
</style>
