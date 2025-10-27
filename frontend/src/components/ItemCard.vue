<script setup lang="ts">
import {useDrop} from "vue3-dnd";
import {ItemTypes} from "@/components/ItemTypes";
import {DragItem} from "@/components/interfaces";
import {useBoxesStore} from "@/stores/useBoxesStore";
import request from "@/utils/request";
import {useResourcesStore} from "@/stores/useResourcesStore";
import {useUserStore} from "@/stores/useUserStore";
import {useNotificationStore} from "@/stores/useNotificationStore";
import {storeToRefs} from "pinia";
import {twMerge} from "tailwind-merge";
import {ref} from "vue";

const props = defineProps<{
  word_cn: string;
  word_en: string;
  emoji: string;
  elementId: string;
  id: string;
  size: 'small' | 'large';
  discoverer_name?: string;
}>()

const store = useBoxesStore()
const {removeBox, addBox} = store
const {resources} = storeToRefs(useResourcesStore())
const {addResource} = useResourcesStore()
const userStore = useUserStore()
const notificationStore = useNotificationStore()

// 双击显示详情
const showDetails = ref(false)
const elementDetails = ref<any>(null)

// 错误提示弹窗
const showError = ref(false)
const errorMessage = ref('')

// 防止拖动时触发双击
let isDragging = false
let dragTimeout: any = null

async function handleDoubleClick() {
  if (!isDragging) {
    // 只在 large 尺寸（合成区）处理双击，复制元素
    if (props.size === 'large') {
      duplicateElement()
    }
    // small 尺寸（仓库区）不处理双击，使用长按或右键查看详情
  }
}

// 复制元素（向右下角偏移）
function duplicateElement() {
  const currentBox = store.boxes[props.id]
  if (currentBox) {
    // 向右下角偏移 30px
    const offsetX = 30
    const offsetY = 30
    
    addBox({
      elementId: currentBox.elementId,
      word_cn: currentBox.word_cn,
      word_en: currentBox.word_en,
      emoji: currentBox.emoji,
      discoverer_name: currentBox.discoverer_name,
      left: currentBox.left + offsetX,
      top: currentBox.top + offsetY
    })
  }
}

function handleMouseDown() {
  isDragging = false
  dragTimeout = setTimeout(() => {
    isDragging = true
  }, 150)
}

function handleMouseUp() {
  clearTimeout(dragTimeout)
  setTimeout(() => {
    isDragging = false
  }, 200)
}

async function loadElementDetails() {
  try {
    const response = await request.get(`/elements/${props.elementId}/details`)
    elementDetails.value = response.data
    showDetails.value = true
  } catch (err) {
    console.error('加载元素详情失败', err)
  }
}

function showErrorDialog(message: string) {
  errorMessage.value = message
  showError.value = true
  setTimeout(() => {
    showError.value = false
  }, 3000)
}

const [, drop] = useDrop(() => ({
  accept: ItemTypes.BOX,
  canDrop: () => props.size === 'large', // Only large boxes in the craft area can be drop targets
  async drop(item: DragItem, monitor) {
    // 标记正在进行拖动操作，防止触发双击
    isDragging = true
    
    if (item.id !== props.id) {
      const droppedId = item?.id;
      const secondElementId = store.boxes[droppedId]?.elementId ?? item?.elementId
      
      // 保存原始位置用于失败时恢复
      const droppedBox = droppedId ? {...store.boxes[droppedId]} : null
      
      if(droppedId){
        removeBox(droppedId);
      }
      store.boxes[props.id].loading = true
      
      try {
        const response = await request.post('/craft', {
          firstElementId: store.boxes[props.id].elementId,
          secondElementId: secondElementId
        })

        if (response.data.success) {
          const element = response.data.element
          
          addBox({
            elementId: element.id,
            word_cn: element.word_cn,
            word_en: element.word_en,
            emoji: element.emoji,
            discoverer_name: element.discoverer_name,
            left: store.boxes[props.id].left,
            top: store.boxes[props.id].top
          })
          
          // 添加到资源列表
          if(!resources.value.find((resource) => resource.id === element.id)){
            addResource({
              id: element.id,
              word_cn: element.word_cn,
              word_en: element.word_en,
              emoji: element.emoji,
              discoverer_name: element.discoverer_name
            })
          }
          
          // 如果是首次发现，显示提示
          if (response.data.isNew) {
            console.log(`🎉 首次发现新元素: ${element.word_cn}!`)
          }
          
          removeBox(props.id);
        } else {
          // 合成失败，恢复元素位置
          store.boxes[props.id].loading = false
          if (droppedBox) {
            addBox(droppedBox)
          }
          showErrorDialog('合成失败，请重试')
        }
      } catch (error: any) {
        console.error('合成失败', error)
        // 恢复元素位置
        store.boxes[props.id].loading = false
        if (droppedBox) {
          addBox(droppedBox)
        }
        if (error.response?.data?.error === '元素不存在') {
          notificationStore.showNotification(
              '元素不存在，合成配方已重置，请记录个人token后，点击右上角清除全部数据重新登陆',
              5000
          )
        } else {
          showErrorDialog('合成失败，请重试')
        }
      }
    }
    
    // 重置拖动标志
    setTimeout(() => {
      isDragging = false
    }, 300)
  },
}))

</script>
<template>
  <div>
    <div :ref="drop"
         @dblclick="handleDoubleClick"
         @mousedown="handleMouseDown"
         @mouseup="handleMouseUp"
         @contextmenu.prevent
         :class="twMerge(
           props.size === 'large' 
             ? 'text-base md:text-2xl space-x-1.5 md:space-x-2.5 py-1.5 md:py-2.5 px-2.5 md:px-4' 
             : 'space-x-1.5 px-3 py-1',
           'border-gray-200 bg-white shadow hover:bg-gray-100 cursor-pointer transition inline-flex items-center font-medium border rounded-lg select-none whitespace-nowrap touch-manipulation'
         )"
         style="-webkit-user-select: none; -webkit-touch-callout: none; user-select: none; -webkit-tap-highlight-color: transparent;">
      <span style="-webkit-user-drag: none; user-select: none;">
        {{ emoji }}
      </span>
      <span style="-webkit-user-drag: none; user-select: none;">
        {{ word_cn }}
      </span>
    </div>
    
    <!-- 元素详情弹窗 -->
    <div v-if="showDetails" @click="showDetails = false" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div @click.stop class="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-2xl font-semibold flex items-center space-x-2">
            <span>{{ elementDetails?.element?.emoji }}</span>
            <span>{{ elementDetails?.element?.word_cn }}</span>
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
            <div class="font-semibold text-gray-800">{{ elementDetails?.element?.word_en }}</div>
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
    
    <!-- 错误提示弹窗 -->
    <div v-if="showError" class="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-bounce">
      <div class="bg-red-500 text-white px-6 py-3 rounded-lg shadow-xl flex items-center space-x-2">
        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
        <span class="font-semibold">{{ errorMessage }}</span>
      </div>
    </div>
  </div>

</template>

<style scoped>

</style>