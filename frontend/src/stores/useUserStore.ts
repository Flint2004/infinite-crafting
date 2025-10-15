import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

export interface User {
    id: number
    username: string
    token: string
}

// 从 localStorage 读取初始值
function loadUserFromStorage(): User | null {
    try {
        const stored = localStorage.getItem('opencraft/user')
        if (stored) {
            const parsed = JSON.parse(stored)
            console.log('✅ Loaded user from localStorage:', parsed.username)
            return parsed
        }
    } catch (error) {
        console.error('❌ Failed to load user from localStorage:', error)
    }
    return null
}

// 保存到 localStorage
function saveUserToStorage(user: User | null) {
    try {
        if (user) {
            localStorage.setItem('opencraft/user', JSON.stringify(user))
            console.log('✅ Saved user to localStorage:', user.username)
        } else {
            localStorage.removeItem('opencraft/user')
            console.log('✅ Removed user from localStorage')
        }
    } catch (error) {
        console.error('❌ Failed to save user to localStorage:', error)
    }
}

export const useUserStore = defineStore('user', () => {
    const user = ref<User | null>(loadUserFromStorage())
    
    // 监听 user 变化并自动保存
    watch(user, (newUser) => {
        saveUserToStorage(newUser)
    }, { deep: true })
    
    function setUser(userData: User) {
        console.log('📝 Setting user:', userData.username)
        user.value = userData
    }
    
    function clearUser() {
        console.log('🗑️ Clearing user')
        user.value = null
    }
    
    function isLoggedIn() {
        return user.value !== null
    }
    
    function getToken() {
        return user.value?.token || ''
    }

    return { user, setUser, clearUser, isLoggedIn, getToken }
})

