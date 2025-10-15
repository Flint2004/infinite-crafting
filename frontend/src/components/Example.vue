<script setup lang="ts">
import Container from './Container.vue'
import { DndProvider } from 'vue3-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { TouchBackend } from 'react-dnd-touch-backend'
import { computed } from 'vue'

// 检测是否为触摸设备
const isTouchDevice = () => {
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-ignore
    navigator.msMaxTouchPoints > 0
  )
}

// 根据设备类型选择后端
const backend = computed(() => {
  return isTouchDevice() ? TouchBackend : HTML5Backend
})

// TouchBackend 选项
const touchBackendOptions = {
  enableMouseEvents: true, // 同时支持鼠标
  delayTouchStart: 0, // 立即开始拖拽，不需要长按
  delayMouseStart: 0, // 鼠标也立即开始
  ignoreContextMenu: true, // 忽略右键菜单
  touchSlop: 5, // 移动5px后才开始拖拽，避免误触
  enableHoverOutsideTarget: true, // 允许在目标外悬停
  enableTouchEvents: true, // 启用触摸事件
  scrollAngleRanges: undefined, // 允许所有方向拖动
  // 关键：启用触摸预览层
  getDropTargetElementsAtPoint: undefined,
  // 启用自定义拖拽层
  enableKeyboardEvents: false,
}

const backendOptions = computed(() => {
  return isTouchDevice() ? touchBackendOptions : undefined
})

</script>

<template>
  <div class="h-full overflow-hidden">
    <DndProvider :backend="backend" :options="backendOptions">
      <Container />
    </DndProvider>
  </div>
</template>
