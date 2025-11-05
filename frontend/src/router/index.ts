import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'
import GuessIndexView from '../views/GuessIndexView.vue'
import GuessView from '../views/GuessView.vue'
import CreateQuestionView from '../views/CreateQuestionView.vue'
import { useUserStore } from '@/stores/useUserStore'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { 
        requiresGuest: true,
        title: '登录'
      }
    },
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { 
        requiresAuth: true,
        title: '合成游戏'
      }
    },
    {
      path: '/guess',
      name: 'guess-index',
      component: GuessIndexView,
      meta: { 
        requiresAuth: true,
        title: '猜百科'
      }
    },
    {
      path: '/guess/:str',
      name: 'guess',
      component: GuessView,
      meta: { 
        requiresAuth: true,
        title: '猜百科'
      }
    },
    {
      path: '/create-question',
      name: 'create-question',
      component: CreateQuestionView,
      meta: { 
        requiresAuth: true,
        title: '创建题目'
      }
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue'),
      meta: { 
        requiresAuth: true,
        title: '关于'
      }
    }
  ]
})

// 路由守卫
router.beforeEach((to, from, next) => {
  const userStore = useUserStore()
  const isLoggedIn = userStore.isLoggedIn()
  
  // 设置页面标题
  const baseTitle = '深圳大学Minecraft荔方社'
  if (to.meta.title) {
    document.title = `${to.meta.title} - ${baseTitle}`
  } else {
    document.title = baseTitle
  }
  
  if (to.meta.requiresAuth && !isLoggedIn) {
    // 保存原始路径，登录后返回
    next({
      path: '/login',
      query: { redirect: to.fullPath }
    })
  } else if (to.meta.requiresGuest && isLoggedIn) {
    next('/')
  } else {
    next()
  }
})

export default router