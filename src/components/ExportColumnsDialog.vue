<template>
  <div v-if="visible" class="dialog-overlay" @click.self="close">
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="export-columns-title">
      <header class="dialog-head">
        <h3 id="export-columns-title">{{ t('选择导出列') }}</h3>
        <button type="button" class="dialog-close" :aria-label="t('关闭')" @click="close">×</button>
      </header>

      <p class="dialog-hint">
        {{ summary || t('勾选需要写入 Excel 的列，导出单位可选。') }}
      </p>

      <div class="dialog-units">
        <span class="dialog-units-label">{{ t('导出单位') }}</span>
        <div class="unit-options">
          <button
            v-for="option in UNIT_OPTIONS"
            :key="option.value"
            type="button"
            class="unit-option"
            :class="{ active: unit === option.value }"
            @click="unit = option.value"
          >{{ option.label }}</button>
        </div>
      </div>

      <div class="dialog-tools">
        <button type="button" class="link-button" @click="selectAll">{{ t('全选') }}</button>
        <button v-if="coreSelected?.length" type="button" class="link-button" @click="selectCore">
          {{ t('只看核心') }}
        </button>
        <button type="button" class="link-button" @click="clearSelection">{{ t('清空') }}</button>
        <span class="selected-count">{{ t('已选 {n} / {m} 项', { n: selectedColumns.length, m: columns.length }) }}</span>
      </div>

      <p v-if="loading" class="dialog-status">{{ t('正在加载可导出列…') }}</p>
      <p v-else-if="error" class="dialog-status error">{{ error }}</p>

      <div v-else class="columns-grid dialog-columns">
        <label v-for="column in columns" :key="column.key" class="column-item">
          <input v-model="selectedColumns" type="checkbox" :value="column.key" />
          <span>{{ columnLabel(column) }}</span>
        </label>
      </div>

      <footer class="dialog-actions">
        <button type="button" @click="close">{{ t('取消') }}</button>
        <button
          type="button"
          class="primary"
          :disabled="loading || !!error || !selectedColumns.length || busy"
          @click="confirm"
        >{{ busy ? t('导出中…') : t('确认导出') }}</button>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from '@/i18n';
import { excelService } from '@/services/excelService';
import { unitSymbolOf } from '@/utils/sampleDisplay';

const { t } = useI18n();

const props = defineProps({
  visible: { type: Boolean, default: false },
  /** stem / leaf，决定从后端加载哪套可导出列 */
  group: { type: String, default: 'stem' },
  /** 打开时的默认勾选；不传则全选 */
  defaultSelected: { type: Array, default: null },
  /** “只看核心”使用的列；不传则不显示该按钮 */
  coreSelected: { type: Array, default: null },
  /** 自定义说明文案 */
  summary: { type: String, default: '' },
  /** 导出请求进行中，用于禁用确认按钮 */
  busy: { type: Boolean, default: false },
});

const emit = defineEmits(['close', 'confirm']);

const UNIT_OPTIONS = [
  { value: 'μm', label: 'µm' },
  { value: 'mm', label: 'mm' },
  { value: 'cm', label: 'cm' },
];

const columns = ref([]);
const selectedColumns = ref([]);
const unit = ref('μm');
const loading = ref(false);
const error = ref('');

const unitSymbol = computed(() => unitSymbolOf(unit.value));

const columnLabel = (column) => (column.key === 'scalePerPx'
  ? t('比例尺({unit}/px)', { unit: unitSymbol.value })
  : t(column.label));

function selectAll() {
  selectedColumns.value = columns.value.map(column => column.key);
}

function clearSelection() {
  selectedColumns.value = [];
}

function selectCore() {
  const available = new Set(columns.value.map(column => column.key));
  selectedColumns.value = (props.coreSelected || []).filter(key => available.has(key));
}

async function loadColumns() {
  loading.value = true;
  error.value = '';
  try {
    const data = await excelService.getExportColumns(props.group);
    const list = Object.entries(data.available_columns || {}).map(([key, label]) => ({ key, label }));
    columns.value = list;

    const available = new Set(list.map(column => column.key));
    const defaults = (props.defaultSelected || []).filter(key => available.has(key));
    selectedColumns.value = defaults.length ? defaults : list.map(column => column.key);
  } catch (err) {
    error.value = err.response?.data?.detail || err.message || t('导出列加载失败');
    columns.value = [];
    selectedColumns.value = [];
  } finally {
    loading.value = false;
  }
}

function close() {
  emit('close');
}

function confirm() {
  if (!selectedColumns.value.length || loading.value || error.value) return;
  emit('confirm', { columns: [...selectedColumns.value], unit: unit.value });
}

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return;
    unit.value = 'μm';
    loadColumns();
  },
  { immediate: true }
);
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 2200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(24, 24, 27, 0.32);
  animation: fadeIn 140ms ease both;
}

.dialog {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(560px, 100%);
  max-height: min(82vh, 640px);
  padding: 16px 18px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  box-shadow: var(--shadow-xl);
  animation: fadeInScale 160ms ease both;
}

.dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.dialog-head h3 {
  margin: 0;
  font-size: 13.5px;
  font-weight: 600;
}

.dialog-close {
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-light);
  font-size: 15px;
  line-height: 1;
}

.dialog-close:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}

.dialog-hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 11.5px;
  line-height: 1.6;
}

.dialog-units {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dialog-units-label {
  color: var(--color-text-muted);
  font-size: 11.5px;
}

.unit-options {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border-radius: var(--radius-full);
  background: var(--color-surface-hover);
}

.unit-option {
  height: 22px;
  padding: 0 10px;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-text-muted);
  font-size: 11.5px;
}

.unit-option.active {
  background: var(--color-surface);
  box-shadow: var(--shadow-xs);
  color: var(--color-text-primary);
}

.dialog-tools {
  display: flex;
  align-items: center;
  gap: 12px;
}

.selected-count {
  margin-left: auto;
  color: var(--color-text-light);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
}

.dialog-status {
  margin: 0;
  padding: 12px;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-light);
  font-size: 11.5px;
  text-align: center;
}

.dialog-status.error {
  border-color: rgba(220, 38, 38, 0.28);
  background: var(--color-error-light);
  color: var(--color-error);
}

.dialog .columns-grid {
  max-height: 320px;
  padding-right: 4px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--color-border-light);
}

.dialog-actions button {
  height: 30px;
  padding: 0 14px;
  font-size: 12px;
}

.link-button {
  height: auto;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-primary-green-dark);
  font-size: 11.5px;
}

.link-button:hover {
  text-decoration: underline;
}

.columns-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 4px 10px;
  max-height: 150px;
  overflow-y: auto;
}

.column-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text-secondary);
  font-size: 11.5px;
}
</style>
