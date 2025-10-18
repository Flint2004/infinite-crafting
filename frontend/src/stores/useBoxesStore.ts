import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import {reactive} from "vue";
import {useLocalStorage} from "@vueuse/core";

export interface BoxStoreEntry {
    top: number
    left: number
    elementId: string
    word_cn: string
    word_en: string
    emoji: string
    discoverer_name?: string
    loading?: boolean
}

export const useBoxesStore = defineStore('counter', () => {
  // 使用 LocalStorage 持久化合成区内容
  const boxes = reactive<{
    [key: string]: BoxStoreEntry
  }>(JSON.parse(localStorage.getItem('opencraft/boxes') || '{}'))

  // 监听变化并保存
  watch(boxes, (newValue) => {
    // 过滤掉 loading 状态后保存
    const toSave: any = {}
    Object.keys(newValue).forEach(key => {
      const {loading, ...rest} = newValue[key]
      toSave[key] = rest
    })
    localStorage.setItem('opencraft/boxes', JSON.stringify(toSave))
  }, { deep: true })

  function addBox(box: BoxStoreEntry) {
    const randomId = Math.random().toString(36).substr(2, 5)
    boxes[randomId] = box
  }

  function removeBox(id: string) {
    delete boxes[id]
  }
  
  function clearBoxes() {
    Object.keys(boxes).forEach(key => delete boxes[key])
  }

  return { boxes , removeBox, addBox, clearBoxes}
})
