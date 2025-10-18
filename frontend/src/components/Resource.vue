<script setup lang="ts">
import { useDrag } from 'vue3-dnd'
import { ItemTypes } from './ItemTypes'
import { toRefs } from '@vueuse/core'
import ItemCard from "@/components/ItemCard.vue";
import { useBoxesStore } from '@/stores/useBoxesStore'
import { ref, watch } from 'vue'
import request from '@/utils/request'

const props = defineProps<{
  id: string
  emoji: string
  name_cn: string
  name_en: string
  discoverer_name?: string
}>()

const boxesStore = useBoxesStore()

const [collect, drag, preview] = useDrag(() => ({
  type: ItemTypes.BOX,
  item: { 
    elementId: props.id,
    name_cn: props.name_cn,
    name_en: props.name_en,
    emoji: props.emoji,
    discoverer_name: props.discoverer_name
  },
  collect: monitor => ({
    isDragging: monitor.isDragging(),
  }),
}))
const { isDragging } = toRefs(collect)

// 元素详情
const showDetails = ref(false)
const elementDetails = ref<any>(null)

// 长按检测
let longPressTimer: any = null
watch(isDragging, (newValue) => {
  // If dragging starts, clear the long-press timer
  if (newValue && longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
})

// 单击事件：将元素放置到工作区中心区域的随机位置
// click 事件只在真正的单击时触发，拖动不会触发
function handleClick(event: MouseEvent) {
  // 获取工作区容器尺寸
  // 中心区域：50%宽度和50%高度
  const isMobile = window.innerWidth < 768
  const containerWidth = isMobile ? window.innerWidth * 0.9 : window.innerWidth * 0.7 // 工作区宽度
  const containerHeight = isMobile ? (window.innerHeight - 35 * window.innerHeight / 100 - 100) : window.innerHeight * 0.7 // 工作区高度
  
  // 中心区域的范围（25%-75%）
  const centerWidth = containerWidth * 0.5
  const centerHeight = containerHeight * 0.5
  const offsetLeft = containerWidth * 0.25
  const offsetTop = containerHeight * 0.25
  
  // 在中心区域内生成随机位置
  const randomLeft = Math.floor(Math.random() * centerWidth) + offsetLeft
  const randomTop = Math.floor(Math.random() * centerHeight) + offsetTop
  
  // 添加元素到工作区
  boxesStore.addBox({
    elementId: props.id,
    name_cn: props.name_cn,
    name_en: props.name_en,
    emoji: props.emoji,
    discoverer_name: props.discoverer_name,
    left: randomLeft,
    top: randomTop
  })
}

// 显示元素详情（通用函数）
async function showElementDetails() {
  try {
    const response = await request.get(`/elements/${props.id}/details`)
    elementDetails.value = response.data
    showDetails.value = true
  } catch (err) {
    console.error('加载元素详情失败', err)
  }
}

// 右键点击 - 直接显示详情
function handleContextMenu(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  showElementDetails()
}

// 鼠标按下 - 开始长按计时
function handleMouseDown(event: MouseEvent) {
  // 只响应左键
  if (event.button !== 0) return

  longPressTimer = setTimeout(() => {
    // A safeguard in case the timer fires simultaneously with the drag start
    if (!isDragging.value) {
      showElementDetails()
    }
  }, 1000)
}

// 鼠标释放 - 清除计时器
function handleMouseUp() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

// 触摸开始 - 开始长按计时
function handleTouchStart() {
  longPressTimer = setTimeout(() => {
    // A safeguard in case the timer fires simultaneously with the drag start
    if (!isDragging.value) {
      showElementDetails()
    }
  }, 1000)
}

// 触摸结束 - 清除计时器
function handleTouchEnd() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}
</script>

<template>
  <div>
    <div
        class="inline-block cursor-pointer touch-manipulation"
        :ref="preview"
        role="Box"
        data-testid="box"
        @click="handleClick"
        @contextmenu="handleContextMenu"
        @mousedown="handleMouseDown"
        @mouseup="handleMouseUp"
        @mouseleave="handleMouseUp"
        @touchstart.passive="handleTouchStart"
        @touchend.passive="handleTouchEnd"
        @touchcancel.passive="handleTouchEnd"
        :style="{ 
          opacity: isDragging ? 0 : 1,
          webkitUserSelect: 'none',
          webkitTouchCallout: 'none',
          userSelect: 'none',
          webkitTapHighlightColor: 'transparent',
          touchAction: 'none'
        }"
    >
      <div :ref="drag" style="width: 100%; height: 100%">
      <ItemCard 
        :id="id"
        :element-id="id"
        :name_cn="name_cn"
        :name_en="name_en"
        :emoji="emoji"
        :discoverer_name="discoverer_name"
        size="small"
      />
      </div>
    </div>
    
    <!-- 元素详情弹窗 -->
    <div v-if="showDetails" @click="showDetails = false" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div @click.stop class="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-2xl font-semibold flex items-center space-x-2">
            <span>{{ elementDetails?.element?.emoji }}</span>
            <span>{{ elementDetails?.element?.name_cn }}</span>
          </h3>
          <button @click="showDetails = false" class="text-gray-400 hover:text-gray-600">
            <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
        
        <div class="space-y-3">
          <div class="bg-gray-50 rounded-lg p-3">
            <div class="text-xs text-gray-500 mb-1">英文标签</div>
            <div class="font-semibold text-gray-800">{{ elementDetails?.element?.name_en }}</div>
          </div>
          
          <div v-if="elementDetails?.element?.discoverer_name" class="bg-gray-50 rounded-lg p-3">
            <div class="text-xs text-gray-500 mb-1">首次发现者</div>
            <div class="font-semibold text-gray-800">{{ elementDetails?.element?.discoverer_name }}</div>
          </div>
          
          <div v-if="elementDetails?.discovery" class="bg-sky-50 border border-sky-200 rounded-lg p-3">
            <div class="text-xs text-sky-700 font-semibold mb-2">首次发现配方</div>
            <div class="flex items-center space-x-2 text-sm">
              <span class="flex items-center space-x-1">
                <span>{{ elementDetails.discovery.first_element_emoji }}</span>
                <span>{{ elementDetails.discovery.first_element_cn }}</span>
              </span>
              <span class="text-gray-400">+</span>
              <span class="flex items-center space-x-1">
                <span>{{ elementDetails.discovery.second_element_emoji }}</span>
                <span>{{ elementDetails.discovery.second_element_cn }}</span>
              </span>
            </div>
            <div class="text-xs text-gray-500 mt-1">
              发现者: {{ elementDetails.discovery.discoverer_name }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>