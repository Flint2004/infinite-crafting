<script setup lang="ts">
import {useDrop} from "vue3-dnd";
import {ItemTypes} from "@/components/ItemTypes";
import {DragItem} from "@/components/interfaces";
import {useBoxesStore} from "@/stores/useBoxesStore";
import request from "@/utils/request";
import {useResourcesStore} from "@/stores/useResourcesStore";
import {useUserStore} from "@/stores/useUserStore";
import {storeToRefs} from "pinia";
import {twMerge} from "tailwind-merge";

const props = defineProps<{
  name_cn: string;
  name_en: string;
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

const [, drop] = useDrop(() => ({
  accept: ItemTypes.BOX,
  async drop(item: DragItem, monitor) {
    if (item.id !== props.id) {
      const droppedId = item?.id;
      const secondElementId = store.boxes[droppedId]?.elementId ?? item?.elementId
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
            name_cn: element.name_cn,
            name_en: element.name_en,
            emoji: element.emoji,
            discoverer_name: element.discoverer_name,
            left: store.boxes[props.id].left,
            top: store.boxes[props.id].top
          })
          
          // 添加到资源列表
          if(!resources.value.find((resource) => resource.id === element.id)){
            addResource({
              id: element.id,
              name_cn: element.name_cn,
              name_en: element.name_en,
              emoji: element.emoji,
              discoverer_name: element.discoverer_name
            })
          }
          
          // 如果是首次发现，显示提示
          if (response.data.isNew) {
            console.log(`🎉 首次发现新元素: ${element.name_cn}!`)
          }
        }
      } catch (error) {
        console.error('合成失败', error)
      }
      
      removeBox(props.id);
    }
  },
}))

</script>
<template>
  <div :ref="drop"
       :class="twMerge(props.size === 'large' ? 'text-2xl space-x-2.5 py-2.5 px-4' : 'space-x-1.5 px-3 py-1','border-gray-200 bg-white shadow hover:bg-gray-100 cursor-pointer transition inline-block font-medium border rounded-lg ')">
    <span>
      {{ emoji }}
    </span>
    <span>
      {{ name_cn }}
    </span>
    <span v-if="discoverer_name && props.size === 'large'" class="text-xs text-gray-400">
      (发现者: {{ discoverer_name }})
    </span>
  </div>

</template>

<style scoped>

</style>