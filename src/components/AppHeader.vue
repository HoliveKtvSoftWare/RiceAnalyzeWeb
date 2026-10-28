<template>
  <header class="app-header">
    <div class="header-left">
      <span class="header-title">{{ pageTitle }}</span>
      <span class="header-sep" aria-hidden="true"></span>
      <span class="header-subtitle">{{ t('水稻微表型结构分割平台') }}</span>
    </div>

    <div class="user-info" v-if="authStore.isAuthenticated">
      <div
        class="dropdown"
        ref="dropdownRef"
        @click="openDropdown"
        @mouseenter="handleMouseEnter"
        @mouseleave="handleMouseLeave"
      >
        <button class="dropdown-trigger" type="button" aria-haspopup="menu">
          <span class="avatar">{{ avatarInitial }}</span>
          <span class="user-name">{{ authStore.user?.email || t('用户') }}</span>
          <svg class="dropdown-arrow" :class="{ open: isDropdownOpen }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        <transition name="dropdown">
          <div class="dropdown-menu" v-show="isDropdownOpen" role="menu">
            <div class="menu-header">
              <div class="menu-avatar">{{ avatarInitial }}</div>
              <div class="menu-user">
                <div class="menu-email">{{ authStore.user?.email || t('用户') }}</div>
                <div class="menu-badge">{{ t('已登录') }}</div>
              </div>
            </div>
            <div class="menu-divider"></div>
            <button class="dropdown-item" role="menuitem" @click.stop="goToUserCenter">
              <span class="item-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="8.5" r="3.5" /><path d="M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6" />
                </svg>
              </span>
              <span>{{ t('用户中心') }}</span>
            </button>
            <button class="dropdown-item logout-btn" role="menuitem" @click.stop="handleLogout">
              <span class="item-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><polyline points="10 8 14 12 10 16" /><path d="M14 12H4" />
                </svg>
              </span>
              <span>{{ t('退出登录') }}</span>
            </button>
          </div>
        </transition>
      </div>
    </div>

    <div class="user-info" v-else>
      <button class="primary login-button" type="button" @click="goToLogin">{{ t('登录') }}</button>
    </div>
  </header>
</template>

<script setup>
import { useI18n } from '@/i18n';

const { t } = useI18n();
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useRoute, useRouter } from 'vue-router';

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();
const isDropdownOpen = ref(false);
const dropdownOpenSource = ref(null);
const dropdownRef = ref(null);
let hoverCloseTimer = null;

const PAGE_TITLES = {
  home: '首页',
  stem: '水稻茎秆分析',
  'flag-leaf': '水稻剑叶分析',
  'user-center': '用户中心',
  login: '登录',
  register: '注册',
};

const pageTitle = computed(() => t(PAGE_TITLES[route.name] || '水稻表型分析'));

const avatarInitial = computed(() => {
  const email = authStore.user?.email || 'U';
  return email.charAt(0).toUpperCase();
});

const openDropdown = () => {
  dropdownOpenSource.value = 'click';
  isDropdownOpen.value = !isDropdownOpen.value;
  clearTimeout(hoverCloseTimer);
};

const handleMouseEnter = () => {
  clearTimeout(hoverCloseTimer);
  if (!isDropdownOpen.value) {
    dropdownOpenSource.value = 'hover';
    isDropdownOpen.value = true;
  }
};

const handleMouseLeave = () => {
  clearTimeout(hoverCloseTimer);
  hoverCloseTimer = setTimeout(() => {
    if (dropdownOpenSource.value === 'hover') {
      isDropdownOpen.value = false;
      dropdownOpenSource.value = null;
    }
  }, 150);
};

const closeDropdown = () => {
  isDropdownOpen.value = false;
  dropdownOpenSource.value = null;
  clearTimeout(hoverCloseTimer);
};

const handleClickOutside = (event) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
    closeDropdown();
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  clearTimeout(hoverCloseTimer);
});

const goToUserCenter = () => {
  closeDropdown();
  router.push('/user-center');
};

const handleLogout = async () => {
  closeDropdown();
  await authStore.logoutAction();
  router.push('/login');
};

const goToLogin = () => {
  router.push('/login');
};
</script>

<style scoped>
.app-header {
  position: relative;
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-shrink: 0;
  height: var(--header-height);
  padding: 0 28px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.header-title {
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

.header-sep {
  width: 1px;
  height: 14px;
  background: var(--color-border);
}

.header-subtitle {
  overflow: hidden;
  color: var(--color-text-muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-info {
  position: relative;
  flex-shrink: 0;
}

.dropdown {
  cursor: pointer;
}

.dropdown-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px 4px 4px;
  border: 1px solid transparent;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-text-secondary);
}

.dropdown-trigger:hover {
  border-color: var(--color-border);
  background: var(--color-surface-hover);
}

.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--color-primary-green-lightest);
  color: var(--color-primary-green-dark);
  font-size: 12px;
  font-weight: 600;
  transition: transform var(--transition-fast);
}

.dropdown-trigger:hover .avatar {
  transform: scale(1.06);
}

.user-name {
  max-width: 160px;
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropdown-arrow {
  width: 14px;
  height: 14px;
  color: var(--color-text-light);
  transition: transform var(--transition-normal);
}

.dropdown-arrow.open {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 1000;
  min-width: 232px;
  padding: 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-lg);
  transform-origin: top right;
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.99);
}

.menu-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
}

.menu-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-primary-green-lightest);
  color: var(--color-primary-green-dark);
  font-size: 13px;
  font-weight: 600;
}

.menu-user {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.menu-email {
  max-width: 170px;
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-badge {
  color: var(--color-text-muted);
  font-size: 11px;
}

.menu-divider {
  height: 1px;
  margin: 4px 0;
  background: var(--color-border-light);
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 400;
  text-align: left;
  justify-content: flex-start;
  transition: background-color var(--transition-fast), color var(--transition-fast),
    transform var(--transition-fast);
}

.dropdown-item:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
  transform: translateX(2px);
}

.item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--color-text-muted);
  transition: transform var(--transition-fast), color var(--transition-fast);
}

.dropdown-item:hover .item-icon {
  transform: scale(1.08);
}

.item-icon svg {
  width: 16px;
  height: 16px;
}

.dropdown-item.logout-btn {
  color: var(--color-error);
}

.dropdown-item.logout-btn .item-icon {
  color: var(--color-error);
}

.dropdown-item.logout-btn:hover {
  background: var(--color-error-light);
  color: var(--color-error);
}

.login-button {
  height: 32px;
  padding: 0 16px;
  border-radius: var(--radius-md);
}

@media (max-width: 900px) {
  .app-header {
    padding: 0 16px;
  }

  .header-sep,
  .header-subtitle,
  .user-name {
    display: none;
  }
}
</style>
