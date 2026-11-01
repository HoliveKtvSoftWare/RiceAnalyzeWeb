<template>
  <!-- 剑叶分析页面 -->
  <div class="leaf-page">
    <div v-if="leafStore.error" class="alert" role="alert">
      <span>{{ leafStore.error }}</span>
      <button type="button" class="alert-close" @click="leafStore.setError(null)">×</button>
    </div>

    <!-- 左右两栏布局 -->
    <div class="leaf-layout">
      <!-- 左侧：分析设置与处理队列 -->
      <aside class="leaf-setup">
        <!-- 上传与模型设置 -->
        <section class="setup-card">
          <h2>{{ t('分析设置') }}</h2>

          <label class="field">
            <span class="field-label">{{ t('剑叶模型') }}</span>
            <select v-model="leafStore.currentModel" :disabled="leafStore.uploading">
              <option v-if="leafStore.modelsLoading" :value="null">{{ t('加载中...') }}</option>
              <option v-for="model in leafStore.models" :key="model.name" :value="model.name">
                {{ model.name }}
              </option>
            </select>
          </label>

          <div
            class="dropzone"
            :class="{ dragging }"
            @click="fileInput?.click()"
            @dragover.prevent="dragging = true"
            @dragleave.prevent="dragging = false"
            @drop.prevent="onDrop"
          >
            <input
              ref="fileInput"
              type="file"
              accept="image/*"
              multiple
              hidden
              @change="onPick"
            />
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 19C5 10.5 10 4.5 20 4c.5 9.5-5.5 15-15 15Z" />
              <path d="M5 19c2.5-4.5 6-8 11-10.5" />
            </svg>
            <strong>{{ t('拖拽剑叶切片图到这里') }}</strong>
            <small>{{ t('或点击选择，支持一次多张') }}</small>
          </div>

          <button
            type="button"
            class="folder-button"
            :disabled="leafStore.uploading"
            @click="folderInput?.click()"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H10l2 2h6.5A2.5 2.5 0 0 1 21 10.5v7A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5Z" />
            </svg>
            {{ t('选择文件夹') }}
          </button>
          <input
            ref="folderInput"
            type="file"
            accept="image/*"
            multiple
            webkitdirectory
            mozdirectory
            directory
            hidden
            @change="onPickFolder"
          />

          <div v-if="pickedFiles.length" class="chip-group">
            <span class="chip-group-label">{{ t('单张文件 ({n})', { n: pickedFiles.length }) }}</span>
            <ul class="chips">
              <li v-for="(file, index) in pickedFiles" :key="`${file.name}-${index}`" class="chip">
                <span class="chip-name" :title="file.name">{{ file.name }}</span>
                <span class="chip-size">{{ (file.size / 1024).toFixed(0) }} KB</span>
                <button type="button" class="chip-remove" :title="t('移除')" @click="removeFile(index)">×</button>
              </li>
            </ul>
          </div>

          <div v-if="folderFiles.length" class="chip-group">
            <span class="chip-group-label">{{ t('文件夹文件 ({n})', { n: folderFiles.length }) }}</span>
            <ul class="chips">
              <li v-for="(file, index) in folderFiles" :key="`folder-${index}`" class="chip">
                <span class="chip-name" :title="folderFilePath(file)">{{ folderFilePath(file) }}</span>
                <span class="chip-size">{{ (file.size / 1024).toFixed(0) }} KB</span>
                <button type="button" class="chip-remove" :title="t('移除')" @click="removeFolderFile(index)">×</button>
              </li>
            </ul>
          </div>

          <button
            type="button"
            class="start-button"
            :disabled="leafStore.uploading || totalPickedFiles === 0 || !leafStore.currentModel"
            @click="startAnalysis"
          >
            {{ leafStore.uploading
              ? t('上传中 {n}%', { n: leafStore.uploadPercent })
              : (totalPickedFiles ? t('开始分析（{n} 张）', { n: totalPickedFiles }) : t('开始分析')) }}
          </button>

          <p v-if="!leafStore.models.length && leafStore.modelsLoaded" class="model-hint">
            {{ t('剑叶模型尚未部署。把权重放到 models_yolo/leaf.pt，或在 .env 的 LEAF_MODELS 里登记路径后重启后端。') }}
          </p>
        </section>

        <!-- 处理队列 -->
        <section class="setup-card">
          <h2>{{ t('处理队列') }}</h2>
          <p v-if="!leafStore.processingJobs.length" class="queue-empty">{{ t('当前没有进行中的任务') }}</p>
          <ul v-else class="queue-list">
            <li v-for="job in leafStore.processingJobs" :key="job.analysisId" class="queue-item">
              <span class="pulse-dot"></span>
              <span class="queue-name" :title="job.originalFilename">{{ cleanName(job.originalFilename) }}</span>
              <span class="queue-status">{{ t('推理中') }}</span>
            </li>
          </ul>
        </section>
      </aside>

      <!-- 右侧：结果舞台与记录 -->
      <main class="leaf-stage">
        <!-- 结果舞台卡片 -->
        <section v-if="leafStore.selectedJob" class="stage-card">
          <header class="stage-head">
            <div class="stage-title">
              <h2 :title="leafStore.selectedJob.originalFilename">
                {{ cleanName(leafStore.selectedJob.originalFilename) }}
              </h2>
              <span class="status-pill" :class="`is-${leafStore.selectedJob.status}`">
                {{ statusLabel(leafStore.selectedJob.status) }}
              </span>
              <span v-if="leafStore.selectedJob.modelUsed" class="model-tag">
                {{ leafStore.selectedJob.modelUsed }}
              </span>
            </div>
            <div class="stage-actions">
              <label class="unit-select">
                <span>{{ t('单位') }}</span>
                <select :value="leafStore.unit" @change="onUnitChange">
                  <option value="μm">µm</option>
                  <option value="mm">mm</option>
                  <option value="cm">cm</option>
                </select>
              </label>
              <button
                type="button"
                :disabled="leafStore.selectedJob.status !== 'completed' || excelStore.isLoading"
                @click="exportSingle"
              >{{ t('导出 Excel') }}</button>
              <button
                type="button"
                :disabled="leafStore.selectedJob.status !== 'completed'"
                @click="exportJson"
              >{{ t('导出 JSON') }}</button>
              <button
                type="button"
                class="danger"
                :disabled="leafStore.loading"
                @click="removeCurrent"
              >{{ t('删除') }}</button>
            </div>
          </header>

          <div class="stage-body">
            <!-- 单图查看器 -->
            <div class="viewer">
              <div class="viewer-bar">
                <div class="viewer-tabs">
                  <button
                    type="button"
                    :class="{ active: viewTab === 'annotated' }"
                    :disabled="!leafStore.selectedJob.annotatedImageUrl"
                    @click="viewTab = 'annotated'"
                  >{{ t('分割图') }}</button>
                  <button
                    type="button"
                    :class="{ active: viewTab === 'original' }"
                    :disabled="!leafStore.selectedJob.originalImageUrl"
                    @click="viewTab = 'original'"
                  >{{ t('原图') }}</button>
                </div>

                <a
                  v-if="currentImage"
                  class="viewer-open"
                  :href="currentImage"
                  target="_blank"
                  rel="noopener"
                >{{ t('大图 ↗') }}</a>
              </div>

              <div
                class="viewer-canvas"
                :class="{ 'is-zoomed': zoom.scale > 1, dragging: zoom.dragging }"
                :style="{ cursor: zoom.dragging ? 'grabbing' : (zoom.scale > 1 ? 'grab' : 'zoom-in') }"
                @wheel="onWheel"
                @mousedown="onMouseDown"
              >
                <img
                  v-if="currentImage"
                  :src="currentImage"
                  :alt="viewTab === 'annotated' ? t('剑叶分割图') : t('剑叶原图')"
                  draggable="false"
                  :style="{ transform: `scale(${zoom.scale}) translate(${zoom.x}px, ${zoom.y}px)` }"
                />
                <p v-else class="viewer-empty">{{ t('该记录没有可显示的图片') }}</p>

                <div v-if="zoom.scale !== 1 || zoom.x !== 0 || zoom.y !== 0" class="zoom-pill">
                  <span>{{ (zoom.scale * 100).toFixed(0) }}%</span>
                  <button type="button" @click="resetZoom">{{ t('重置') }}</button>
                </div>

                <div v-if="leafStore.selectedJob.status === 'processing'" class="viewer-overlay">
                  <span class="spinner"></span>
                  {{ t('正在分割，请稍候…') }}
                </div>
                <div v-else-if="leafStore.selectedJob.status === 'failed'" class="viewer-overlay failed">
                  <strong>{{ t('分析失败') }}</strong>
                  <span>{{ leafStore.selectedJob.errorMessage || t('未返回具体原因') }}</span>
                </div>
              </div>
            </div>

            <!-- 结构指标面板 -->
            <div class="metric-panel">
              <div class="metric-head">
                <h3>{{ t('结构指标') }}</h3>
                <span v-if="leafStore.metrics" class="scale-note">
                  {{ scalePerPx !== null
                    ? t('比例尺 {n} {unit}/px', { n: formatScale(scalePerPx), unit: unitSymbol })
                    : t('比例尺 {n} µm/px', { n: leafStore.metrics.scaleUmPerPx }) }}
                </span>
              </div>

              <p v-if="leafStore.metricsLoading" class="metric-hint">{{ t('指标计算中…') }}</p>
              <p v-else-if="leafStore.metricsError" class="metric-hint error">{{ leafStore.metricsError }}</p>
              <p v-else-if="!leafStore.metrics" class="metric-hint">
                {{ t('分析完成后展示截面面积、组织净面积、三条脉的面积/周长与各类维管束计数。') }}
              </p>

              <div v-else class="metric-grid">
                <article v-for="card in metricCards" :key="card.label" class="metric-card">
                  <span class="metric-label">{{ card.label }}</span>
                  <strong class="metric-value">{{ card.value }}</strong>
                  <span v-if="card.sub" class="metric-sub">{{ card.sub }}</span>
                </article>
              </div>
            </div>
          </div>
        </section>

        <!-- 未选中记录时的空状态 -->
        <section v-else class="stage-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 19C5 10.5 10 4.5 20 4c.5 9.5-5.5 15-15 15Z" />
            <path d="M5 19c2.5-4.5 6-8 11-10.5" />
          </svg>
          <h2>{{ t('还没有选中样本') }}</h2>
          <p>{{ t('先在左侧上传剑叶切片图，或在下方记录条里点一张卡片。') }}</p>
        </section>

        <!-- 剑叶记录条 -->
        <section class="records">
          <header class="records-head">
            <div class="records-title">
              <h2>{{ t('剑叶记录') }}</h2>
              <span class="records-count">{{ leafStore.history.length }}</span>
            </div>
            <div class="records-actions">
              <button
                type="button"
                class="ghost"
                :disabled="!leafStore.history.length || excelStore.isLoading"
                @click="toggleSelectAll"
              >{{ allRecordsSelected ? t('取消全选') : t('全选') }}</button>
              <button
                type="button"
                :disabled="!leafStore.selectedIds.length || excelStore.isLoading"
                @click="openExportDialog"
              >{{ leafStore.selectedIds.length
                ? t('导出选中 Excel（{done}/{total}）', { done: leafStore.completedSelected.length, total: leafStore.selectedIds.length })
                : t('导出选中 Excel') }}</button>
              <button
                type="button"
                :disabled="!leafStore.completedSelected.length || isExportingJson"
                @click="exportSelectedJson"
              >{{ isExportingJson
                ? t('导出中...')
                : (leafStore.selectedIds.length
                  ? t('导出选中 JSON（{done}/{total}）', { done: leafStore.completedSelected.length, total: leafStore.selectedIds.length })
                  : t('导出选中 JSON')) }}</button>
              <button
                type="button"
                class="danger"
                :disabled="!leafStore.selectedIds.length || leafStore.loading"
                @click="removeSelected"
              >{{ t('删除选中') }}</button>
            </div>
          </header>

          <div v-if="excelStore.isLoading" class="export-progress">
            <span class="spinner"></span>
            <span>{{ excelStore.taskMessage || t('正在生成 Excel…') }}</span>
            <span v-if="excelStore.taskTotal">{{ excelStore.taskProgress }}/{{ excelStore.taskTotal }}</span>
          </div>
          <p v-if="excelStore.error" class="export-error">{{ excelStore.error }}</p>

          <p v-if="leafStore.loading && !leafStore.history.length" class="records-empty">{{ t('正在加载…') }}</p>
          <p v-else-if="!leafStore.history.length" class="records-empty">
            {{ t('暂无剑叶分析记录，上传第一张切片图开始。') }}
          </p>

          <div
            v-else
            ref="recordStripRef"
            class="record-strip"
            @wheel="onRecordWheel"
          >
            <article
              v-for="job in leafStore.history"
              :key="job.analysisId"
              class="record-card"
              :class="{ selected: leafStore.selectedJob?.analysisId === job.analysisId }"
              @click="selectJob(job)"
            >
              <div class="thumb">
                <img
                  v-if="job.thumbnailUrl || job.annotatedImageUrl || job.originalPreviewUrl || job.originalImageUrl"
                  :src="job.thumbnailUrl || job.annotatedImageUrl || job.originalPreviewUrl || job.originalImageUrl"
                  :alt="job.originalFilename"
                  loading="lazy"
                  decoding="async"
                  fetchpriority="low"
                />
                <span v-else class="thumb-empty">{{ t('无图') }}</span>
                <label class="thumb-check" @click.stop>
                  <input
                    type="checkbox"
                    :checked="leafStore.selectedIds.includes(job.analysisId)"
                    @change="leafStore.toggleSelect(job.analysisId)"
                  />
                </label>
              </div>
              <div class="record-meta">
                <strong :title="job.originalFilename">{{ cardName(job.originalFilename) }}</strong>
                <span class="record-foot">
                  <span class="status-dot" :class="`is-${job.status}`"></span>
                  <span>{{ statusLabel(job.status) }}</span>
                  <span class="dot-sep">·</span>
                  <span>{{ formatTime(job.createdAt) }}</span>
                </span>
                <span
                  v-if="job.batchId && batchCountOf(job.batchId) > 1"
                  class="batch-chip"
                  :class="{ active: isBatchSelected(job) }"
                  :title="batchNameOf(job)"
                  @click.stop="toggleBatchSelection(job)"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H10l2 2h6.5A2.5 2.5 0 0 1 21 10.5v7A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5Z" />
                  </svg>
                  <span>{{ batchChipLabel(job) }}</span>
                </span>
              </div>
            </article>
          </div>
        </section>
      </main>
    </div>

    <!-- 导出列选择弹窗 -->
    <ExportColumnsDialog
      :visible="showExportDialog"
      group="leaf"
      :core-selected="LEAF_CORE_COLUMNS"
      :busy="excelStore.isLoading"
      @close="closeExportDialog"
      @confirm="handleExportConfirm"
    />
  </div>
</template>

<script setup>
import { useI18n } from '@/i18n';

const { t } = useI18n();
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { useLeafAnalysisStore } from '@/stores/leafAnalysis';
import { useExcelExportStore } from '@/stores/excelExport';
import { exportService } from '@/services/exportService';
import ExportColumnsDialog from '@/components/ExportColumnsDialog.vue';
import { useHorizontalWheelScroll } from '@/composables/useHorizontalWheelScroll';
import { useBatchSelection } from '@/composables/useBatchSelection';
import {
  cardName,
  cleanName,
  formatNumber,
  formatScale,
  formatTime,
  scalePerPxOf,
  statusLabel,
  unitSymbolOf,
} from '@/utils/sampleDisplay';

const leafStore = useLeafAnalysisStore();
const excelStore = useExcelExportStore();
const { stripRef: recordStripRef, onWheel: onRecordWheel } = useHorizontalWheelScroll();

const fileInput = ref(null);
const pickedFiles = ref([]);
const folderInput = ref(null);
const folderFiles = ref([]);
const dragging = ref(false);
const viewTab = ref('annotated');
const isExportingJson = ref(false);
const showExportDialog = ref(false);
const exportMode = ref('batch');

const allRecordsSelected = computed(() =>
  leafStore.history.length > 0 && leafStore.selectedIds.length === leafStore.history.length
);

const totalPickedFiles = computed(() => pickedFiles.value.length + folderFiles.value.length);

const {
  batchCountOf,
  batchNameOf,
  batchChipLabel,
  isBatchSelected,
  toggleBatchSelection,
} = useBatchSelection({
  jobs: computed(() => leafStore.history),
  getSelectedIds: () => leafStore.selectedIds,
  setSelectedIds: (ids) => { leafStore.selectedIds = ids; },
});

const zoom = reactive({
  scale: 1, x: 0, y: 0, dragging: false,
  startX: 0, startY: 0, originX: 0, originY: 0,
});

const currentImage = computed(() => {
  const job = leafStore.selectedJob;
  if (!job) return null;
  return viewTab.value === 'annotated'
    ? (job.annotatedImageUrl || job.originalPreviewUrl || job.originalImageUrl)
    : (job.originalPreviewUrl || job.originalImageUrl || job.annotatedImageUrl);
});

function resetZoom() {
  zoom.scale = 1;
  zoom.x = 0;
  zoom.y = 0;
}

function onWheel(event) {
  event.preventDefault();
  const next = Math.max(1, Math.min(4, zoom.scale + (event.deltaY > 0 ? -0.15 : 0.15)));
  zoom.scale = Number(next.toFixed(2));
  if (zoom.scale === 1) {
    zoom.x = 0;
    zoom.y = 0;
  }
}

function onMouseDown(event) {
  if (event.button !== 0 || zoom.scale <= 1) return;
  zoom.dragging = true;
  zoom.startX = event.clientX;
  zoom.startY = event.clientY;
  zoom.originX = zoom.x;
  zoom.originY = zoom.y;
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  event.preventDefault();
}

function onMouseMove(event) {
  if (!zoom.dragging) return;
  zoom.x = zoom.originX + (event.clientX - zoom.startX);
  zoom.y = zoom.originY + (event.clientY - zoom.startY);
}

function onMouseUp() {
  zoom.dragging = false;
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
}

const isImage = (file) => Boolean(file && file.type && file.type.startsWith('image/'));

function addFiles(list) {
  const images = Array.from(list || []).filter(isImage);
  pickedFiles.value = [...pickedFiles.value, ...images];
}

function onPick(event) {
  addFiles(event.target.files);
  event.target.value = '';
}

function folderFilePath(file) {
  return file.webkitRelativePath || file.name;
}

function onPickFolder(event) {
  const images = Array.from(event.target.files || []).filter(isImage);
  folderFiles.value = images;
  event.target.value = '';
}

function removeFolderFile(index) {
  folderFiles.value.splice(index, 1);
}

function onDrop(event) {
  dragging.value = false;
  addFiles(event.dataTransfer?.files);
}

function removeFile(index) {
  pickedFiles.value.splice(index, 1);
}

async function startAnalysis() {
  const files = [...pickedFiles.value, ...folderFiles.value];
  if (!files.length) return;
  const response = await leafStore.upload(files);
  if (!response) return;

  pickedFiles.value = [];
  folderFiles.value = [];
  if (fileInput.value) fileInput.value.value = '';
  if (folderInput.value) folderInput.value.value = '';
  await leafStore.fetchHistory(false);

  const targetId = response.analysisId || response.analyses?.[0]?.analysisId || null;
  const target = leafStore.history.find(job => job.analysisId === targetId) || leafStore.history[0];
  if (target) await leafStore.selectJob(target);
}

const unitSymbol = computed(() => unitSymbolOf(leafStore.unit));
const scalePerPx = computed(() => scalePerPxOf(leafStore.metrics, leafStore.unit));

const metricCards = computed(() => {
  const metrics = leafStore.metrics;
  if (!metrics) return [];
  const unit = leafStore.unit;
  const area = (value) => `${formatNumber(value)} ${unit}²`;
  const length = (value) => `${formatNumber(value)} ${unit}`;
  const count = (value) => t('{n} 个', { n: value ?? 0 });

  return [
    { label: t('截面面积（含腔）'), value: area(metrics.sectionArea) },
    { label: t('组织净面积'), value: area(metrics.tissueArea) },
    { label: t('主脉面积'), value: area(metrics.body1Area) },
    { label: t('空腔面积'), value: area(metrics.body2Area) },
    { label: t('侧脉1面积'), value: area(metrics.side1Area) },
    { label: t('侧脉2面积'), value: area(metrics.side2Area) },
    { label: t('主脉周长'), value: length(metrics.body1Perimeter) },
    { label: t('侧脉1长度'), value: length(metrics.side1Length) },
    { label: t('侧脉2长度'), value: length(metrics.side2Length) },
    {
      label: t('主脉大维管束'),
      value: count(metrics.bodyBigCount),
      sub: t('平均 {v}', { v: area(metrics.bodyBigAvgArea) }),
    },
    {
      label: t('主脉小维管束'),
      value: count(metrics.bodySmallCount),
      sub: t('平均 {v}', { v: area(metrics.bodySmallAvgArea) }),
    },
    {
      label: t('空腔小维管束'),
      value: count(metrics.cavitySmallCount),
      sub: t('平均 {v}', { v: area(metrics.cavitySmallAvgArea) }),
    },
    {
      label: t('侧脉1大/小'),
      value: `${metrics.side1BigCount ?? 0} / ${metrics.side1SmallCount ?? 0}`,
      sub: t('平均 {a} / {b}', { a: area(metrics.side1BigAvgArea), b: area(metrics.side1SmallAvgArea) }),
    },
    {
      label: t('侧脉2大/小'),
      value: `${metrics.side2BigCount ?? 0} / ${metrics.side2SmallCount ?? 0}`,
      sub: t('平均 {a} / {b}', { a: area(metrics.side2BigAvgArea), b: area(metrics.side2SmallAvgArea) }),
    },
  ];
});

async function selectJob(job) {
  await leafStore.selectJob(job);
  resetZoom();
}

function onUnitChange(event) {
  leafStore.setUnit(event.target.value);
}

async function removeCurrent() {
  const job = leafStore.selectedJob;
  if (!job) return;
  if (!window.confirm(t('删除记录「{name}」？文件会一并删除。', { name: cleanName(job.originalFilename) }))) return;
  await leafStore.removeJob(job.analysisId);
}

async function removeSelected() {
  const ids = [...leafStore.selectedIds];
  if (!ids.length) return;
  if (!window.confirm(t('删除选中的 {n} 条记录？文件会一并删除。', { n: ids.length }))) return;
  await leafStore.removeBatch(ids);
}

function toggleSelectAll() {
  if (allRecordsSelected.value) {
    leafStore.clearSelection();
    return;
  }
  const ids = leafStore.history.map(job => job.analysisId);
  if (typeof leafStore.selectAll === 'function') {
    leafStore.selectAll(ids);
  } else {
    leafStore.selectedIds = ids;
  }
}

const LEAF_CORE_COLUMNS = [
  'filename', 'scalePerPx', 'sectionArea', 'tissueArea',
  'body1Area', 'body2Area', 'side1Area', 'side2Area',
  'body1Perimeter', 'side1Perimeter', 'side2Perimeter',
  'bodyBigCount', 'bodySmallCount', 'cavitySmallCount',
  'side1BigCount', 'side1SmallCount', 'side2BigCount', 'side2SmallCount',
];

function openExportDialog() {
  if (!leafStore.selectedIds.length) return;
  exportMode.value = 'batch';
  showExportDialog.value = true;
}

function closeExportDialog() {
  showExportDialog.value = false;
}

function exportSingle() {
  const job = leafStore.selectedJob;
  if (!job) return;
  exportMode.value = 'single';
  showExportDialog.value = true;
}

async function handleExportConfirm({ columns, unit }) {
  if (exportMode.value === 'single') {
    const job = leafStore.selectedJob;
    if (!job) return;
    await excelStore.downloadSingleExcelAction(
      job.analysisId, job.originalFilename, columns, unit, 'leaf'
    );
  } else {
    const ids = leafStore.completedSelected;
    if (!ids.length) {
      leafStore.setError(t('选中的记录里没有已完成的样本，无法导出。'));
      closeExportDialog();
      return;
    }
    await excelStore.downloadBatchExcelAction(ids, columns, unit, 'leaf');
  }
  closeExportDialog();
}

async function exportJson() {
  const job = leafStore.selectedJob;
  if (!job) return;
  try {
    await exportService.exportSingleJson(job.analysisId, job.originalFilename);
  } catch (err) {
    leafStore.setError(err.response?.data?.detail || t('导出 JSON 失败。'));
  }
}

async function exportSelectedJson() {
  const ids = [...leafStore.completedSelected];
  if (!ids.length) {
    leafStore.setError(t('请先勾选已完成的记录'));
    return;
  }

  leafStore.setError(null);
  isExportingJson.value = true;
  try {
    if (ids.length === 1) {
      const job = leafStore.history.find(item => item.analysisId === ids[0]);
      await exportService.exportSingleJson(ids[0], job?.originalFilename || '');
    } else {
      await exportService.batchExportJson(ids);
    }
    leafStore.selectedIds = leafStore.selectedIds.filter(id => !ids.includes(id));
  } catch (err) {
    leafStore.setError(err.response?.data?.detail || t('导出 JSON 失败。'));
  } finally {
    isExportingJson.value = false;
  }
}

onMounted(async () => {
  await Promise.allSettled([
    leafStore.fetchModels(),
    leafStore.fetchHistory(),
  ]);
  if (!leafStore.selectedJob) {
    const first = leafStore.history.find(job => job.status === 'completed') || leafStore.history[0];
    if (first) await leafStore.selectJob(first);
  }
});

onUnmounted(() => {
  onMouseUp();
});
</script>

<style scoped>
.leaf-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
  padding: 4px 2px 4px;
}

.leaf-layout {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: 16px;
  align-items: stretch;
  flex: 1 1 auto;
  min-height: 0;
}

.leaf-setup {
  position: sticky;
  top: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  max-height: 100%;
  overflow-y: auto;
}

.setup-card {
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
}

.setup-card h2 {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.field-label {
  color: var(--color-text-muted);
  font-size: 11.5px;
}

.dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 22px 16px;
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-lg);
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
  text-align: center;
  cursor: pointer;
  transition: border-color var(--transition-fast), background-color var(--transition-fast),
    transform var(--transition-fast);
}

.dropzone svg {
  width: 24px;
  height: 24px;
  color: var(--color-primary-green);
}

.dropzone strong {
  color: var(--color-text-secondary);
  font-size: 12.5px;
  font-weight: 500;
}

.dropzone small {
  color: var(--color-text-light);
  font-size: 11.5px;
}

.dropzone:hover,
.dropzone.dragging {
  border-color: var(--color-primary-green);
  background: var(--color-primary-green-bg);
  transform: translateY(-1px);
}

.folder-button {
  width: 100%;
  height: 30px;
  margin-top: 8px;
  border-style: dashed;
  border-color: var(--color-border);
  background: transparent;
  color: var(--color-text-muted);
  font-size: 12px;
}

.folder-button svg {
  width: 14px;
  height: 14px;
}

.folder-button:hover:not(:disabled) {
  border-color: var(--color-primary-green);
  background: var(--color-primary-green-bg);
  color: var(--color-primary-green-dark);
}

.chip-group {
  margin-top: 10px;
}

.chip-group-label {
  display: block;
  margin-bottom: 4px;
  color: var(--color-text-light);
  font-size: 11px;
}

.chips {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 176px;
  margin: 0;
  padding: 0 2px 0 0;
  overflow-y: auto;
  list-style: none;
}

.chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: var(--radius-sm);
  background: var(--color-surface-muted);
  font-size: 11.5px;
  animation: fadeInUp 180ms ease backwards;
}

.chip-name {
  flex: 1;
  overflow: hidden;
  color: var(--color-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip-size {
  flex-shrink: 0;
  color: var(--color-text-light);
  font-variant-numeric: tabular-nums;
}

.chip-remove {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--color-text-light);
  font-size: 12px;
  line-height: 1;
}

.chip-remove:hover {
  background: var(--color-error-light);
  color: var(--color-error);
}

.start-button {
  width: 100%;
  height: 36px;
  margin-top: 12px;
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: #fff;
  font-size: 13px;
}

.start-button:hover:not(:disabled) {
  border-color: var(--color-accent-hover);
  background: var(--color-accent-hover);
}

.model-hint {
  margin: 10px 0 0;
  padding: 8px 10px;
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--color-warning-light);
  color: var(--color-text-muted);
  font-size: 11.5px;
  line-height: 1.65;
}

.model-hint code {
  padding: 0 3px;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.05);
  font-size: 11px;
}

.queue-empty {
  color: var(--color-text-light);
  font-size: 12px;
}

.queue-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.queue-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  background: var(--color-surface-muted);
  font-size: 11.5px;
}

.pulse-dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-info);
  animation: pulse 1.4s ease-in-out infinite;
}

.queue-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-status {
  flex-shrink: 0;
  color: var(--color-text-light);
}

.leaf-stage {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.stage-card {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  overflow: hidden;
}

.stage-head {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--color-border-light);
}

.stage-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.stage-title h2 {
  max-width: 320px;
  overflow: hidden;
  font-size: 13.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-pill {
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--color-surface-hover);
  color: var(--color-text-muted);
  font-size: 11px;
}

.status-pill.is-completed {
  background: var(--color-primary-green-lightest);
  color: var(--color-primary-green-dark);
}

.status-pill.is-processing,
.status-pill.is-queued {
  background: var(--color-info-light);
  color: var(--color-info);
}

.status-pill.is-failed {
  background: var(--color-error-light);
  color: var(--color-error);
}

.model-tag {
  padding: 1px 6px;
  border: 1px solid var(--color-border-light);
  border-radius: 4px;
  background: var(--color-surface-muted);
  color: var(--color-text-light);
  font-size: 10.5px;
}

.stage-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.unit-select {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--color-text-muted);
  font-size: 11.5px;
}

.unit-select select {
  width: 66px;
  height: 26px;
  padding: 0 22px 0 8px;
  font-size: 11.5px;
}

.stage-actions button {
  height: 28px;
  padding: 0 10px;
  font-size: 11.5px;
}

.stage-actions .danger,
.records-actions .danger {
  border-color: rgba(220, 38, 38, 0.25);
  background: var(--color-surface);
  color: var(--color-error);
}

.stage-actions .danger:hover:not(:disabled),
.records-actions .danger:hover:not(:disabled) {
  border-color: rgba(220, 38, 38, 0.4);
  background: var(--color-error-light);
  color: var(--color-error);
}

.stage-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: 14px;
  padding: 12px 16px 14px;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.viewer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  min-height: 0;
}

.viewer-bar {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  min-height: 30px;
}

.viewer-open {
  flex-shrink: 0;
  font-size: 11px;
}

.viewer-tabs {
  display: inline-flex;
  gap: 4px;
  padding: 3px;
  border-radius: var(--radius-full);
  background: var(--color-surface-hover);
  align-self: flex-start;
}

.viewer-tabs button {
  height: 24px;
  padding: 0 12px;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-text-muted);
  font-size: 11.5px;
}

.viewer-tabs button.active {
  background: var(--color-surface);
  box-shadow: var(--shadow-xs);
  color: var(--color-text-primary);
}

.viewer-canvas {
  position: relative;
  flex: 1 1 auto;
  min-height: 140px;
  overflow: hidden;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  background: var(--color-surface-muted);
  isolation: isolate;
  touch-action: none;
}

.viewer-canvas img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  transform-origin: center center;
  user-select: none;
  transition: transform 160ms ease-out;
  will-change: transform;
}

.viewer-canvas.dragging img {
  transition: none;
}

.viewer-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-light);
  font-size: 12px;
}

.zoom-pill {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 5px 3px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  color: var(--color-text-secondary);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  animation: popIn 160ms ease backwards;
}

.zoom-pill button {
  height: 20px;
  padding: 0 8px;
  border-radius: var(--radius-full);
  font-size: 11px;
}

.viewer-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.82);
  color: var(--color-text-secondary);
  font-size: 12px;
  text-align: center;
}

.viewer-overlay.failed {
  color: var(--color-error);
}

.viewer-overlay.failed span {
  max-width: 78%;
  font-size: 11.5px;
  line-height: 1.6;
}

.spinner {
  width: 12px;
  height: 12px;
  border: 1.5px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.metric-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.metric-head {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 2px;
}

.metric-head h3 {
  margin: 0;
  font-size: 12.5px;
  font-weight: 600;
}

.scale-note {
  color: var(--color-text-light);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.metric-hint {
  margin: 0;
  padding: 12px;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-light);
  font-size: 11.5px;
  line-height: 1.7;
}

.metric-hint.error {
  border-color: rgba(220, 38, 38, 0.28);
  background: var(--color-error-light);
  color: var(--color-error);
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  align-content: start;
  padding-right: 2px;
}

.metric-card {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 6px 9px;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  animation: fadeInUp 200ms ease backwards;
}

.metric-label {
  color: var(--color-text-muted);
  font-size: 10.5px;
}

.metric-value {
  color: var(--color-text-primary);
  font-size: 12.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.metric-sub {
  color: var(--color-text-light);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.stage-empty {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 0;
  padding: 32px;
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-xl);
  background: var(--color-surface-muted);
  text-align: center;
}

.stage-empty svg {
  width: 40px;
  height: 40px;
  color: var(--color-primary-green-light);
}

.stage-empty h2 {
  margin: 4px 0 0;
  font-size: 14px;
}

.stage-empty p {
  color: var(--color-text-light);
  font-size: 12px;
}

.records {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 8px;
  padding: 10px 14px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
}

.records-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.records-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.records-title h2 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.records-count {
  color: var(--color-text-light);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
}

.records-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.records-actions button {
  height: 26px;
  padding: 0 9px;
  font-size: 11.5px;
}

.records-actions .ghost {
  border-color: transparent;
  background: transparent;
  color: var(--color-text-muted);
}

.records-actions .ghost:hover:not(:disabled) {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}

.export-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  background: var(--color-info-light);
  color: var(--color-info);
  font-size: 11.5px;
}

.export-error {
  margin: 0;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  background: var(--color-error-light);
  color: var(--color-error);
  font-size: 11.5px;
}

.records-empty {
  margin: 0;
  padding: 20px 0;
  color: var(--color-text-light);
  font-size: 12px;
  text-align: center;
}

.record-strip {
  display: flex;
  gap: 10px;
  padding-bottom: 2px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
}

.record-card {
  flex: 0 0 176px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  cursor: pointer;
}

.record-card.selected {
  border-color: var(--color-primary-green);
}

.thumb {
  position: relative;
  height: 68px;
  background: var(--color-surface-muted);
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-light);
  font-size: 11px;
}

.thumb-check {
  position: absolute;
  top: 6px;
  left: 6px;
  display: flex;
  padding: 2px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.86);
}

.record-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px 10px 10px;
}

.record-meta strong {
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: 11.5px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-foot {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--color-text-light);
  font-size: 10.5px;
}

.status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-text-light);
}

.status-dot.is-completed {
  background: var(--color-success);
}

.status-dot.is-processing,
.status-dot.is-queued {
  background: var(--color-info);
  animation: pulse 1.4s ease-in-out infinite;
}

.status-dot.is-failed {
  background: var(--color-error);
}

.dot-sep {
  color: var(--color-border-strong);
}

.batch-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  margin-top: 1px;
  padding: 1px 6px;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-full);
  background: var(--color-surface-muted);
  color: var(--color-text-light);
  font-size: 10px;
  line-height: 1.6;
  cursor: pointer;
}

.batch-chip svg {
  flex-shrink: 0;
  width: 10px;
  height: 10px;
}

.batch-chip span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.batch-chip:hover {
  border-color: var(--color-primary-green-light);
  color: var(--color-primary-green-dark);
}

.batch-chip.active {
  border-color: var(--color-primary-green-lightest);
  background: var(--color-primary-green-bg);
  color: var(--color-primary-green-dark);
}

.alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border: 1px solid rgba(220, 38, 38, 0.2);
  border-radius: var(--radius-md);
  background: var(--color-error-light);
  color: var(--color-error);
  font-size: 12px;
  animation: alertIn 200ms ease backwards;
}

.alert-close {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  font-size: 14px;
  line-height: 1;
}

@media (max-width: 1180px) {
  .leaf-layout {
    grid-template-columns: 300px minmax(0, 1fr);
  }

  .leaf-page {
    height: auto;
  }

  .leaf-stage {
    overflow: visible;
  }

  .stage-card {
    flex: 0 0 auto;
  }

  .stage-body {
    grid-template-columns: minmax(0, 1fr);
    overflow: visible;
  }

  .viewer-canvas {
    flex: none;
    height: min(42vh, 340px);
  }

  .metric-panel {
    overflow: visible;
  }

  .metric-grid {
    overflow: visible;
    max-height: none;
  }
}

@media (max-width: 900px) {
  .leaf-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .leaf-setup {
    position: static;
  }
}
</style>
