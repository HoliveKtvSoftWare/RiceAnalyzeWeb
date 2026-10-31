<template>
  <div id="app-layout">
    <transition name="layout-fade" mode="out-in">
      <div v-if="authStore.isAuthenticated" class="layout-with-sidebar">
        <AppSidebar ref="sidebarRef" @toggle-collapse="onSidebarToggle" />
        <div class="main-content-wrapper" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
          <AppHeader />
          <main class="page-content">
            <RouterView v-slot="{ Component, route: viewRoute }">
              <transition :key="viewRoute.fullPath" name="page-fade" mode="out-in">
                <component :is="Component" />
              </transition>
            </RouterView>
          </main>
        </div>
      </div>
      <div v-else-if="showPublicHeader" class="public-content-wrapper">
        <AppHeader />
        <main class="page-content">
          <RouterView v-slot="{ Component, route: viewRoute }">
            <transition :key="viewRoute.fullPath" name="page-fade" mode="out-in">
              <component :is="Component" />
            </transition>
          </RouterView>
        </main>
      </div>
      <div v-else class="full-page-wrapper">
        <RouterView v-slot="{ Component, route: viewRoute }">
          <transition :key="viewRoute.fullPath" name="page-fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </RouterView>
      </div>
    </transition>

    <!-- 全局批次分割进度浮层（独立于 layout 过渡，跨页面保持） -->
    <transition name="batch-progress-float">
      <div v-if="authStore.isAuthenticated && analysisStore.batchProgress.visible" class="batch-progress-float">
        <div class="batch-progress-card" :class="{ done: analysisStore.batchProgress.completed >= analysisStore.batchProgress.total }">
          <div class="batch-progress-title">
            <span class="batch-progress-spinner" :class="{ done: analysisStore.batchProgress.completed >= analysisStore.batchProgress.total }"></span>
            <span class="batch-progress-badge">{{ progressTypeLabel }}</span>
            <span>{{ analysisStore.batchProgress.completed >= analysisStore.batchProgress.total ? t('分割完成') : t('分割处理中') }}</span>
          </div>
          <span class="batch-progress-count">
            {{ Math.min(analysisStore.batchProgress.completed, analysisStore.batchProgress.total) }}/{{ analysisStore.batchProgress.total }}
          </span>
          <div class="batch-progress-track">
            <div
              class="batch-progress-fill"
              :class="{ done: analysisStore.batchProgress.completed >= analysisStore.batchProgress.total }"
              :style="{ width: analysisStore.batchProgressPercent + '%' }"
            ></div>
          </div>
          <span class="batch-progress-percent">{{ analysisStore.batchProgressPercent }}%</span>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue';
import { RouterView, useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import AppSidebar from '@/components/AppSidebar.vue'
import { useAuthStore } from '@/stores/auth';
import { useStemAnalysisStore } from '@/stores/stemAnalysis';
import { useI18n } from '@/i18n';

const { t } = useI18n();
const authStore = useAuthStore();
const analysisStore = useStemAnalysisStore();
const route = useRoute();

const sidebarRef = ref(null);
const sidebarCollapsed = ref(false);

const onSidebarToggle = (collapsed) => {
  sidebarCollapsed.value = collapsed;
};

const showPublicHeader = computed(() => {
  return route.meta.requiresAuth === false && route.name !== 'login' && route.name !== 'register';
});

const progressTypeLabel = computed(() => {
  const map = { stem: '茎秆', flag_leaf: '剑叶' };
  return map[analysisStore.batchProgress.type] ? t(map[analysisStore.batchProgress.type]) : '';
});

onMounted(async () => {
  await authStore.tryAutoLogin();
});
</script>

<style>
/* 应用外壳：浅色、无背景图、无毛玻璃 */
#app-layout {
  min-height: 100vh;
  background-color: var(--color-background);
}

.layout-with-sidebar {
  display: flex;
  min-height: 100vh;
  width: 100%;
}

.main-content-wrapper {
  flex: 1;
  min-width: 0;
  margin-left: var(--sidebar-width);
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-height: 100vh;
  max-height: 100vh;
  overflow: hidden;
  background-color: var(--color-background);
  transition: margin-left var(--transition-slow);
}

.main-content-wrapper.sidebar-collapsed {
  margin-left: var(--sidebar-width-collapsed);
}

.public-content-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  width: 100%;
}

.full-page-wrapper {
  min-height: 100vh;
  width: 100%;
}

.page-content {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 24px 28px 32px;
  overflow-y: auto;
  background: transparent;
  border: none;
  border-radius: 0;
  box-shadow: none;
  box-sizing: border-box;
}

@media (max-width: 900px) {
  .page-content {
    padding: 16px;
  }
}

/* 页面切换：只做淡入，不做位移，避免整页重绘。
   注意：布局层（layout-fade）不定义过渡 —— 首屏路由解析时认证分支会切换，
   若这里加 out-in 过渡，内容会被"离场"动画挡住，出现短暂空白。 */
.page-fade-enter-active {
  transition: opacity 140ms ease;
}

.page-fade-leave-active {
  transition: opacity 90ms ease;
}

.page-fade-enter-from,
.page-fade-leave-to {
  opacity: 0;
}

/* ==================== 全局批次进度：一条细进度条 ==================== */
.batch-progress-float {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  pointer-events: none;
}

.batch-progress-float-enter-active,
.batch-progress-float-leave-active {
  transition: opacity 140ms ease;
}

.batch-progress-float-enter-from,
.batch-progress-float-leave-to {
  opacity: 0;
}

.batch-progress-card {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 420px;
  max-width: 560px;
  padding: 10px 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

.batch-progress-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.batch-progress-badge {
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--color-accent-soft);
  color: var(--color-primary-green-dark);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0;
}

.batch-progress-spinner {
  width: 12px;
  height: 12px;
  border: 1.5px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

.batch-progress-spinner.done {
  position: relative;
  border: none;
  background: var(--color-success);
  animation: none;
}

.batch-progress-spinner.done::after {
  content: '';
  position: absolute;
  left: 3.5px;
  top: 1.5px;
  width: 3.5px;
  height: 6px;
  border: solid #fff;
  border-width: 0 1.5px 1.5px 0;
  transform: rotate(45deg);
}

.batch-progress-count {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.batch-progress-track {
  flex: 1;
  min-width: 80px;
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--color-surface-hover);
  overflow: hidden;
}

.batch-progress-fill {
  height: 100%;
  border-radius: var(--radius-full);
  background: var(--color-accent);
  transition: width var(--transition-slow);
}

.batch-progress-fill.done {
  background: var(--color-success);
}

.batch-progress-percent {
  flex-shrink: 0;
  min-width: 34px;
  text-align: right;
  font-size: 12px;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}
</style>
