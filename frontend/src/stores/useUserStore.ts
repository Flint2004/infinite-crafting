import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useLocalStorage } from "@vueuse/core";

export interface User {
    id: number
    username: string
    token: string
}

export const useUserStore = defineStore('user', () => {
    const user = useLocalStorage<User | null>('opencraft/user', null);
    
    function setUser(userData: User) {
        user.value = userData;
    }
    
    function clearUser() {
        user.value = null;
    }
    
    function isLoggedIn() {
        return user.value !== null;
    }
    
    function getToken() {
        return user.value?.token || '';
    }

    return { user, setUser, clearUser, isLoggedIn, getToken }
})

