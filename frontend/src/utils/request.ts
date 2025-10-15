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
    const userStore = useUserStore()
    const token = userStore.getToken()
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
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

