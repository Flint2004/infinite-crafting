import axios from 'axios'
import { useUserStore } from '@/stores/useUserStore'

// 创建 axios 实例
const request = axios.create({
  baseURL: '/api', // 开发环境使用代理，生产环境需要配置完整URL
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    // 尝试从 store 获取 token
    let token = ''
    
    try {
      const userStore = useUserStore()
      token = userStore.getToken()
    } catch (error) {
      // 如果 store 还未初始化，直接从 localStorage 读取
      console.warn('Store not ready, reading from localStorage')
    }
    
    // 如果 store 中没有，直接从 localStorage 读取作为后备
    if (!token) {
      try {
        const userData = localStorage.getItem('opencraft/user')
        if (userData) {
          const user = JSON.parse(userData)
          token = user?.token || ''
        }
      } catch (error) {
        console.error('Failed to read token from localStorage:', error)
      }
    }
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
      console.log('✅ Request with token:', config.url, token.substring(0, 10) + '...')
    } else {
      console.warn('⚠️ Request without token:', config.url)
    }
    
    return config
  },
  (error) => {
    console.error('请求错误:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response
      
      // 401 未授权，跳转到登录页
      if (status === 401) {
        const userStore = useUserStore()
        userStore.clearUser()
        
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
      }
      
      console.error('响应错误:', data?.error || error.message)
    } else {
      console.error('网络错误:', error.message)
    }
    
    return Promise.reject(error)
  }
)

export default request

