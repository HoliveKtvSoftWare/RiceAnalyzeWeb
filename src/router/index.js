import { createRouter, createWebHistory } from 'vue-router';
import LoginView from '../views/LoginView.vue';
import HomeView from '../views/HomeView.vue';
import { useAuthStore } from '@/stores/auth';

// 说明：Home / Login 是首屏必经页面，直接同步引入；
// 其余页面（StemView 单文件就有 70KB+，含大量样式）改为按需加载，
// 首屏 JS 体积大幅减小，页面的首次可交互时间明显提前。
const StemView = () => import('../views/StemView.vue');
const FlagLeafView = () => import('../views/FlagLeafView.vue');
const DataCenterView = () => import('../views/DataCenterView.vue');
const UserCenterView = () => import('../views/UserCenterView.vue');
const RegisterView = () => import('../views/RegisterView.vue');

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { requiresAuth: false }
    },
    {
      path: '/register',
      name: 'register',
      component: RegisterView,
      meta: { requiresAuth: false }
    },
    {
      // 首页：路由路径为 /home
      path: '/home',
      name: 'home',
      component: HomeView,
      meta: { requiresAuth: false }
    },
    {
      // 兼容旧地址：访问根路径时跳到 /home
      path: '/',
      redirect: '/home'
    },
    {
      path: '/stem',
      name: 'stem',
      component: StemView,
      meta: { requiresAuth: true }
    },
    {
      path: '/flag-leaf',
      name: 'flag-leaf',
      component: FlagLeafView,
      meta: { requiresAuth: true }
    },
    {
      path: '/data-center',
      name: 'data-center',
      component: DataCenterView,
      meta: { requiresAuth: true }
    },
    {
      path: '/user-center',
      name: 'user-center',
      component: UserCenterView,
      meta: { requiresAuth: true }
    }
  ]
});

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();

  const requiresAuth = to.meta.requiresAuth;
  const isAuthenticated = authStore.isAuthenticated;

  if (requiresAuth && !isAuthenticated) {
    next({ name: 'login' });
  } else if (!requiresAuth && isAuthenticated && (to.name === 'login' || to.name === 'register')) {
    next({ name: 'home' });
  } else {
    next();
  }
});

export default router;
