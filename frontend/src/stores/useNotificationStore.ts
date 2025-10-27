import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useNotificationStore = defineStore('notification', () => {
  const message = ref('')
  const show = ref(false)
  const duration = ref(2000)

  function showNotification(msg: string, timeout: number = 3000) {
    message.value = msg
    show.value = true
    duration.value = timeout
    setTimeout(() => {
      show.value = false
    }, duration.value)
  }

  return { message, show, showNotification }
})
