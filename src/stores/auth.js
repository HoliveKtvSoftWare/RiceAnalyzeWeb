import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authService } from '@/services/authService'; 

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('authToken') || null);
  const user = ref(JSON.parse(localStorage.getItem('authUser')) || null);

  const isAuthenticated = computed(() => !!token.value);
  const userQuota = computed(() => user.value?.quota);

  async function fetchUser() {
    if (token.value) {
      try {
        const userData = await authService.getUserProfile();
        user.value = userData;
        localStorage.setItem('authUser', JSON.stringify(userData));
        console.log('User info updated in store:', user.value);
      } catch (error) {
        console.error('Failed to fetch user in store action:', error);
        await logoutAction();
      }
    } else {
      console.warn('Attempted to fetch user without a token.');
    }
  }

  async function loginAction(email, password) {
    try {
      const data = await authService.login(email, password);
      if (data.access_token) {
        token.value = data.access_token;
        localStorage.setItem('authToken', data.access_token);
        await fetchUser();
        console.log('Login successful, token and user info stored.');
        return true; 
      } else {
        console.error('Login response missing access_token:', data);
        await logoutAction(); 
        return false;
      }
    } catch (error) {
      console.error('Login action failed:', error);
      await logoutAction(); 
      return false; 
    }
  }

  async function registerAction(userData) {
    try {
      const registeredUser = await authService.register(userData);
      console.log('Registration successful:', registeredUser);
      return true; 
    } catch (error) {
      console.error('Register action failed:', error);
      return false; 
    }
  }

  async function logoutAction() {
    console.log('Logging out...');
    try {
      const { useStemAnalysisStore } = await import('@/stores/stemAnalysis');
      useStemAnalysisStore().clearBatchProgress();
    } catch {   }
    token.value = null;
    user.value = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    console.log('Logout complete.');
  }

  async function tryAutoLogin() {
    if (token.value && !user.value) {
      console.log('Token found in localStorage, attempting to fetch user info...');
      await fetchUser();
    } else if (token.value && user.value) {
      console.log('User already loaded from localStorage.');
    } else {
      console.log('No token found, user needs to login.');
    }
  }

  return {
    token,
    user,
    isAuthenticated,
    userQuota, 
    loginAction,
    registerAction,
    logoutAction,
    fetchUser, 
    tryAutoLogin, 
  };
});