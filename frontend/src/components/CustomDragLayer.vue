<script setup lang="ts">
import { useDragLayer } from 'vue3-dnd'
import { toRefs } from '@vueuse/core'
import ItemCard from './ItemCard.vue'

const collect = useDragLayer((monitor) => ({
  item: monitor.getItem(),
  itemType: monitor.getItemType(),
  currentOffset: monitor.getSourceClientOffset(),
  isDragging: monitor.isDragging(),
}))

const { item, itemType, currentOffset, isDragging } = toRefs(collect)

function getItemStyles() {
  if (!currentOffset.value) {
    return {
      display: 'none',
    }
  }

  const { x, y } = currentOffset.value
  const transform = `translate(${x}px, ${y}px)`
  
  return {
    transform,
    WebkitTransform: transform,
    pointerEvents: 'none',
    position: 'fixed',
    top: 0,
    left: 0,
    zIndex: 9999,
  }
}
</script>

<template>
  <div v-if="isDragging && item" :style="getItemStyles()" class="drag-layer">
    <ItemCard 
      :id="item.id || item.elementId || ''"
      :element-id="item.elementId || item.id || ''"
      :word_cn="item.word_cn || ''"
      :word_en="item.word_en || ''"
      :emoji="item.emoji || ''"
      :discoverer_name="item.discoverer_name"
      :size="item.id && item.left !== undefined ? 'large' : 'small'"
      :style="{ opacity: 0.8 }"
    />
  </div>
</template>

<style scoped>
.drag-layer {
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
</style>

