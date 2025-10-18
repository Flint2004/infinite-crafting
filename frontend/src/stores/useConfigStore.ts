import { defineStore } from 'pinia'
import request from '@/utils/request'

export const useConfigStore = defineStore('config', {
  state: () => ({
    languageMode: 'both' // 'both', 'cn', 'en'
  }),
  actions: {
    async fetchConfig() {
      try {
        const response = await request.get('/config')
        if (response.data.languageMode) {
          this.languageMode = response.data.languageMode
          console.log('✅ Language mode loaded:', this.languageMode)
        }
      } catch (error) {
        console.error('Failed to fetch config:', error)
      }
    }
  },
  persist: true
})
