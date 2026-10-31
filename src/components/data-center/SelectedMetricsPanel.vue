<template>
  <aside class="metrics-panel">
    <header class="panel-head">
      <div class="panel-title">
        <h2>{{ t('表型数据') }}</h2>
        <p class="panel-sub">
          <template v-if="items.length">
            {{ t('已选 {n} 张图片', { n: items.length }) }} · {{ t('单位') }} {{ UNIT_SYMBOL }}
          </template>
          <template v-else>{{ t('勾选图片后显示') }}</template>
        </p>
      </div>
      <button
        type="button"
        class="primary export-button"
        :disabled="!items.length || excelStore.isLoading"
        :title="t('下载数据')"
        @click="exportExcel"
      >
        <span v-if="excelStore.isLoading" class="export-spinner" aria-hidden="true"></span>
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
        <span>{{ excelStore.isLoading ? t('导出中…') : t('下载数据') }}</span>
      </button>
    </header>

    <div class="panel-body">
      <p v-if="exportError" class="panel-alert" role="alert">{{ exportError }}</p>

      <div v-if="!items.length" class="panel-empty">
        <span class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19V5" />
            <path d="M4 19h16" />
            <path d="M8 16v-4" />
            <path d="M12 16V8" />
            <path d="M16 16v-6" />
          </svg>
        </span>
        <h3>{{ t('暂无表型数据') }}</h3>
        <p>{{ t('勾选左侧图片后，这里会显示对应的表型数据。') }}</p>
      </div>

      <div v-else-if="loading" class="panel-loading">
        <span class="loading-spinner" aria-hidden="true"></span>
        <span>{{ t('表型数据加载中…') }}</span>
      </div>

      <template v-else>
        <p v-if="loadError" class="panel-alert" role="alert">{{ loadError }}</p>

        <article v-for="item in previewItems" :key="item.key" class="sample-card">
          <header class="sample-head">
            <strong class="sample-name" :title="item.record?.originalFilename || itemName(item)">
              {{ itemName(item) }}
            </strong>
            <span v-if="scaleText(item)" class="sample-scale">{{ scaleText(item) }}</span>
          </header>

          <dl class="metric-grid">
            <div v-for="definition in metricDefinitions" :key="definition.key" class="metric-item">
              <dt>{{ t(definition.label) }}</dt>
              <dd>{{ formatMetric(definition, metrics[item.analysisId]?.[definition.key]) }}</dd>
            </div>
          </dl>
        </article>

        <p v-if="hiddenCount" class="panel-note">
          {{ t('仅预览前 {n} 张图片，Excel 将导出全部已选图片。', { n: PREVIEW_LIMIT }) }}
        </p>
        <p class="panel-note">{{ t('完整指标可下载 Excel 查看。') }}</p>
      </template>
    </div>
  </aside>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from '@/i18n';
import { analysisService } from '@/services/analysisService';
import { excelService } from '@/services/excelService';
import { useExcelExportStore } from '@/stores/excelExport';

const { t } = useI18n();

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
  group: {
    type: String,
    default: 'stem',
  },
});

const emit = defineEmits(['notify']);

const UNIT = 'μm';
const UNIT_SYMBOL = 'µm';
const PREVIEW_LIMIT = 6;

const excelStore = useExcelExportStore();

const METRIC_DEFINITIONS = {
  stem: [
    { key: 'stemDiameter', label: '茎秆直径', type: 'length' },
    { key: 'stemPerimeter', label: '茎秆周长', type: 'length' },
    { key: 'stemArea', label: '茎秆面积', type: 'area' },
    { key: 'cavityArea', label: '空腔面积', type: 'area' },
    { key: 'largeTailCount', label: '大维管束数目', type: 'count' },
    { key: 'smallTailCount', label: '小维管束数目', type: 'count' },
    { key: 'totalCount', label: '总维管束数目', type: 'count' },
  ],
  leaf: [
    { key: 'sectionArea', label: '截面面积（含腔）', type: 'area' },
    { key: 'tissueArea', label: '组织净面积', type: 'area' },
    { key: 'body1Area', label: '主脉面积', type: 'area' },
    { key: 'body2Area', label: '空腔面积', type: 'area' },
    { key: 'side1Area', label: '侧脉1面积', type: 'area' },
    { key: 'side2Area', label: '侧脉2面积', type: 'area' },
    { key: 'body1Perimeter', label: '主脉周长', type: 'length' },
  ],
};

const metricDefinitions = computed(
  () => METRIC_DEFINITIONS[props.group] || METRIC_DEFINITIONS.stem
);
const previewItems = computed(() => props.items.slice(0, PREVIEW_LIMIT));
const hiddenCount = computed(() => Math.max(0, props.items.length - PREVIEW_LIMIT));

const metrics = ref({});
const loading = ref(false);
const loadError = ref('');
const exportError = ref('');
const columnsCache = ref({ stem: [], leaf: [] });

let metricsRequestSeq = 0;
const columnRequests = {};

function itemName(item) {
  return item?.sampleName || t('未命名样本');
}

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const number = Number(value);
  if (Math.abs(number) >= 1000) return number.toFixed(1);
  return number.toFixed(2);
}

function formatMetric(definition, value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  if (definition.type === 'count') return String(Math.round(Number(value)));
  const suffix = definition.type === 'area' ? ` ${UNIT_SYMBOL}²` : ` ${UNIT_SYMBOL}`;
  return `${formatNumber(value)}${suffix}`;
}

function scaleText(item) {
  const scale = metrics.value[item.analysisId]?.scalePerPx;
  if (scale === null || scale === undefined || Number.isNaN(Number(scale))) return '';
  return t('比例尺 {n} {unit}/px', { n: formatNumber(scale), unit: UNIT_SYMBOL });
}

async function loadMetrics() {
  const seq = ++metricsRequestSeq;
  const jobs = previewItems.value;

  metrics.value = {};
  loadError.value = '';
  exportError.value = '';
  if (!jobs.length) {
    loading.value = false;
    return;
  }

  loading.value = true;
  const results = await Promise.all(
    jobs.map(async (item) => {
      try {
        const data = await analysisService.getMetrics(item.analysisId, { unit: UNIT });
        return [item.analysisId, data.metrics || null];
      } catch (error) {
        console.error('Failed to load data center metrics:', item.analysisId, error);
        return [item.analysisId, null];
      }
    })
  );

  // 选中项在请求期间变化时丢弃过期响应
  if (seq !== metricsRequestSeq) return;

  const next = {};
  let failures = 0;
  for (const [analysisId, value] of results) {
    next[analysisId] = value;
    if (!value) failures += 1;
  }
  metrics.value = next;
  loading.value = false;

  if (failures && failures === jobs.length) loadError.value = t('表型数据加载失败。');
  else if (failures) loadError.value = t('部分样本的表型数据加载失败。');
}

async function ensureColumns() {
  const group = props.group;
  if (columnsCache.value[group]?.length) return columnsCache.value[group];
  if (columnRequests[group]) return columnRequests[group];

  columnRequests[group] = (async () => {
    try {
      const data = await excelService.getExportColumns(group);
      const keys = Object.keys(data?.available_columns || {});
      columnsCache.value = { ...columnsCache.value, [group]: keys };
      return keys;
    } catch (error) {
      console.error('Failed to load export columns:', error);
      return [];
    } finally {
      delete columnRequests[group];
    }
  })();

  return columnRequests[group];
}

async function exportExcel() {
  if (!props.items.length || excelStore.isLoading) return;

  exportError.value = '';
  excelStore.setError(null);

  const analysisIds = [...new Set(props.items.map((item) => item.analysisId))];
  const columns = await ensureColumns();
  if (!columns.length) {
    exportError.value = t('导出列加载失败。');
    return;
  }

  const success = await excelStore.downloadBatchExcelAction(
    analysisIds,
    columns,
    UNIT,
    props.group
  );
  if (success) {
    emit('notify', {
      message: t('已导出 {n} 条表型数据', { n: analysisIds.length }),
      type: 'success',
    });
  } else {
    exportError.value = excelStore.error || t('导出失败。');
  }
}

watch(
  () => `${props.group}|${previewItems.value.map((item) => item.analysisId).join(',')}`,
  loadMetrics,
  { immediate: true }
);

// 预取导出列，第一次点「下载数据」时无需等待。
watch(
  () => props.group,
  () => {
    ensureColumns();
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  metricsRequestSeq += 1;
});
</script>

<style scoped>
.metrics-panel {
  position: sticky;
  top: 16px;
  display: flex;
  flex-direction: column;
  max-height: var(--data-area-max-height, calc(100vh - 120px));
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-shrink: 0;
  gap: 10px;
  padding: 13px 14px;
  border-bottom: 1px solid var(--color-border-light);
}

.panel-title {
  min-width: 0;
}

.panel-title h2 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 13.5px;
  font-weight: 600;
}

.panel-sub {
  margin: 3px 0 0;
  color: var(--color-text-muted);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
}

.export-button {
  flex-shrink: 0;
  height: 30px;
  padding: 0 10px;
  font-size: 11.5px;
}

.export-button svg {
  width: 13px;
  height: 13px;
}

.export-spinner {
  width: 12px;
  height: 12px;
  border: 1.5px solid rgba(255, 255, 255, 0.45);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.panel-body {
  flex: 1;
  min-height: 0;
  padding: 12px 14px 14px;
  overflow-y: auto;
}

.panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  padding: 24px 16px;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface-muted);
  text-align: center;
}

.panel-empty .empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  margin-bottom: 12px;
  border-radius: var(--radius-lg);
  background: var(--color-primary-green-lightest);
  color: var(--color-primary-green-dark);
}

.panel-empty .empty-icon svg {
  width: 22px;
  height: 22px;
}

.panel-empty h3 {
  margin: 0 0 5px;
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: 600;
}

.panel-empty p {
  max-width: 240px;
  margin: 0;
  color: var(--color-text-muted);
  font-size: 11.5px;
  line-height: 1.7;
}

.panel-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 240px;
  color: var(--color-text-muted);
  font-size: 12px;
}

.loading-spinner {
  width: 15px;
  height: 15px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.panel-alert {
  margin: 0 0 10px;
  padding: 7px 10px;
  border: 1px solid rgba(220, 38, 38, 0.18);
  border-radius: var(--radius-md);
  background: var(--color-error-light);
  color: var(--color-error);
  font-size: 11.5px;
  line-height: 1.6;
}

.sample-card {
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.sample-card + .sample-card {
  margin-top: 10px;
}

.sample-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 7px;
  border-bottom: 1px solid var(--color-border-light);
}

.sample-name {
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: 12.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sample-scale {
  flex-shrink: 0;
  color: var(--color-text-light);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px 10px;
  margin: 8px 0 0;
}

.metric-item {
  min-width: 0;
}

.metric-item dt {
  color: var(--color-text-muted);
  font-size: 10.5px;
  line-height: 1.4;
}

.metric-item dd {
  margin: 1px 0 0;
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-note {
  margin: 10px 0 0;
  color: var(--color-text-light);
  font-size: 10.5px;
  line-height: 1.6;
}

@media (max-width: 1100px) {
  .metrics-panel {
    position: static;
    max-height: none;
  }

  .panel-body {
    overflow-y: visible;
  }
}
</style>
