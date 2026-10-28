<template>
  <aside class="app-sidebar" :class="{ collapsed }">
    <div class="sidebar-brand">
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 21V10" />
          <path d="M12 10c0-3.3 2.7-6 6-6 0 3.3-2.7 6-6 6Z" />
          <path d="M12 14c0-3.3-2.7-6-6-6 0 3.3 2.7 6 6 6Z" />
          <path d="M8.5 21h7" />
        </svg>
      </span>
      <span class="brand-text">{{ t('水稻表型分析') }}</span>
      <button
        class="collapse-btn"
        type="button"
        @click="toggleCollapse"
        :aria-label="collapsed ? t('展开侧边栏') : t('收起侧边栏')"
        :title="collapsed ? t('展开') : t('收起')"
      >
        <svg
          class="collapse-icon"
          :class="{ rotated: collapsed }"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
    </div>

    <nav class="sidebar-nav">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        :exact-active-class="'active-link'"
        class="nav-link"
        :title="t(item.label)"
      >
        <span class="nav-icon" v-html="item.icon"></span>
        <span class="nav-label">{{ t(item.label) }}</span>
      </router-link>
    </nav>

    <div class="sidebar-footer">
      <span class="footer-version" :title="buildTitle">
        v1.0.0<span v-if="buildLabel" class="footer-build"> · {{ buildLabel }}</span>
      </span>
    </div>
  </aside>
</template>

<script setup>
import { useI18n } from '@/i18n';

const { t } = useI18n();
import { ref, computed } from 'vue';

const emit = defineEmits(['toggle-collapse']);

const collapsed = ref(false);

// 构建时间（vite.config.js 通过 define 注入），用于确认浏览器加载的是最新产物
const rawBuildTime = typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : '';
const buildLabel = (() => {
  if (!rawBuildTime) return '';
  const date = new Date(rawBuildTime);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
})();
const buildTitle = computed(() => (rawBuildTime ? t('构建时间：{time}', { time: rawBuildTime }) : ''));

const toggleCollapse = () => {
  collapsed.value = !collapsed.value;
  emit('toggle-collapse', collapsed.value);
};

const icon = (paths) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

const navItems = ref([
  {
    path: '/home',
    label: '首页',
    icon: icon('<path d="M4 10.5 12 4l8 6.5" /><path d="M6 9.8V20h12V9.8" /><path d="M10 20v-5h4v5" />'),
  },
  {
    path: '/stem',
    label: '水稻茎秆',
    icon: icon('<path d="M12 20V11" /><path d="M12 11c0-3 2.4-5.5 5.5-5.5 0 3-2.4 5.5-5.5 5.5Z" /><path d="M12 14.5c0-3-2.4-5.5-5.5-5.5 0 3 2.4 5.5 5.5 5.5Z" /><path d="M8.5 20h7" />'),
  },
  {
    path: '/flag-leaf',
    label: '水稻剑叶',
    icon: icon('<path d="M5 19C5 10.5 10 4.5 20 4c.5 9.5-5.5 15-15 15Z" /><path d="M5 19c2.5-4.5 6-8 11-10.5" />'),
  },
  {
    path: '/user-center',
    label: '用户中心',
    icon: icon('<circle cx="12" cy="8.5" r="3.5" /><path d="M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6" />'),
  },
]);

defineExpose({ collapsed });
</script>

<style scoped>
.app-sidebar {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  width: var(--sidebar-width);
  height: 100vh;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  overflow: hidden;
  transition: width var(--transition-slow);
}

.app-sidebar.collapsed {
  width: var(--sidebar-width-collapsed);
}

/* ---- 品牌区 ---- */
.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  height: var(--header-height);
  padding: 0 12px 0 16px;
  border-bottom: 1px solid var(--color-border-light);
}

.brand-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-md);
  background: var(--color-primary-green-lightest);
  color: var(--color-primary-green-dark);
}

.brand-mark svg {
  width: 18px;
  height: 18px;
}

.brand-text {
  flex: 1;
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
  white-space: nowrap;
  transition: opacity var(--transition-fast);
}

.collapse-btn {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-light);
}

.collapse-btn:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-secondary);
}

.collapse-icon {
  width: 15px;
  height: 15px;
  transition: transform var(--transition-normal);
}

.collapse-icon.rotated {
  transform: rotate(180deg);
}

.app-sidebar.collapsed .brand-text,
.app-sidebar.collapsed .brand-mark {
  display: none;
}

.app-sidebar.collapsed .sidebar-brand {
  justify-content: center;
  padding: 0;
  gap: 0;
}

/* ---- 导航 ---- */
.sidebar-nav {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  padding: 12px 10px;
  overflow-y: auto;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 10px;
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 400;
  text-decoration: none;
  white-space: nowrap;
  transition: background-color var(--transition-fast), color var(--transition-fast),
    transform var(--transition-fast);
}

.nav-link:hover {
  background: var(--color-sidebar-hover);
  color: var(--color-text-primary);
  text-decoration: none;
}

.nav-link:active {
  transform: scale(0.985);
}

.nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  color: var(--color-text-muted);
  transition: transform var(--transition-fast), color var(--transition-fast);
}

.nav-icon :deep(svg) {
  width: 18px;
  height: 18px;
}

.nav-link:hover .nav-icon {
  color: var(--color-text-secondary);
  transform: scale(1.08);
}

.nav-label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-link.active-link {
  background: var(--color-sidebar-active);
  color: var(--color-primary-green-dark);
  font-weight: 500;
  /* 切换路由时，当前项从左侧滑入，明确指示“当前位置”。
     用 backwards：动画结束后不保留 transform，避免盖住按下的缩放反馈。 */
  animation: navActiveIn 200ms ease backwards;
}

@keyframes navActiveIn {
  from {
    opacity: 0.6;
    transform: translateX(-3px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.nav-link.active-link .nav-icon {
  color: var(--color-primary-green);
}

.app-sidebar.collapsed .sidebar-nav {
  align-items: center;
  padding: 12px 8px;
}

.app-sidebar.collapsed .nav-link {
  justify-content: center;
  gap: 0;
  width: 40px;
  padding: 0;
}

.app-sidebar.collapsed .nav-label {
  display: none;
}

/* ---- 底部 ---- */
.sidebar-footer {
  flex-shrink: 0;
  padding: 12px 16px;
  border-top: 1px solid var(--color-border-light);
}

.footer-version {
  color: var(--color-text-light);
  font-size: 11px;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.footer-build {
  color: var(--color-text-light);
  font-variant-numeric: tabular-nums;
}

.app-sidebar.collapsed .footer-build {
  display: none;
}

.app-sidebar.collapsed .sidebar-footer {
  padding: 12px 0;
  text-align: center;
}

.app-sidebar.collapsed .footer-version {
  font-size: 10px;
}
</style>
