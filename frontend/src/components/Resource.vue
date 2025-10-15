<script setup lang="ts">
import { useDrag } from 'vue3-dnd'
import { ItemTypes } from './ItemTypes'
import { toRefs } from '@vueuse/core'
import ItemCard from "@/components/ItemCard.vue";

const props = defineProps<{
  id: string
  emoji: string
  name_cn: string
  name_en: string
  discoverer_name?: string
}>()

const [collect, drag] = useDrag(() => ({
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
</script>

<template>
  <div
      class="inline-block"
      :ref="drag"
      role="Box"
      data-testid="box"
  >
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
</template>

<style scoped>

</style>