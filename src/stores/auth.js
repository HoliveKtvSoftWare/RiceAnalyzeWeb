// src/stores/auth.js (包含获取用户信息和额度)

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authService } from '@/services/authService'; // 导入我们的认证服务
// import router from '@/router'; // 如果需要路由跳转，可以在这里导入

export const useAuthStore = defineStore('auth', () => {
  // --- State ---
  // 从 localStorage 初始化 token 和 user，实现持久化登录
  const token = ref(localStorage.getItem('authToken') || null);
  const user = ref(JSON.parse(localStorage.getItem('authUser')) || null);

  // --- Getters ---
  // 判断用户是否已登录
  const isAuthenticated = computed(() => !!token.value);
  // 获取用户额度 (使用可选链 ?. 防止 user 为 null 时报错)
  const userQuota = computed(() => user.value?.quota);

  // --- Actions ---

  // Action: 获取并设置当前用户信息
  async function fetchUser() {
    // 只有在 token 存在时才尝试获取用户信息
    if (token.value) {
      try {
        // 调用 authService 中的 getUserProfile 函数
        const userData = await authService.getUserProfile();
        // 更新 store 中的 user 状态
        user.value = userData;
        // 将用户信息（JSON 字符串）存入 localStorage
        localStorage.setItem('authUser', JSON.stringify(userData));
        console.log('User info updated in store:', user.value);
      } catch (error) {
        console.error('Failed to fetch user in store action:', error);
        // 获取用户信息失败通常意味着 token 无效或过期，执行登出
        await logoutAction();
      }
    } else {
      console.warn('Attempted to fetch user without a token.');
    }
  }

  // Action: 处理登录逻辑
  async function loginAction(email, password) {
    try {
      // 调用 authService 的 login 函数
      const data = await authService.login(email, password);
      if (data.access_token) {
        // 登录成功，更新 token 状态并存入 localStorage
        token.value = data.access_token;
        localStorage.setItem('authToken', data.access_token);
        // --- 登录成功后，调用 fetchUser 获取用户信息 ---
        await fetchUser();
        // --- 结束修改 ---
        console.log('Login successful, token and user info stored.');
        return true; // 表示登录成功
      } else {
        // 如果后端返回的数据结构不符合预期
        console.error('Login response missing access_token:', data);
        await logoutAction(); // 清理无效状态
        return false;
      }
    } catch (error) {
      console.error('Login action failed:', error);
      await logoutAction(); // 登录失败也清理状态
      return false; // 表示登录失败
    }
  }

  // Action: 处理注册逻辑
  async function registerAction(userData) {
    try {
      // 调用 authService 的 register 函数
      const registeredUser = await authService.register(userData);
      console.log('Registration successful:', registeredUser);
      // 注册成功后，不自动登录，提示用户去登录
      return true; // 表示注册成功
    } catch (error) {
      console.error('Register action failed:', error);
      return false; // 表示注册失败
    }
  }

  // Action: 处理登出逻辑
  async function logoutAction() {
    console.log('Logging out...');
    // 清除全局分割进度
    try {
      const { useStemAnalysisStore } = await import('@/stores/stemAnalysis');
      useStemAnalysisStore().clearBatchProgress();
    } catch { /* 忽略清理失败 */ }
    // 清除 Pinia store 中的状态
    token.value = null;
    user.value = null;
    // 清除 localStorage 中的持久化数据
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    console.log('Logout complete.');
  }

  // Action: 在应用加载时尝试根据 token 恢复会话
  async function tryAutoLogin() {
    // 检查 localStorage 中是否有 token 并且当前 store 中没有用户信息
    if (token.value && !user.value) {
      console.log('Token found in localStorage, attempting to fetch user info...');
      // 调用 fetchUser 尝试获取用户信息
      await fetchUser();
    } else if (token.value && user.value) {
      console.log('User already loaded from localStorage.');
    } else {
      console.log('No token found, user needs to login.');
    }
  }


  // --- 返回 store 的公共接口 ---
  return {
    // State refs
    token,
    user,
    // Computed getters
    isAuthenticated,
    userQuota, // <-- 导出额度 getter
    // Actions
    loginAction,
    registerAction,
    logoutAction,
    fetchUser, // <-- 导出 fetchUser (供调试或特殊场景使用)
    tryAutoLogin, // <-- 导出自动登录尝试
  };
});