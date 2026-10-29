<template>
  <main class="data-center-view">
    <header class="view-header">
      <div class="header-text">
        <h1>{{ t('数据中心') }}</h1>
        <p class="view-subtitle">
          {{ t('查看并分别下载茎秆、剑叶分析生成的图片与 JSON 数据') }}
        </p>
      </div>
      <span class="archive-note" :title="t('仅展示已生成图片或 JSON 的已完成记录')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5" />
          <path d="M12 8h.01" />
        </svg>
        {{ t('掩膜图与 JSON ') }}
      </span>
    </header>

    <section class="data-console">
      <div class="console-toolbar">
        <div class="data-switch" role="tablist" :aria-label="t('数据类型')">
          <button
            type="button"
            role="tab"
            class="switch-button"
            :class="{ active: activeGroup === 'stem' }"
            :aria-selected="activeGroup === 'stem'"
            @click="activeGroup = 'stem'"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 20V11" />
              <path d="M12 11c0-3 2.4-5.5 5.5-5.5 0 3-2.4 5.5-5.5 5.5Z" />
              <path d="M12 14.5c0-3-2.4-5.5-5.5-5.5 0 3 2.4 5.5 5.5 5.5Z" />
              <path d="M8.5 20h7" />
            </svg>
            <span>{{ t('茎秆数据') }}</span>
            <span class="switch-count">{{ stemTotal }}</span>
          </button>

          <button
            type="button"
            role="tab"
            class="switch-button"
            :class="{ active: activeGroup === 'leaf' }"
            :aria-selected="activeGroup === 'leaf'"
            @click="activeGroup = 'leaf'"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M5 19C5 10.5 10 4.5 20 4c.5 9.5-5.5 15-15 15Z" />
              <path d="M5 19c2.5-4.5 6-8 11-10.5" />
            </svg>
            <span>{{ t('剑叶数据') }}</span>
            <span class="switch-count">{{ leafTotal }}</span>
          </button>
        </div>

        <div class="toolbar-actions">
          <div class="selection-actions" role="group" :aria-label="t('选择数据')">
            <button
              type="button"
              class="select-action"
              :disabled="!activeTotalCount"
              @click="selectAllActive"
            >
              {{ t('全选') }}
            </button>
            <button
              type="button"
              class="select-action"
              :disabled="!activeImageCount"
              @click="selectImagesActive"
            >
              {{ t('全选掩膜图') }}
            </button>
            <button
              type="button"
              class="select-action"
              :disabled="!activeJsonCount"
              @click="selectJsonActive"
            >
              {{ t('全选 JSON') }}
            </button>
            <button
              type="button"
              class="select-action"
              :disabled="!selectedCount"
              @click="clearSelectionActive"
            >
              {{ t('取消全选') }}
            </button>
          </div>

          <button
            type="button"
            class="icon-button"
            :title="t('刷新数据')"
            :aria-label="t('刷新数据')"
            :disabled="store.loading[activeGroup]"
            @click="refreshActive"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              :class="{ spinning: store.loading[activeGroup] }"
              aria-hidden="true"
            >
              <path d="M20 7v5h-5" />
              <path d="M4 17v-5h5" />
              <path d="M6.1 9a7 7 0 0 1 11.3-2.3L20 12" />
              <path d="M17.9 15a7 7 0 0 1-11.3 2.3L4 12" />
            </svg>
          </button>

          <button
            type="button"
            class="primary download-button"
            :disabled="!selectedCount || store.downloading"
            @click="handleDownload"
          >
            <span v-if="store.downloading" class="button-spinner" aria-hidden="true"></span>
            <svg
              v-else
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M12 4v11" />
              <path d="m7.5 11 4.5 4.5 4.5-4.5" />
              <path d="M4 19h16" />
            </svg>
            <span v-if="store.downloading">{{ t('打包下载中…') }}</span>
            <span v-else-if="selectedCount">{{ t('下载选中（{n}）', { n: selectedCount }) }}</span>
            <span v-else>{{ t('下载选中') }}</span>
          </button>
        </div>
      </div>

      <div class="console-body">
        <div class="console-main">
          <Transition name="data-panel" mode="out-in">
            <StemData v-if="activeGroup === 'stem'" key="stem" />
            <FlagLeafData v-else key="leaf" />
          </Transition>
        </div>

        <SelectedMetricsPanel
          :items="selectedImages"
          :group="activeGroup"
          @notify="handlePanelNotify"
        />
      </div>
    </section>

    <Teleport to="body">
      <Transition name="toast-fade">
        <div v-if="toast.visible" class="toast-overlay" @click="hideToast">
          <div class="toast-content" :class="`toast-${toast.type}`" @click.stop>
            <span class="toast-icon">{{ toastIconMap[toast.type] }}</span>
            <span class="toast-message">{{ toast.message }}</span>
          </div>
        </div>
      </Transition>
    </Teleport>
  </main>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useI18n } from '@/i18n';
import { useDataCenterStore } from '@/stores/dataCenter';
import StemData from '@/components/data-center/StemData.vue';
import FlagLeafData from '@/components/data-center/FlagLeafData.vue';
import SelectedMetricsPanel from '@/components/data-center/SelectedMetricsPanel.vue';

const { t } = useI18n();
const store = useDataCenterStore();

const activeGroup = ref('stem');

const stemTotal = computed(() =>
  store.groupsFor('stem').reduce((sum, folder) => sum + folder.items.length, 0)
);
const leafTotal = computed(() =>
  store.groupsFor('leaf').reduce((sum, folder) => sum + folder.items.length, 0)
);
const selectedCount = computed(() => store.selectedCount(activeGroup.value));
const selectedImages = computed(() => store.selectedImageItems(activeGroup.value));

const activeItems = computed(() =>
  store.groupsFor(activeGroup.value).flatMap((folder) => folder.items)
);
const activeTotalCount = computed(() => activeItems.value.length);
const activeImageCount = computed(
  () => activeItems.value.filter((item) => item.kind === 'image').length
);
const activeJsonCount = computed(
  () => activeItems.value.filter((item) => item.kind === 'json').length
);

function selectAllActive() {
  store.selectAll(activeGroup.value);
}

function selectImagesActive() {
  store.selectImages(activeGroup.value);
}

function selectJsonActive() {
  store.selectJson(activeGroup.value);
}

function clearSelectionActive() {
  store.clearSelection(activeGroup.value);
}

function refreshActive() {
  store.fetchGroup(activeGroup.value, true);
}

async function handleDownload() {
  const result = await store.downloadSelected(activeGroup.value);
  if (!result) return;
  showToast(t('已开始下载 {name}', { name: result.filename }), 'success');
}

function handlePanelNotify({ message, type = 'success' }) {
  showToast(message, type);
}

// ---------------- Toast ----------------
const toast = reactive({ visible: false, message: '', type: 'success' });
const toastIconMap = { success: '✓', error: '✕', info: 'ℹ' };
let toastTimer = null;

function showToast(message, type = 'success', duration = 2200) {
  if (toastTimer) clearTimeout(toastTimer);
  toast.message = message;
  toast.type = type;
  toast.visible = true;
  toastTimer = setTimeout(() => {
    toast.visible = false;
    toastTimer = null;
  }, duration);
}

function hideToast() {
  toast.visible = false;
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
}

// 单条 JSON 下载成功后，store 会写一条 notice，这里统一转成 toast。
watch(
  () => store.notice?.id,
  () => {
    if (!store.notice) return;
    showToast(store.notice.message, store.notice.type);
    store.clearNotice();
  }
);

onMounted(() => {
  // 两个数据类型都预取一次，切换按钮上的数量才不会先显示 0。
  store.fetchGroup('stem', true);
  store.fetchGroup('leaf', true);
});

onUnmounted(() => {
  if (toastTimer) clearTimeout(toastTimer);
});
</script>

<style scoped>
.data-center-view {
  max-width: 1240px;
  margin: 0 auto;
  padding: 4px 0 28px;
  animation: fadeInUp 220ms ease backwards;
}

/* ==================== 页头 ==================== */
.view-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 18px;
}

.header-text h1 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.view-subtitle {
  margin: 4px 0 0;
  color: var(--color-text-muted);
  font-size: 12.5px;
}

.archive-note {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 5px;
  margin-bottom: 2px;
  padding: 4px 9px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 11.5px;
  white-space: nowrap;
}

.archive-note svg {
  width: 13px;
  height: 13px;
  color: var(--color-primary-green-dark);
}

/* ==================== 数据控制台 ==================== */
.data-console {
  /* 不要用 overflow:hidden：它会创建滚动容器，让内部 sticky 工具栏失效 */
  overflow: visible;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-background);
}

.console-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  background: var(--color-surface);
}

.data-switch {
  display: inline-flex;
  flex-shrink: 0;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface-muted);
}

.switch-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-muted);
  font-size: 12.5px;
  font-weight: 500;
  transition: background-color var(--transition-fast), color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.switch-button:hover:not(.active) {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}

.switch-button.active {
  background: var(--color-surface);
  color: var(--color-primary-green-dark);
  box-shadow: var(--shadow-xs);
}

.switch-button svg {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}

.switch-count {
  min-width: 19px;
  padding: 0 5px;
  border-radius: var(--radius-full);
  background: var(--color-surface-hover);
  color: var(--color-text-light);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
  line-height: 16px;
  text-align: center;
  transition: background-color var(--transition-fast), color var(--transition-fast);
}

.switch-button.active .switch-count {
  background: var(--color-primary-green-lightest);
  color: var(--color-primary-green-dark);
}

.toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  flex-shrink: 0;
  gap: 8px;
}

.selection-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface-muted);
}

.select-action {
  height: 28px;
  padding: 0 8px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  font-size: 11.5px;
  font-weight: 500;
}

.select-action:hover:not(:disabled) {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}

.icon-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-muted);
}

.icon-button:hover:not(:disabled) {
  border-color: var(--color-border-strong);
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}

.icon-button svg {
  width: 15px;
  height: 15px;
}

.icon-button svg.spinning {
  animation: spin 0.9s linear infinite;
}

.download-button {
  height: 34px;
  padding: 0 14px;
  font-size: 12.5px;
}

.download-button svg {
  width: 15px;
  height: 15px;
}

.button-spinner {
  width: 12px;
  height: 12px;
  border: 1.5px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.console-body {
  /* 数据条 / 表型面板共用的高度上限：
     预留页面标题、工具栏、间距后，让整页刚好不产生第二个页面滚动条 */
  --data-area-max-height: clamp(240px, calc(100vh - 350px), 720px);
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 16px;
  align-items: start;
  min-height: 420px;
  padding: 16px;
  border-radius: 0 0 var(--radius-xl) var(--radius-xl);
}

.console-main {
  min-width: 0;
}

/* ==================== 面板切换 ==================== */
.data-panel-enter-active,
.data-panel-leave-active {
  transition: opacity 140ms ease, transform 160ms ease;
}

.data-panel-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.data-panel-leave-to {
  opacity: 0;
  transform: translateY(-2px);
}

/* ==================== Toast（与茎秆 / 剑叶页一致） ==================== */
.toast-overlay {
  position: fixed;
  right: 0;
  bottom: 28px;
  left: 0;
  z-index: 3000;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.toast-content {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-lg);
  color: var(--color-text-secondary);
  font-size: 12.5px;
  animation: fadeInUp 160ms ease backwards;
}

.toast-icon {
  font-size: 13px;
  font-weight: 700;
}

.toast-success .toast-icon {
  color: var(--color-success);
}

.toast-error .toast-icon {
  color: var(--color-error);
}

.toast-info .toast-icon {
  color: var(--color-info);
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 140ms ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
}

@media (max-width: 1100px) {
  .console-body {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 760px) {
  .view-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }

  .archive-note {
    margin-bottom: 0;
  }

  .console-toolbar {
    align-items: stretch;
    flex-direction: column;
    gap: 10px;
  }

  .data-switch {
    width: 100%;
  }

  .switch-button {
    flex: 1;
    justify-content: center;
  }

  .toolbar-actions {
    justify-content: stretch;
  }

  .download-button {
    flex: 1;
  }

  .console-body {
    padding: 12px;
  }
}
</style>
