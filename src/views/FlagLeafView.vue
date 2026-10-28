<template>
  <div class="leaf-page">
    <div v-if="leafStore.error" class="alert" role="alert">
      <span>{{ leafStore.error }}</span>
      <button type="button" class="alert-close" @click="leafStore.setError(null)">×</button>
    </div>

    <div class="leaf-layout">
      <!-- 左：分析设置 + 队列 -->
      <aside class="leaf-setup">
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

          <ul v-if="pickedFiles.length" class="chips">
            <li v-for="(file, index) in pickedFiles" :key="`${file.name}-${index}`" class="chip">
              <span class="chip-name" :title="file.name">{{ file.name }}</span>
              <span class="chip-size">{{ (file.size / 1024).toFixed(0) }} KB</span>
              <button type="button" class="chip-remove" :title="t('移除')" @click="removeFile(index)">×</button>
            </li>
          </ul>

          <button
            type="button"
            class="start-button"
            :disabled="leafStore.uploading || pickedFiles.length === 0 || !leafStore.currentModel"
            @click="startAnalysis"
          >
            {{ leafStore.uploading
              ? t('上传中 {n}%', { n: leafStore.uploadPercent })
              : (pickedFiles.length ? t('开始分析（{n} 张）', { n: pickedFiles.length }) : t('开始分析')) }}
          </button>

          <p v-if="!leafStore.models.length && leafStore.modelsLoaded" class="model-hint">
            {{ t('剑叶模型尚未部署。把权重放到 models_yolo/leaf.pt，或在 .env 的 LEAF_MODELS 里登记路径后重启后端。') }}
          </p>
        </section>

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

      <!-- 右：结果舞台 -->
      <main class="leaf-stage">
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
            <!-- 单图查看器：原图 / 分割图 用标签页切换（茎秆页是左右双图对照） -->
            <div class="viewer">
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

            <!-- 指标网格：剑叶专属口径 -->
            <div class="metric-panel">
              <div class="metric-head">
                <h3>{{ t('结构指标') }}</h3>
                <span v-if="leafStore.metrics" class="scale-note">
                  {{ t('比例尺 {n} µm/px', { n: leafStore.metrics.scaleUmPerPx }) }}
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

        <section v-else class="stage-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 19C5 10.5 10 4.5 20 4c.5 9.5-5.5 15-15 15Z" />
            <path d="M5 19c2.5-4.5 6-8 11-10.5" />
          </svg>
          <h2>{{ t('还没有选中样本') }}</h2>
          <p>{{ t('先在左侧上传剑叶切片图，或在下方记录条里点一张卡片。') }}</p>
        </section>

        <!-- 记录：横向卡片条（茎秆页是竖向列表） -->
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

          <div v-else class="record-strip">
            <article
              v-for="job in leafStore.history"
              :key="job.analysisId"
              class="record-card"
              :class="{ selected: leafStore.selectedJob?.analysisId === job.analysisId }"
              @click="selectJob(job)"
            >
              <div class="thumb">
                <img
                  v-if="job.annotatedImageUrl || job.originalPreviewUrl || job.originalImageUrl"
                  :src="job.annotatedImageUrl || job.originalPreviewUrl || job.originalImageUrl"
                  :alt="job.originalFilename"
                  loading="lazy"
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
              </div>
            </article>
          </div>
        </section>
      </main>
    </div>

    <!-- 导出列选择弹窗：点“导出选中 Excel”后弹出，确认后才真正提交导出 -->
    <div v-if="showExportDialog" class="dialog-overlay" @click.self="closeExportDialog">
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="leaf-export-title">
        <header class="dialog-head">
          <h3 id="leaf-export-title">{{ t('选择导出列') }}</h3>
          <button type="button" class="dialog-close" :aria-label="t('关闭')" @click="closeExportDialog">×</button>
        </header>

        <p class="dialog-hint">
          {{ t('将导出 {done} 条已完成记录（已勾选 {checked} 条），单位 {unit}，已选 {sel} / {total} 列。', {
            done: leafStore.completedSelected.length,
            checked: leafStore.selectedIds.length,
            unit: draftUnit,
            sel: draftColumns.length,
            total: columns.length,
          }) }}
        </p>

        <div class="dialog-units">
          <span class="dialog-units-label">{{ t('导出单位') }}</span>
          <div class="unit-options">
            <button
              v-for="option in UNIT_OPTIONS"
              :key="option.value"
              type="button"
              class="unit-option"
              :class="{ active: draftUnit === option.value }"
              @click="draftUnit = option.value"
            >{{ option.label }}</button>
          </div>
        </div>

        <div class="dialog-tools">
          <button type="button" class="link-button" @click="draftAllColumns">{{ t('全选') }}</button>
          <button type="button" class="link-button" @click="draftCoreColumns">{{ t('只看核心') }}</button>
          <button type="button" class="link-button" @click="draftClearColumns">{{ t('清空') }}</button>
        </div>

        <div class="columns-grid dialog-columns">
          <label v-for="column in columns" :key="column.key" class="column-item">
            <input v-model="draftColumns" type="checkbox" :value="column.key" />
            <span>{{ column.label }}</span>
          </label>
        </div>

        <footer class="dialog-actions">
          <button type="button" @click="closeExportDialog">{{ t('取消') }}</button>
          <button
            type="button"
            class="primary"
            :disabled="!draftColumns.length || !leafStore.completedSelected.length || excelStore.isLoading"
            @click="confirmExport"
          >{{ excelStore.isLoading ? t('导出中…') : t('确认导出') }}</button>
        </footer>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from '@/i18n';

const { t } = useI18n();
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { useLeafStore } from '@/stores/leaf';
import { useExcelStore } from '@/stores/excel';
import { excelService } from '@/services/excelServerce';
import { exportService } from '@/services/exportService';

const leafStore = useLeafStore();
const excelStore = useExcelStore();

const fileInput = ref(null);
const pickedFiles = ref([]);
const dragging = ref(false);
const viewTab = ref('annotated');
const columns = ref([]);
const selectedColumns = ref([]);
// 导出列弹窗：draftColumns 是弹窗里的临时勾选，点“确认导出”才写回 selectedColumns
const showExportDialog = ref(false);
const draftColumns = ref([]);
// 弹窗里的导出单位（只影响这一次导出，不改变页面上的指标单位）
const draftUnit = ref('μm');
const UNIT_OPTIONS = [
  { value: 'μm', label: 'µm' },
  { value: 'mm', label: 'mm' },
  { value: 'cm', label: 'cm' },
];

const allRecordsSelected = computed(() =>
  leafStore.history.length > 0 && leafStore.selectedIds.length === leafStore.history.length
);

// ---------------- 缩放 ----------------
const zoom = reactive({
  scale: 1, x: 0, y: 0, dragging: false,
  startX: 0, startY: 0, originX: 0, originY: 0,
});

const currentImage = computed(() => {
  const job = leafStore.selectedJob;
  if (!job) return null;
  // 原图可能是 TIFF（浏览器无法直接显示），后端会额外生成 JPEG 预览
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

// ---------------- 文件选择 ----------------
const isImage = (file) => Boolean(file && file.type && file.type.startsWith('image/'));

function addFiles(list) {
  const images = Array.from(list || []).filter(isImage);
  pickedFiles.value = [...pickedFiles.value, ...images];
}

function onPick(event) {
  addFiles(event.target.files);
  event.target.value = '';
}

function onDrop(event) {
  dragging.value = false;
  addFiles(event.dataTransfer?.files);
}

function removeFile(index) {
  pickedFiles.value.splice(index, 1);
}

async function startAnalysis() {
  const files = pickedFiles.value;
  if (!files.length) return;
  const response = await leafStore.upload(files);
  if (!response) return;

  pickedFiles.value = [];
  await leafStore.fetchHistory(false);

  // 单张上传时自动选中这条记录；批量时选中批次里的第一条
  const targetId = response.analysisId || response.analyses?.[0]?.analysisId || null;
  const target = leafStore.history.find(job => job.analysisId === targetId) || leafStore.history[0];
  if (target) await leafStore.selectJob(target);
}

// ---------------- 展示辅助 ----------------
// 这里存中文原文，t() 放在读取时调用，切换语言才能即时生效
const STATUS_TEXT = {
  processing: '处理中',
  completed: '已完成',
  failed: '失败',
  pending: '等待中',
  queued: '排队中',
};

function statusLabel(status) {
  return t(STATUS_TEXT[status] || status || '未知');
}

/** 去掉上传时加的 uuid 前缀（保留原文件名与时间戳） */
function stripUuidPrefix(name) {
  return String(name).replace(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}[_-]/,
    ''
  );
}

/** 标题用的名字：uuid、扩展名、时间戳都去掉，只留原始文件名 */
function cleanName(name) {
  if (!name) return t('未命名样本');
  return stripUuidPrefix(name)
    .replace(/\.\w+$/, '')
    .replace(/_\d{8}_\d{6}$/, '');
}

/** 记录卡片用的名字：保留上传时间戳（去掉扩展名），方便区分同名文件 */
function cardName(name) {
  if (!name) return t('未命名样本');
  return stripUuidPrefix(name).replace(/\.\w+$/, '');
}

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const number = Number(value);
  if (Math.abs(number) >= 1000) return number.toFixed(1);
  return number.toFixed(2);
}

// 剑叶关键指标：面积 / 周长 / 维管束计数
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
    { label: t('侧脉1周长÷2'), value: length(metrics.side1HalfPerimeter) },
    { label: t('侧脉2周长÷2'), value: length(metrics.side2HalfPerimeter) },
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

// ---------------- 记录操作 ----------------
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

// ---------------- 导出 ----------------
function selectAllColumns() {
  selectedColumns.value = columns.value.map(column => column.key);
}

const CORE_COLUMNS = [
  'filename', 'scaleUmPerPx', 'sectionArea', 'tissueArea',
  'body1Area', 'body2Area', 'side1Area', 'side2Area',
  'body1Perimeter', 'side1Perimeter', 'side2Perimeter',
  'bodyBigCount', 'bodySmallCount', 'cavitySmallCount',
  'side1BigCount', 'side1SmallCount', 'side2BigCount', 'side2SmallCount',
];

async function loadColumns() {
  try {
    const data = await excelService.getExportColumns('leaf');
    columns.value = Object.entries(data.available_columns || {}).map(([key, label]) => ({ key, label }));
    if (!selectedColumns.value.length) selectAllColumns();
  } catch (err) {
    console.error('Load leaf export columns failed:', err);
  }
}

async function exportSingle() {
  const job = leafStore.selectedJob;
  if (!job) return;
  await excelStore.downloadSingleExcelAction(
    job.analysisId, job.originalFilename, selectedColumns.value, leafStore.unit, 'leaf'
  );
}

// ---- 记录多选：全选 / 取消全选 ----
function toggleSelectAll() {
  if (allRecordsSelected.value) {
    leafStore.clearSelection();
    return;
  }
  const ids = leafStore.history.map(job => job.analysisId);
  if (typeof leafStore.selectAll === 'function') {
    leafStore.selectAll(ids);
  } else {
    // 热更新前创建的 store 实例可能没有 selectAll，直接赋值兜底
    leafStore.selectedIds = ids;
  }
}

// ---- 导出列弹窗 ----
async function openExportDialog() {
  if (!leafStore.selectedIds.length) return;
  // 列配置还没拉回来时先补一次，避免弹窗里是空列表
  if (!columns.value.length) await loadColumns();
  if (!selectedColumns.value.length) selectAllColumns();
  draftColumns.value = [...selectedColumns.value];
  draftUnit.value = leafStore.unit;
  showExportDialog.value = true;
}

function closeExportDialog() {
  showExportDialog.value = false;
}

function draftAllColumns() {
  draftColumns.value = columns.value.map(column => column.key);
}

function draftCoreColumns() {
  draftColumns.value = [...CORE_COLUMNS];
}

function draftClearColumns() {
  draftColumns.value = [];
}

async function confirmExport() {
  if (!draftColumns.value.length) return;
  const ids = leafStore.completedSelected;
  if (!ids.length) {
    leafStore.setError(t('选中的记录里没有已完成的样本，无法导出。'));
    return;
  }
  // 记住这次的选择，下次打开弹窗沿用
  selectedColumns.value = [...draftColumns.value];
  const exportUnit = draftUnit.value;
  showExportDialog.value = false;
  await excelStore.downloadBatchExcelAction(ids, selectedColumns.value, exportUnit, 'leaf');
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

// ---------------- 生命周期 ----------------
onMounted(async () => {
  await Promise.allSettled([
    leafStore.fetchModels(),
    leafStore.fetchHistory(),
    loadColumns(),
  ]);
  if (!leafStore.selectedJob) {
    const first = leafStore.history.find(job => job.status === 'completed') || leafStore.history[0];
    if (first) await leafStore.selectJob(first);
  }
});

onUnmounted(() => {
  leafStore.stopPolling();
  onMouseUp();
});
</script>

<style scoped>
/* ========== 页面骨架：顶部横幅 + 左设置 / 右舞台 ========== */
.leaf-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
  padding: 4px 2px 4px;
}

/* ========== 两栏 ========== */
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

.chips {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 10px 0 0;
  padding: 0;
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

/* ========== 舞台 ========== */
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

/* 删除按钮采用「白底红字」的轻量危险样式。
   注意：main.css 里的 button.danger 是「红底白字」，这里必须显式覆盖
   background，否则会变成红底红字，文字完全看不见。 */
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

/* ---- 单图查看器 ---- */
.viewer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  min-height: 0;
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

/* ---- 指标面板 ---- */
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

/* ---- 空状态 ---- */
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

/* ========== 记录条 ========== */
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

/* ========== 导出列弹窗 ========== */
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
  color: var(--color-text-muted);
  font-size: 11.5px;
  line-height: 1.6;
}

/* 导出单位选择 */
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
  display: inline-flex;
  gap: 12px;
}

/* 覆盖 .columns-grid 的基础高度限制（弹窗里可以滚更长） */
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

/* 横向卡片条 */
.record-strip {
  display: flex;
  gap: 10px;
  padding-bottom: 2px;
  overflow-x: auto;
  scroll-snap-type: x proximity;
}

.record-card {
  flex: 0 0 176px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  cursor: pointer;
  scroll-snap-align: start;
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

/* 错误横幅 */
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

/* 窄屏下（右列放不下"图 + 指标"两栏）退回自然高度：页面可滚动，
   不再强行把两个区块压进一屏，否则内容会被裁掉。 */
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
