<template>
  <div v-if="visible" class="modal-overlay" @click="closeDownloadDialog">
    <div class="modal-content" @click.stop role="dialog" aria-modal="true">
      <div class="modal-header">
        <h3>{{ dialogTitle }}</h3>
        <button class="close-button" type="button" :aria-label="t('关闭')" @click="closeDownloadDialog">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <div class="toolbar">
          <label class="select-all-label">
            <input
              type="checkbox"
              :checked="selectedColumns.length === availableColumns.length"
              @change="toggleAllColumns"
            />
            {{ t('全选') }}
          </label>
          <span class="selected-count">{{ t('已选 {n} / {m} 项', { n: selectedColumns.length, m: availableColumns.length }) }}</span>
        </div>

        <div class="columns-grid">
          <label
            v-for="column in availableColumns"
            :key="column.key"
            class="column-checkbox"
            :class="{ checked: selectedColumns.includes(column.key) }"
          >
            <input
              type="checkbox"
              :value="column.key"
              v-model="selectedColumns"
            />
            <span class="column-label">{{ t(column.label) }}</span>
          </label>
        </div>

        <div class="unit-row">
          <label class="unit-label" for="export-unit">{{ t('导出单位') }}</label>
          <select id="export-unit" v-model="selectedUnit" class="unit-dropdown">
            <option value="μm">μm</option>
            <option value="mm">mm</option>
            <option value="cm">cm</option>
          </select>
        </div>
      </div>

      <div class="modal-footer">
        <button @click="closeDownloadDialog" class="secondary" type="button">{{ t('取消') }}</button>
        <button
          @click="downloadExcel"
          class="primary"
          type="button"
          :disabled="selectedColumns.length === 0"
        >
          {{ confirmButtonText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from '@/i18n';

const { t } = useI18n();
import { ref, computed, watch } from 'vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  downloadType: {
    type: String,
    default: 'single'
  },
  job: {
    type: Object,
    default: null
  },
  selectedCount: {
    type: Number,
    default: 1
  }
});

const emit = defineEmits(['close', 'download']);

const dialogTitle = computed(() => {
  switch (props.downloadType) {
    case 'summary': return t('导出数据项 · 总表');
    case 'batch': return t('导出数据项 · 批量（{n} 个文件）', { n: props.selectedCount });
    case 'single':
    default: return t('导出数据项 · {name}', { name: props.job?.originalFilename || t('单个文件') });
  }
});

const confirmButtonText = computed(() => {
  switch (props.downloadType) {
    case 'summary': return t('下载总表');
    case 'batch': return t('下载批量报告');
    case 'single':
    default: return t('下载报告');
  }
});

// Excel下载弹窗相关状态
const selectedColumns = ref(['filename']);
const selectedUnit = ref('μm');

// 可下载的数据项配置
const availableColumns = [
  { key: 'filename', label: '样本名称' },
  { key: 'largeTailCount', label: '大维管束数目' },
  { key: 'smallTailCount', label: '小维管束数目' },
  { key: 'totalCount', label: '总维管束数目' },
  { key: 'largeTailArea', label: '大维管束面积' },
  { key: 'smallTailArea', label: '小维管束面积' },
  { key: 'stemDiameter', label: '茎秆直径' },
  { key: 'stemPerimeter', label: '茎秆周长' },
  { key: 'cavityArea', label: '空腔面积' },
  { key: 'stemCavityAreaDiff', label: '茎秆面积与空腔面积差值' },
  { key: 'largeSmallAreaRatio', label: '大维管束面积与小维管束面积比值' },
  { key: 'largeSmallCountRatio', label: '大维管束数目与小维管束数目比值' },
  { key: 'stemArea', label: '茎秆面积' },
  { key: 'cavityStemAreaRatio', label: '空腔面积与茎秆面积比值' },
  { key: 'smallCountPerimeterRatio', label: '小维管束数目与茎秆周长比值' },
  { key: 'largeCountPerimeterCavityRatio', label: '大维管束数目与茎秆周长与空腔面积差值比值' }
];

// 全选/取消全选
const toggleAllColumns = () => {
  if (selectedColumns.value.length === availableColumns.length) {
    selectedColumns.value = [];
  } else {
    selectedColumns.value = availableColumns.map(col => col.key);
  }
};

// 下载Excel
const downloadExcel = () => {
  emit('download', {
    type: props.downloadType,
    columns: selectedColumns.value,
    jobId: props.downloadType === 'single' ? props.job?.analysisId : null,
    unit: selectedUnit.value
  });

  closeDownloadDialog();
};

// 关闭弹窗
const closeDownloadDialog = () => {
  emit('close');
};

watch(() => props.visible, (val) => {
  if (val) {
    selectedColumns.value = ['filename'];
    selectedUnit.value = 'μm';
  }
});
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(24, 24, 27, 0.36);
  animation: fadeIn var(--transition-fast) both;
}

.modal-content {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 600px;
  max-height: 82vh;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
  animation: fadeInScale var(--transition-normal) both;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  padding: 14px 18px;
  border-bottom: 1px solid var(--color-border-light);
}

.modal-header h3 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 13.5px;
  font-weight: 600;
}

.close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
}

.close-button:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}

.close-button svg {
  width: 15px;
  height: 15px;
}

.modal-body {
  flex: 1;
  padding: 16px 18px;
  overflow-y: auto;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.select-all-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-secondary);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
}

.selected-count {
  color: var(--color-text-light);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.columns-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.column-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast);
}

.column-checkbox:hover {
  background: var(--color-surface-hover);
}

.column-checkbox.checked {
  background: var(--color-primary-green-bg);
  border-color: var(--color-primary-green-lightest);
}

.column-label {
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: 12.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unit-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--color-border-light);
}

.unit-label {
  color: var(--color-text-secondary);
  font-size: 12.5px;
  font-weight: 500;
}

.unit-dropdown {
  width: auto;
  min-width: 92px;
  height: 32px;
  padding: 0 28px 0 10px;
  font-size: 12.5px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-shrink: 0;
  padding: 14px 18px;
  border-top: 1px solid var(--color-border-light);
  background: var(--color-surface-muted);
}

@media (max-width: 620px) {
  .columns-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
