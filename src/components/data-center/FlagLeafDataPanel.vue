<template>
  <!-- 剑叶数据列表区域 -->
  <section class="data-section">
    <header class="section-head">
      <p class="section-summary">
        <span class="summary-strong">{{ t('{n} 个文件夹', { n: groups.length }) }}</span>
        <span class="summary-sep">·</span>
        <span>{{ t('{n} 张图片', { n: imageCount }) }}</span>
        <span class="summary-sep">·</span>
        <span>{{ t('{n} 个 JSON', { n: jsonCount }) }}</span>
        <span v-if="selectedCount" class="summary-selected">
          {{ t('已选择 {n} 项', { n: selectedCount }) }}
        </span>
      </p>
    </header>

    <p v-if="store.errors.leaf" class="error-message" role="alert">
      <span>{{ store.errors.leaf }}</span>
      <button type="button" class="error-retry" @click="retry">{{ t('重试') }}</button>
    </p>

    <DataFolderList
      :groups="groups"
      :selected-keys="store.selectedKeys.leaf"
      :loading="store.loading.leaf"
      :downloading-json-key="store.downloadingJsonKey || ''"
      :empty-title="t('暂无剑叶数据')"
      :empty-hint="t('完成剑叶分析后，图片与 JSON 会分开归档到这里，可分别勾选和下载。')"
      @toggle-item="(key) => store.toggleItem('leaf', key)"
      @toggle-group="(keys) => store.toggleGroup('leaf', keys)"
      @download-json="(item) => store.downloadJson('leaf', item)"
    />
  </section>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useI18n } from '@/i18n';
import { useDataCenterStore } from '@/stores/dataCenter';
import DataFolderList from './DataFolderList.vue';

const { t } = useI18n();
const store = useDataCenterStore();

const groups = computed(() => store.groupsFor('leaf'));
const imageCount = computed(() =>
  groups.value.reduce(
    (sum, folder) => sum + folder.items.filter((item) => item.kind === 'image').length,
    0
  )
);
const jsonCount = computed(() =>
  groups.value.reduce(
    (sum, folder) => sum + folder.items.filter((item) => item.kind === 'json').length,
    0
  )
);
const selectedCount = computed(() => store.selectedCount('leaf'));

function retry() {
  store.fetchGroup('leaf', true);
}

onMounted(() => {
  store.fetchGroup('leaf');
});
</script>

<style scoped>
.data-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 2px;
}

.section-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--color-text-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.summary-strong {
  color: var(--color-text-secondary);
  font-weight: 500;
}

.summary-sep {
  color: var(--color-text-light);
}

.summary-selected {
  margin-left: 4px;
  padding: 1px 7px;
  border-radius: var(--radius-full);
  background: var(--color-primary-green-lightest);
  color: var(--color-primary-green-dark);
  font-size: 11px;
  font-weight: 500;
}

.error-message {
  justify-content: space-between;
  margin: 0;
}

.error-retry {
  flex-shrink: 0;
  padding: 2px 8px;
  border: 1px solid rgba(220, 38, 38, 0.25);
  background: transparent;
  color: var(--color-error);
  font-size: 11.5px;
}

.error-retry:hover:not(:disabled) {
  background: rgba(220, 38, 38, 0.06);
}
</style>
