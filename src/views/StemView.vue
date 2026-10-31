<template>
  <main class="stem-page">
    <div v-if="analysisStore.error" class="alert" role="alert">
      <span>{{ analysisStore.error }}</span>
      <button type="button" class="alert-close" :aria-label="t('关闭提示')" @click="analysisStore.setError(null)">×</button>
    </div>

    <div class="stem-layout">
      <!-- 左：分析设置 + 队列（与剑叶页同构） -->
      <aside class="stem-setup">
        <section class="setup-card">
          <h2>{{ t('分析设置') }}</h2>

          <label class="field">
            <span class="field-label">{{ t('茎秆模型') }}</span>
            <select
              v-model="analysisStore.currentModelName"
              :disabled="uploading || analysisStore.modelsLoading"
            >
              <option v-if="analysisStore.modelsLoading" value="">{{ t('加载中...') }}</option>
              <option v-else-if="analysisStore.availableModels.length === 0" :value="null">
                {{ t('默认模型') }}
              </option>
              <option
                v-for="m in analysisStore.availableModels"
                :key="m.name"
                :value="m.name"
              >{{ m.name }}</option>
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
              @change="handleFileSelect"
            />
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 21V5" />
              <path d="M12 9c-3.2 0-5.2-1.6-5.2-4.2C10 4.8 12 6.4 12 9Z" />
              <path d="M12 15c3.2 0 5.2-1.6 5.2-4.2C14 10.8 12 12.4 12 15Z" />
            </svg>
            <strong>{{ t('拖拽茎秆切片图到这里') }}</strong>
            <small>{{ t('或点击选择，支持一次多张') }}</small>
          </div>

          <button
            type="button"
            class="folder-button"
            :disabled="uploading"
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
            @change="handleFolderSelect"
          />

          <!-- 待处理文件：点击文件名可在右侧舞台预览 -->
          <template v-if="totalPendingFiles">
            <div v-if="selectedFiles.length" class="chip-group">
              <span class="chip-group-label">{{ t('单张文件 ({n})', { n: selectedFiles.length }) }}</span>
              <ul class="chips">
                <li
                  v-for="(file, index) in selectedFiles"
                  :key="`single-${index}`"
                  class="chip"
                  :class="{ active: isPreviewingFile('single', index) }"
                >
                  <button
                    type="button"
                    class="chip-main"
                    :title="file.name"
                    @click="previewFromPendingList(file, 'single', index)"
                  >
                    <span class="chip-name">{{ file.name }}</span>
                    <span class="chip-size">{{ (file.size / 1024).toFixed(0) }} KB</span>
                  </button>
                  <button
                    type="button"
                    class="chip-remove"
                    :title="t('移除')"
                    @click="removeSelectedFile(index)"
                  >×</button>
                </li>
              </ul>
            </div>

            <div v-if="selectedFolderFiles.length" class="chip-group">
              <span class="chip-group-label">{{ t('文件夹文件 ({n})', { n: selectedFolderFiles.length }) }}</span>
              <ul class="chips">
                <li
                  v-for="(file, index) in selectedFolderFiles"
                  :key="`folder-${index}`"
                  class="chip"
                  :class="{ active: isPreviewingFile('folder', index) }"
                >
                  <button
                    type="button"
                    class="chip-main"
                    :title="file.name"
                    @click="previewFromPendingList(file, 'folder', index)"
                  >
                    <span class="chip-name">{{ file.name }}</span>
                    <span class="chip-size">{{ (file.size / 1024).toFixed(0) }} KB</span>
                  </button>
                  <button
                    type="button"
                    class="chip-remove"
                    :title="t('移除')"
                    @click="removeFolderFile(index)"
                  >×</button>
                </li>
              </ul>
            </div>
          </template>

          <button
            type="button"
            class="start-button"
            :disabled="uploading || totalPendingFiles === 0 || !analysisStore.currentModelName"
            @click="handleUnifiedUpload"
          >
            {{ uploading
              ? t('上传中 {n}%', { n: uploadPercent })
              : (totalPendingFiles ? t('开始分析（{n} 张）', { n: totalPendingFiles }) : t('开始分析')) }}
          </button>

          <div v-if="uploading" class="upload-progress">
            <div class="upload-progress-track">
              <div class="upload-progress-fill" :style="{ width: uploadPercent + '%' }"></div>
            </div>
            <span class="upload-progress-percent">{{ uploadPercent }}%</span>
          </div>

          <p v-if="!analysisStore.availableModels.length && analysisStore.modelsLoaded" class="model-hint">
            {{ t('茎秆模型尚未部署。把权重放到 models_yolo/yolov8s.pt，或在 .env 的 YOLO_MODELS 里登记路径后重启后端。') }}
          </p>
        </section>

        <section class="setup-card">
          <h2>{{ t('处理队列') }}</h2>
          <p v-if="!processingJobs.length" class="queue-empty">{{ t('当前没有进行中的任务') }}</p>
          <ul v-else class="queue-list">
            <li v-for="job in processingJobs" :key="job.analysisId" class="queue-item">
              <span class="pulse-dot"></span>
              <span class="queue-name" :title="job.originalFilename">{{ cleanName(job.originalFilename) }}</span>
              <span class="queue-status">{{ t('推理中') }}</span>
            </li>
          </ul>
        </section>
      </aside>

      <!-- 右：结果舞台 + 记录条 -->
      <main class="stem-stage">
        <section v-if="analysisStore.selectedJob || previewPendingFile" class="stage-card">
          <header class="stage-head">
            <div class="stage-title">
              <h2 :title="stageTitleFull">{{ stageTitle }}</h2>
              <span class="status-pill" :class="`is-${stageStatus}`">{{ statusLabel(stageStatus) }}</span>
              <span v-if="stageModel" class="model-tag">{{ stageModel }}</span>
            </div>

            <div class="stage-actions">
              <template v-if="previewPendingFile">
                <button type="button" class="ghost" @click="clearPreviewPendingFile">
                  {{ t('取消预览') }}
                </button>
              </template>
              <template v-else-if="analysisStore.selectedJob">
                <label class="unit-select">
                  <span>{{ t('单位') }}</span>
                  <select
                    :value="unit"
                    :disabled="analysisStore.selectedJob.status !== 'completed'"
                    @change="onUnitChange"
                  >
                    <option value="μm">µm</option>
                    <option value="mm">mm</option>
                    <option value="cm">cm</option>
                  </select>
                </label>
                <button
                  type="button"
                  :disabled="analysisStore.selectedJob.status !== 'completed' || excelStore.isLoading"
                  @click="exportCurrentExcel"
                >{{ t('导出 Excel') }}</button>
                <button
                  type="button"
                  :disabled="analysisStore.selectedJob.status !== 'completed' || isExporting"
                  @click="exportCurrentJson"
                >{{ t('导出 JSON') }}</button>
                <button
                  type="button"
                  class="danger"
                  :disabled="analysisStore.isLoading"
                  @click="deleteCurrentJob"
                >{{ t('删除') }}</button>
              </template>
            </div>
          </header>

          <div class="stage-body">
            <!-- 单图查看器：原图 / 分割图 用标签页切换（与剑叶页一致） -->
            <div class="viewer">
              <div class="viewer-bar">
                <div v-if="previewPendingFile" class="viewer-caption">
                  {{ t('待处理图片预览') }}
                </div>
                <div v-else class="viewer-tabs">
                  <button
                    type="button"
                    :class="{ active: viewTab === 'annotated' }"
                    :disabled="!annotatedUrl"
                    @click="viewTab = 'annotated'"
                  >{{ t('分割图') }}</button>
                  <button
                    type="button"
                    :class="{ active: viewTab === 'original' }"
                    :disabled="!originalImageUrl"
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
                  v-if="currentImage && !imageStatus.error"
                  ref="viewerImgRef"
                  :key="currentImage"
                  :src="withRetry(currentImage, retryToken)"
                  :alt="viewTab === 'annotated' ? t('分割图片') : t('原始图片')"
                  draggable="false"
                  decoding="async"
                  fetchpriority="high"
                  :class="{ loading: !imageStatus.loaded }"
                  :style="{ transform: `scale(${zoom.scale}) translate(${zoom.x}px, ${zoom.y}px)` }"
                  @load="imageLoaded"
                  @error="handleImageError"
                />

                <p v-if="!currentImage" class="viewer-empty">{{ viewerEmptyText }}</p>
                <div
                  v-else-if="!previewPendingFile && viewTab === 'annotated' && analysisStore.selectedJob?.status === 'processing'"
                  class="viewer-overlay"
                >
                  <span class="spinner"></span>
                  {{ t('正在分割，请稍候…') }}
                </div>
                <div
                  v-else-if="!previewPendingFile && viewTab === 'annotated' && analysisStore.selectedJob?.status === 'failed'"
                  class="viewer-overlay failed"
                >
                  <strong>{{ t('分析失败') }}</strong>
                  <span>{{ analysisStore.selectedJob.errorMessage || t('未返回具体原因') }}</span>
                </div>
                <div v-else-if="imageStatus.error" class="viewer-overlay failed">
                  <strong>{{ viewTab === 'annotated' ? t('无法加载标注图片') : t('无法加载原始图片') }}</strong>
                  <span>{{ imageErrorDetail || t('未返回具体原因') }}</span>
                </div>
                <div v-else-if="!imageStatus.loaded" class="viewer-overlay">
                  <span class="spinner"></span>
                  {{ t('图片加载中…') }}
                </div>

                <div v-if="zoom.scale !== 1 || zoom.x !== 0 || zoom.y !== 0" class="zoom-pill">
                  <span>{{ (zoom.scale * 100).toFixed(0) }}%</span>
                  <button type="button" @click="resetZoom">{{ t('重置') }}</button>
                </div>
              </div>
            </div>

            <!-- 结构指标：口径与导出 Excel 的 15 项一致 -->
            <div class="metric-panel">
              <div class="metric-head">
                <h3>{{ t('结构指标') }}</h3>
                <span v-if="metrics" class="scale-note">
                  {{ scalePerPx !== null
                    ? t('比例尺 {n} {unit}/px', { n: formatScale(scalePerPx), unit: unitSymbol })
                    : `${t('单位')} ${unit}` }}
                </span>
              </div>

              <p v-if="previewPendingFile" class="metric-hint">
                {{ t('这是待处理图片，开始分析后这里会展示茎秆直径、周长与维管束计数等指标。') }}
              </p>
              <p v-else-if="!analysisStore.selectedJob || analysisStore.selectedJob.status !== 'completed'" class="metric-hint">
                {{ t('分析完成后展示茎秆直径、周长、面积与各类维管束计数。') }}
              </p>
              <p v-else-if="metricsLoading" class="metric-hint">{{ t('指标计算中…') }}</p>
              <p v-else-if="metricsError" class="metric-hint error">{{ metricsError }}</p>
              <p v-else-if="!metrics" class="metric-hint">
                {{ t('分析完成后展示茎秆直径、周长、面积与各类维管束计数。') }}
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
            <path d="M12 21V5" />
            <path d="M12 9c-3.2 0-5.2-1.6-5.2-4.2C10 4.8 12 6.4 12 9Z" />
            <path d="M12 15c3.2 0 5.2-1.6 5.2-4.2C14 10.8 12 12.4 12 15Z" />
          </svg>
          <h2>{{ t('还没有选中样本') }}</h2>
          <p>{{ t('先在左侧上传茎秆切片图，或在下方记录条里点一张卡片。') }}</p>
        </section>

        <!-- 记录：横向卡片条 -->
        <section class="records">
          <header class="records-head">
            <div class="records-title">
              <h2>{{ t('茎秆记录') }}</h2>
              <span class="records-count">{{ history.length }}</span>
            </div>
            <div class="records-actions">
              <button
                type="button"
                class="ghost"
                :disabled="!history.length || excelStore.isLoading"
                @click="toggleSelectAll"
              >{{ isAllSelected ? t('取消全选') : t('全选') }}</button>
              <button
                type="button"
                :disabled="!selectedAnalysisIds.length || excelStore.isLoading"
                @click="openDownloadDialog"
              >{{ selectedAnalysisIds.length
                ? t('导出选中 Excel（{done}/{total}）', { done: selectedCompletedCount, total: selectedAnalysisIds.length })
                : t('导出选中 Excel') }}</button>
              <button
                type="button"
                :disabled="!selectedCompletedCount || isExporting"
                @click="batchExportJson"
              >{{ isExporting ? t('导出中...') : t('导出选中 JSON') }}</button>
              <button
                type="button"
                class="danger"
                :disabled="!selectedAnalysisIds.length || analysisStore.isLoading"
                @click="handleBatchDelete"
              >{{ t('删除选中') }}</button>
            </div>
          </header>

          <div v-if="excelStore.isLoading" class="export-progress">
            <span class="spinner"></span>
            <span>{{ excelStore.taskMessage || t('正在生成 Excel…') }}</span>
            <span v-if="excelStore.taskTotal">{{ excelStore.taskProgress }}/{{ excelStore.taskTotal }}</span>
          </div>
          <p v-if="excelStore.error" class="export-error">{{ excelStore.error }}</p>

          <div
            v-if="analysisStore.isLoading && !history.length"
            class="record-strip record-skeleton-strip"
            aria-hidden="true"
          >
            <div v-for="index in 4" :key="index" class="record-skeleton-card">
              <span class="record-skeleton-thumb"></span>
              <span class="record-skeleton-line"></span>
              <span class="record-skeleton-line short"></span>
            </div>
          </div>
          <p v-else-if="!history.length" class="records-empty">
            {{ t('暂无茎秆分析记录，上传第一张切片图开始。') }}
          </p>

          <div
            v-else
            ref="recordStripRef"
            class="record-strip"
            @wheel="onRecordWheel"
          >
            <article
              v-for="job in history"
              :key="job.analysisId"
              class="record-card"
              :class="{ selected: analysisStore.selectedJob?.analysisId === job.analysisId }"
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
                  @load="markThumbLoaded"
                />
                <span v-else class="thumb-empty">{{ t('无图') }}</span>
                <label class="thumb-check" @click.stop>
                  <input
                    type="checkbox"
                    :checked="selectedAnalysisIds.includes(job.analysisId)"
                    @change="toggleSelectJob(job.analysisId)"
                  />
                </label>
              </div>
              <div class="record-meta">
                <strong :title="job.originalFilename">{{ cardName(job.originalFilename) }}</strong>
                <span class="record-foot">
                  <span
                    class="status-dot"
                    :class="`is-${job.status}`"
                    :title="job.status === 'failed' && job.errorMessage
                      ? t('分析失败：{msg}', { msg: job.errorMessage })
                      : statusLabel(job.status)"
                  ></span>
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

    <!-- Excel 导出列选择弹窗（与剑叶页共用） -->
    <ExportColumnsDialog
      :visible="showDownloadDialog"
      group="stem"
      :default-selected="['filename', 'scalePerPx']"
      :busy="excelStore.isLoading"
      @close="closeDownloadDialog"
      @confirm="handleExportConfirm"
    />

    <!-- Toast 提示 -->
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
import { useI18n } from '@/i18n';

const { t } = useI18n();
import { ref, reactive, watch, computed, nextTick, onMounted, onUnmounted } from 'vue';
import { useStemAnalysisStore } from '@/stores/stemAnalysis';
import { useExcelExportStore } from '@/stores/excelExport';
import { analysisService } from '@/services/analysisService';
import { exportService } from '@/services/exportService';
import ExportColumnsDialog from '@/components/ExportColumnsDialog.vue';
import { useHorizontalWheelScroll } from '@/composables/useHorizontalWheelScroll';
import { useBatchSelection } from '@/composables/useBatchSelection';
import {
  cardName,
  cleanName,
  displayModelUsed,
  formatNumber,
  formatScale,
  formatTime,
  scalePerPxOf,
  statusLabel,
  unitSymbolOf,
} from '@/utils/sampleDisplay';
import { beginCriticalOperation, endCriticalOperation } from '@/services/apiClient';

const analysisStore = useStemAnalysisStore();
const excelStore = useExcelExportStore();

const history = computed(() => analysisStore.historyList);
const processingJobs = computed(() => history.value.filter(job => job.status === 'processing'));

// ---------------- 文件选择 ----------------
const fileInput = ref(null);
const folderInput = ref(null);
const selectedFiles = ref([]);
const selectedFolderFiles = ref([]);
const dragging = ref(false);
const uploading = ref(false);
const uploadPercent = ref(0);

const totalPendingFiles = computed(() => selectedFiles.value.length + selectedFolderFiles.value.length);
const isImage = (file) => Boolean(file && file.type && file.type.startsWith('image/'));

// ---------------- 待处理文件预览 ----------------
const previewPendingFile = ref(null);
const blobUrls = new Set();

// ---------------- 单图查看器：标签切换 + 缩放 / 拖拽 ----------------
const viewTab = ref('annotated');
const viewerImgRef = ref(null);
const imageStatus = reactive({ loaded: false, error: false });
// 图片加载失败时附加的可读原因（HTTP 状态 / 网络错误），显示在错误提示里
const imageErrorDetail = ref('');
// 失败重试的时间戳参数：0 表示还没重试过，非 0 时拼到 URL 上绕过浏览器缓存
const retryToken = ref(0);

const withRetry = (url, token) => {
  if (!url || !token) return url;
  return `${url}${url.includes('?') ? '&' : '?'}__retry=${token}`;
};

const zoom = reactive({
  scale: 1,
  x: 0,
  y: 0,
  dragging: false,
  startX: 0,
  startY: 0,
  originX: 0,
  originY: 0,
});

// ---------------- 指标 ----------------
const unit = ref('μm');
const metrics = ref(null);
const metricsLoading = ref(false);
const metricsError = ref('');
const metricsJobId = ref(null);
// 同一条记录 + 同一单位只算一次；轮询刷新历史时不会重复触发
let lastMetricsKey = '';

const selectedJob = computed(() => analysisStore.selectedJob);
const annotatedUrl = computed(() => selectedJob.value?.annotatedImageUrl || '');
const originalImageUrl = computed(() =>
  selectedJob.value?.originalPreviewUrl || selectedJob.value?.originalImageUrl || ''
);

const currentImage = computed(() => {
  if (previewPendingFile.value) return previewPendingFile.value.blobUrl;
  const job = selectedJob.value;
  if (!job) return '';
  // 原图可能是 TIFF（浏览器无法直接显示），后端会额外生成 JPEG 预览
  return viewTab.value === 'annotated'
    ? (job.annotatedImageUrl || job.originalPreviewUrl || job.originalImageUrl || '')
    : (job.originalPreviewUrl || job.originalImageUrl || job.annotatedImageUrl || '');
});

const stageTitle = computed(() =>
  previewPendingFile.value
    ? previewPendingFile.value.name
    : cleanName(selectedJob.value?.originalFilename)
);
const stageTitleFull = computed(() =>
  previewPendingFile.value ? previewPendingFile.value.name : (selectedJob.value?.originalFilename || '')
);
const stageStatus = computed(() =>
  previewPendingFile.value ? 'pending' : (selectedJob.value?.status || 'pending')
);
const stageModel = computed(() =>
  previewPendingFile.value ? null : displayModelUsed(selectedJob.value?.modelUsed)
);

const viewerEmptyText = computed(() => {
  if (previewPendingFile.value) return t('无图片');
  if (selectedJob.value?.filesMissing) {
    return t('原始图片文件已丢失（可能已被清理），建议删除该记录后重新分析');
  }
  return t('该记录没有可显示的图片');
});

// ---------------- 状态轮询 ----------------
watch(() => analysisStore.selectedJob?.status, (status) => {
  if (status === 'processing') {
    analysisStore.startHistoryPolling('job');
  } else {
    analysisStore.stopHistoryPolling('job');
  }
  // 分割刚跑完：自动拉取指标，用户不用再点一次记录卡片
  if (status === 'completed' && analysisStore.selectedJob) {
    fetchMetrics(analysisStore.selectedJob, true);
  }
}, { immediate: true });

// 队列里有任务在跑时也保持轮询，左侧队列才能实时更新
watch(() => processingJobs.value.length, (count) => {
  if (count > 0) {
    analysisStore.startHistoryPolling('queue');
  } else {
    analysisStore.stopHistoryPolling('queue');
  }
}, { immediate: true });

// 仅在切换到另一条记录时重置缩放/拖拽状态，
// 避免轮询刷新历史时把用户的缩放重置掉。
watch(() => analysisStore.selectedJob?.analysisId, () => {
  resetZoom();
  if (analysisStore.selectedJob?.status === 'completed') {
    fetchMetrics(analysisStore.selectedJob);
  } else {
    metrics.value = null;
    metricsError.value = '';
    metricsJobId.value = null;
  }
});

async function fetchMetrics(job, force = false) {
  if (!job || job.status !== 'completed') {
    metrics.value = null;
    metricsError.value = '';
    metricsJobId.value = null;
    return;
  }

  const key = `${job.analysisId}:${unit.value}`;
  if (metricsLoading.value && lastMetricsKey === key) return;
  if (!force && metricsJobId.value === job.analysisId && lastMetricsKey === key) return;

  lastMetricsKey = key;
  metricsLoading.value = true;
  metricsError.value = '';
  try {
    const data = await analysisService.getMetrics(job.analysisId, { unit: unit.value });
    // 选中的记录可能已经切换，丢弃过期响应
    if (analysisStore.selectedJob?.analysisId === job.analysisId) {
      metrics.value = data.metrics || null;
      metricsJobId.value = job.analysisId;
    }
  } catch (err) {
    metricsError.value = err.response?.data?.detail || err.message || t('指标加载失败');
    metrics.value = null;
    metricsJobId.value = null;
  } finally {
    metricsLoading.value = false;
  }
}

function onUnitChange(event) {
  unit.value = event.target.value;
  if (analysisStore.selectedJob?.status === 'completed') {
    fetchMetrics(analysisStore.selectedJob, true);
  }
}

// 比例尺随单位换算：统一走公共工具，切换单位时优先用恒为 µm/px 的值换算
const unitSymbol = computed(() => unitSymbolOf(unit.value));

const scalePerPx = computed(() => scalePerPxOf(metrics.value, unit.value));

// 茎秆指标：与导出 Excel 的 15 项口径一致
const metricCards = computed(() => {
  const m = metrics.value;
  if (!m) return [];

  const u = unit.value;
  const area = (value) => `${formatNumber(value)} ${u}²`;
  const length = (value) => `${formatNumber(value)} ${u}`;
  const count = (value) => t('{n} 个', { n: value ?? 0 });
  const ratio = (value) => formatNumber(value);

  return [
    { label: t('茎秆直径'), value: length(m.stemDiameter) },
    { label: t('茎秆周长'), value: length(m.stemPerimeter) },
    { label: t('茎秆面积'), value: area(m.stemArea) },
    { label: t('空腔面积'), value: area(m.cavityArea) },
    { label: t('茎秆面积与空腔面积差值'), value: area(m.stemCavityAreaDiff) },
    {
      label: t('大维管束数目'),
      value: count(m.largeTailCount),
      sub: t('平均 {v}', { v: area(m.largeTailArea) }),
    },
    {
      label: t('小维管束数目'),
      value: count(m.smallTailCount),
      sub: t('平均 {v}', { v: area(m.smallTailArea) }),
    },
    { label: t('总维管束数目'), value: count(m.totalCount) },
    { label: t('大维管束面积'), value: area(m.largeTailArea) },
    { label: t('小维管束面积'), value: area(m.smallTailArea) },
    { label: t('大/小维管束面积比'), value: ratio(m.largeSmallAreaRatio) },
    { label: t('大/小维管束数目比'), value: ratio(m.largeSmallCountRatio) },
    { label: t('空腔/茎秆面积比'), value: ratio(m.cavityStemAreaRatio) },
    { label: t('小维管束/茎秆周长比'), value: ratio(m.smallCountPerimeterRatio) },
    { label: t('大维管束/周长·空腔差比'), value: ratio(m.largeCountPerimeterCavityRatio) },
  ];
});

// ---------------- 选中 / 导出 ----------------
const selectedAnalysisIds = ref([]);
const isExporting = ref(false);
const showDownloadDialog = ref(false);
const currentDownloadType = ref('summary');
const dialogJob = ref(null);

const allAnalysisIds = computed(() => history.value.map(job => job.analysisId));
const completedAnalysisIds = computed(() =>
  history.value.filter(job => job.status === 'completed').map(job => job.analysisId)
);
const selectedCompletedCount = computed(() => {
  const completedSet = new Set(completedAnalysisIds.value);
  return selectedAnalysisIds.value.filter(id => completedSet.has(id)).length;
});
const isAllSelected = computed(() =>
  allAnalysisIds.value.length > 0 &&
  allAnalysisIds.value.every(id => selectedAnalysisIds.value.includes(id))
);

const getCompletedSelectedIds = () => {
  const completedSet = new Set(completedAnalysisIds.value);
  return selectedAnalysisIds.value.filter(id => completedSet.has(id));
};

function toggleSelectJob(analysisId) {
  const index = selectedAnalysisIds.value.indexOf(analysisId);
  if (index >= 0) selectedAnalysisIds.value.splice(index, 1);
  else selectedAnalysisIds.value.push(analysisId);
}

function toggleSelectAll() {
  selectedAnalysisIds.value = isAllSelected.value ? [] : [...allAnalysisIds.value];
}

// ---------------- 记录条：滚轮横向浏览 ----------------
const { stripRef: recordStripRef, onWheel: onRecordWheel } = useHorizontalWheelScroll();

// ---------- 批次分组 ----------
const {
  batchCountOf,
  batchNameOf,
  batchChipLabel,
  isBatchSelected,
  toggleBatchSelection,
} = useBatchSelection({
  jobs: history,
  getSelectedIds: () => selectedAnalysisIds.value,
  setSelectedIds: (ids) => { selectedAnalysisIds.value = ids; },
  resolveBatchName: (job) => analysisStore.getBatchName(job.batchId),
});

// 历史刷新后清掉已经不存在的勾选
watch(history, (list) => {
  const ids = new Set(list.map(job => job.analysisId));
  selectedAnalysisIds.value = selectedAnalysisIds.value.filter(id => ids.has(id));
});

// ---------------- 上传 ----------------
function addFiles(list) {
  const images = Array.from(list || []).filter(isImage);
  if (!images.length) return;
  selectedFiles.value = [...selectedFiles.value, ...images];
  analysisStore.setError(null);
  clearPreviewPendingFile();
}

function handleFileSelect(event) {
  const images = Array.from(event.target.files || []).filter(isImage);
  selectedFiles.value = images;
  analysisStore.setError(null);
  clearPreviewPendingFile();
  event.target.value = '';
}

function handleFolderSelect(event) {
  const images = Array.from(event.target.files || []).filter(isImage);
  selectedFolderFiles.value = images;
  analysisStore.setError(null);
  clearPreviewPendingFile();
  event.target.value = '';
}

function onDrop(event) {
  dragging.value = false;
  addFiles(event.dataTransfer?.files);
}

function removeSelectedFile(index) {
  if (previewPendingFile.value && previewPendingFile.value.listType === 'single') {
    if (previewPendingFile.value.index === index) {
      clearPreviewPendingFile();
    } else if (previewPendingFile.value.index > index) {
      previewPendingFile.value.index--;
    }
  }
  selectedFiles.value.splice(index, 1);
}

function removeFolderFile(index) {
  if (previewPendingFile.value && previewPendingFile.value.listType === 'folder') {
    if (previewPendingFile.value.index === index) {
      clearPreviewPendingFile();
    } else if (previewPendingFile.value.index > index) {
      previewPendingFile.value.index--;
    }
  }
  selectedFolderFiles.value.splice(index, 1);
}

function isPreviewingFile(listType, index) {
  if (!previewPendingFile.value) return false;
  return previewPendingFile.value.listType === listType && previewPendingFile.value.index === index;
}

function previewFromPendingList(file, listType, index) {
  if (isPreviewingFile(listType, index)) {
    clearPreviewPendingFile();
    return;
  }
  resetZoom();
  resetImageStatus();

  const blobUrl = URL.createObjectURL(file);
  blobUrls.add(blobUrl);

  previewPendingFile.value = { file, blobUrl, listType, index, name: file.name };
}

function clearPreviewPendingFile() {
  if (!previewPendingFile.value) return;
  const url = previewPendingFile.value.blobUrl;
  if (blobUrls.has(url)) {
    URL.revokeObjectURL(url);
    blobUrls.delete(url);
  }
  previewPendingFile.value = null;
}

// 统一上传分析 —— 根据文件数量自动适配后端单张/批量接口
async function handleUnifiedUpload() {
  if (totalPendingFiles.value === 0) {
    analysisStore.setError(t('请先选择图片文件或文件夹！'));
    return;
  }

  const allFiles = [...selectedFiles.value, ...selectedFolderFiles.value];
  const totalFiles = allFiles.length;
  const isBatch = totalFiles > 1;

  uploading.value = true;
  uploadPercent.value = 0;
  analysisStore.setError(null);

  let response = null;
  beginCriticalOperation();
  try {
    response = await analysisStore.uploadAnalysisAction(
      allFiles,
      analysisStore.currentModelName,
      (percent) => { uploadPercent.value = percent; }
    );
  } finally {
    endCriticalOperation();
    uploading.value = false;
  }

  if (response) {
    uploadPercent.value = 100;
    showToast(
      isBatch
        ? t('已成功提交 {n} 个文件进行批量处理...', { n: totalFiles })
        : t('文件 "{name}" 已成功提交后台处理...', { name: allFiles[0].name }),
      'success'
    );

    const responseBatchId = response.batchId || response.batch_id;
    let jobToSelect = null;
    if (isBatch) {
      analysisStore.startBatchProgressPolling('stem', totalFiles, responseBatchId);
      if (responseBatchId) {
        jobToSelect = analysisStore.historyList.find(j => j.batchId === responseBatchId) || null;
      }
      if (jobToSelect) analysisStore.selectJobAction(jobToSelect);
    } else {
      analysisStore.startBatchProgressPolling('stem', 1, responseBatchId);
      const newAnalysisId = response.analysisId || response.analysis_id;
      if (newAnalysisId) {
        jobToSelect = analysisStore.historyList.find(j => j.analysisId === newAnalysisId) || null;
        if (jobToSelect) analysisStore.selectJobAction(jobToSelect);
      }
    }

    if (!jobToSelect && analysisStore.historyList.length > 0) {
      analysisStore.selectJobAction(analysisStore.historyList[0]);
    }
  }

  selectedFiles.value = [];
  selectedFolderFiles.value = [];
  clearPreviewPendingFile();
  if (fileInput.value) fileInput.value.value = '';
  if (folderInput.value) folderInput.value.value = '';
}

// 选中记录（同时清掉待处理预览）
function selectJob(job) {
  clearPreviewPendingFile();
  analysisStore.selectJobAction(job);
}

// ---------------- 删除 / 导出 ----------------
async function deleteCurrentJob() {
  const job = analysisStore.selectedJob;
  if (!job) return;
  if (!window.confirm(t('确定要删除记录 "{name}" 吗？此操作不可撤销。', { name: job.originalFilename }))) return;
  const success = await analysisStore.deleteJobAction(job.analysisId);
  if (success) showToast(t('删除成功'), 'success');
}

async function handleBatchDelete() {
  if (!selectedAnalysisIds.value.length) return;
  const count = selectedAnalysisIds.value.length;
  const confirmed = window.confirm(t('确定要删除选中的 {n} 条记录吗？此操作不可恢复，同时会清理关联的原图、标注图和 JSON 文件。', { n: count }));
  if (!confirmed) return;

  const result = await analysisStore.batchDeleteAction([...selectedAnalysisIds.value]);
  if (result) {
    selectedAnalysisIds.value = [];
    showToast(t('成功删除 {n} 条记录', { n: result.deleted_count }), 'success');
  }
}

function openDownloadDialog() {
  const ids = getCompletedSelectedIds();
  if (ids.length === 0) {
    analysisStore.setError(t('请先勾选至少一个已完成的任务'));
    return;
  }
  dialogJob.value = history.value.find(job => job.analysisId === ids[0]) || analysisStore.selectedJob;
  currentDownloadType.value = ids.length === 1 ? 'single' : 'batch';
  showDownloadDialog.value = true;
}

function closeDownloadDialog() {
  showDownloadDialog.value = false;
  currentDownloadType.value = 'summary';
}

function exportCurrentExcel() {
  const job = analysisStore.selectedJob;
  if (!job) return;
  dialogJob.value = job;
  currentDownloadType.value = 'single';
  showDownloadDialog.value = true;
}

async function handleExportConfirm({ columns, unit }) {
  let success = false;
  if (currentDownloadType.value === 'single') {
    const job = dialogJob.value || analysisStore.selectedJob;
    if (!job) return;
    success = await excelStore.downloadSingleExcelAction(
      job.analysisId, job.originalFilename, columns, unit, 'stem'
    );
  } else {
    success = await excelStore.downloadBatchExcelAction(
      getCompletedSelectedIds(), columns, unit, 'stem'
    );
  }
  if (success) showToast(t('导出成功'), 'success');
}

async function exportCurrentJson() {
  const job = analysisStore.selectedJob;
  if (!job) return;
  isExporting.value = true;
  try {
    await exportService.exportSingleJson(job.analysisId, job.originalFilename);
    showToast(t('导出成功'), 'success');
  } catch (err) {
    analysisStore.setError(err.response?.data?.detail || t('导出 JSON 失败。'));
  } finally {
    isExporting.value = false;
  }
}

async function batchExportJson() {
  const ids = getCompletedSelectedIds();
  if (ids.length === 0) {
    showToast(t('请先勾选已完成的记录'), 'error');
    return;
  }

  isExporting.value = true;
  try {
    if (ids.length === 1) {
      const job = history.value.find(j => j.analysisId === ids[0]) || analysisStore.selectedJob;
      await exportService.exportSingleJson(ids[0], job?.originalFilename || '');
    } else {
      await exportService.batchExportJson(ids);
    }
    selectedAnalysisIds.value = selectedAnalysisIds.value.filter(id => !ids.includes(id));
    showToast(t('导出成功'), 'success');
  } catch (err) {
    analysisStore.setError(err.response?.data?.detail || t('导出 JSON 失败。'));
  } finally {
    isExporting.value = false;
  }
}

// ---------------- Toast ----------------
const toast = reactive({ visible: false, message: '', type: 'success' });
const toastIconMap = { success: '✓', error: '✕', info: 'ℹ' };
let toastTimer = null;

function showToast(message, type = 'success', duration = 1600) {
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

// ---------------- 图片加载状态 ----------------
async function handleImageError() {
  const url = currentImage.value;

  // 先带时间戳重试一次（排除浏览器缓存里的失败响应），仍然失败才展示错误
  if (!retryToken.value && url) {
    retryToken.value = Date.now();
    return;
  }

  imageStatus.loaded = true;
  imageStatus.error = true;

  if (!url) {
    imageErrorDetail.value = t('图片地址为空');
    return;
  }

  try {
    const resp = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    imageErrorDetail.value = resp.ok ? t('图片无法解码') : `HTTP ${resp.status}`;
  } catch {
    imageErrorDetail.value = t('网络错误，无法访问图片');
  }
}

function imageLoaded() {
  imageStatus.loaded = true;
  imageStatus.error = false;
  imageErrorDetail.value = '';
}

/** 记录条缩略图加载完成后淡入，避免一出现就是一张硬切的图 */
function markThumbLoaded(event) {
  event?.currentTarget?.classList.add('is-loaded');
}

/**
 * 主动校正图片加载状态：命中强缓存或元素被复用时浏览器可能不再派发 load，
 * 只依赖 @load 会让图片一直停在“加载中”的半透明状态。
 */
function syncImageStatus() {
  const el = viewerImgRef.value;
  if (!el) return;
  if (el.complete && el.naturalWidth > 0) {
    imageStatus.loaded = true;
    imageStatus.error = false;
  } else if (el.complete && el.naturalWidth === 0 && el.getAttribute('src')) {
    imageStatus.loaded = true;
    imageStatus.error = true;
  }
}

function resetImageStatus() {
  imageStatus.loaded = false;
  imageStatus.error = false;
  imageErrorDetail.value = '';
  retryToken.value = 0;
}

// 当前图片地址变化（切记录 / 切标签 / 分割完成）时重置加载状态。
// flush: 'pre' 保证先隐藏旧图再渲染新图，避免切换记录时闪一下上一张图。
watch(currentImage, async () => {
  resetImageStatus();
  await nextTick();
  syncImageStatus();
}, { flush: 'pre' });

// ---------------- 缩放 / 拖拽 ----------------
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

  // 点在倍率/重置按钮上时不触发拖拽
  if (event.target instanceof Element && event.target.closest('.zoom-pill')) return;

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

// ---------------- 生命周期 ----------------
onMounted(() => {
  // 历史记录一到就先选中第一条，不等模型列表请求完成，
  // 这样右侧大图可以更早开始加载；模型列表继续并行拉取。
  analysisStore.fetchHistoryIfStale()
    .then(() => {
      if (!analysisStore.selectedJob) {
        const first = history.value.find(job => job.status === 'completed') || history.value[0];
        if (first) analysisStore.selectJobAction(first);
      }
    })
    .catch(() => {});

  analysisStore.fetchModelsAction();
});

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
  clearPreviewPendingFile();
  blobUrls.forEach(url => URL.revokeObjectURL(url));
  blobUrls.clear();
  analysisStore.stopHistoryPolling('job');
  analysisStore.stopHistoryPolling('queue');
  if (toastTimer) clearTimeout(toastTimer);
});
</script>

<style scoped>
/* ========== 页面骨架：与剑叶页一致（左设置 / 右舞台） ========== */
.stem-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
  padding: 4px 2px 4px;
}

/* ========== 两栏 ========== */
.stem-layout {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: 16px;
  align-items: stretch;
  flex: 1 1 auto;
  min-height: 0;
}

.stem-setup {
  position: sticky;
  top: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  max-height: 100%;
  overflow-y: auto;
  padding-right: 2px;
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

/* 文件夹入口：比主上传框弱一级，避免抢视线 */
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
  gap: 3px;
  max-height: 176px;
  margin: 0;
  padding: 0 2px 0 0;
  overflow-y: auto;
  list-style: none;
}

.chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 1px 4px 1px 8px;
  border-radius: var(--radius-sm);
  background: var(--color-surface-muted);
  animation: fadeInUp 180ms ease backwards;
}

.chip:hover {
  background: var(--color-surface-hover);
}

.chip.active {
  box-shadow: inset 0 0 0 1px var(--color-primary-green-light);
  background: var(--color-primary-green-bg);
}

.chip-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  height: 22px;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  font-size: 11.5px;
  text-align: left;
}

.chip-main:hover:not(:disabled) {
  background: transparent;
}

.chip-name {
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

.upload-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.upload-progress-track {
  flex: 1;
  height: 4px;
  overflow: hidden;
  border-radius: var(--radius-full);
  background: var(--color-surface-hover);
}

.upload-progress-fill {
  height: 100%;
  border-radius: var(--radius-full);
  background: var(--color-accent);
  transition: width 160ms ease;
}

.upload-progress-percent {
  flex-shrink: 0;
  color: var(--color-text-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
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

.queue-empty {
  margin: 0;
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
.stem-stage {
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
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
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
  margin: 0;
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

/* 删除按钮采用「白底红字」的轻量危险样式（覆盖全局红底白字） */
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
  flex: 1 1 auto;
  min-height: 0;
  padding: 12px 16px 14px;
  overflow: hidden;
}

/* ---- 单图查看器：上方标签切换，下方一张大图 ---- */
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

.viewer-caption {
  color: var(--color-text-muted);
  font-size: 11.5px;
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

.viewer-open {
  flex-shrink: 0;
  font-size: 11px;
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
  transition: transform 160ms ease-out, opacity 160ms ease;
  will-change: transform;
}

.viewer-canvas img.loading {
  /* 加载中先完全隐藏，避免旧图/半解码图突然闪一下；加载完成后再淡入 */
  opacity: 0;
}

.viewer-canvas.dragging img {
  transition: none;
}

.viewer-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 0 16px;
  color: var(--color-text-light);
  font-size: 12px;
  text-align: center;
}

.viewer-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 16px;
  background: rgba(255, 255, 255, 0.82);
  color: var(--color-text-secondary);
  font-size: 12px;
  text-align: center;
}

.viewer-overlay.failed {
  color: var(--color-error);
}

.viewer-overlay.failed span {
  max-width: 84%;
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
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  animation: popIn 160ms ease backwards;
}

.zoom-pill button {
  height: 20px;
  padding: 0 8px;
  border-radius: var(--radius-full);
  font-size: 11px;
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
  line-height: 1.35;
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
  margin: 0;
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

/* 横向卡片条：不用 scroll-snap，滚轮缓动才能连续滑动而不被逐帧吸回 */
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
  content-visibility: auto;
  contain-intrinsic-size: 176px 132px;
  animation: fadeInUp 180ms ease backwards;
}

.record-card.selected {
  border-color: var(--color-primary-green);
}

.thumb {
  position: relative;
  height: 68px;
  overflow: hidden;
  background: var(--color-surface-muted);
}

.thumb img {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 180ms ease;
}

.thumb img.is-loaded {
  opacity: 1;
}

.thumb-empty {
  position: relative;
  z-index: 1;
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
  z-index: 2;
  display: flex;
  padding: 2px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.86);
}

/* 记录加载骨架：保持卡片尺寸，避免数据到达时整块跳变 */
.record-skeleton-strip {
  pointer-events: none;
}

.record-skeleton-card {
  flex: 0 0 176px;
  overflow: hidden;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.record-skeleton-thumb {
  display: block;
  height: 68px;
  background: var(--color-surface-hover);
  animation: pulse 1.3s ease-in-out infinite;
}

.record-skeleton-line {
  display: block;
  width: calc(100% - 20px);
  height: 9px;
  margin: 9px 10px 0;
  border-radius: var(--radius-full);
  background: var(--color-surface-hover);
  animation: pulse 1.3s ease-in-out infinite;
}

.record-skeleton-line.short {
  width: 55%;
  margin-bottom: 10px;
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

/* 批次角标：点了整批勾选，信息与旧版“文件夹分组”一致 */
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

/* Toast */
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

/* ========== 响应式 ========== */
@media (max-width: 1180px) {
  .stem-layout {
    grid-template-columns: 300px minmax(0, 1fr);
  }

  .stem-page {
    height: auto;
  }

  .stem-stage {
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
  .stem-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .stem-setup {
    position: static;
  }
}
</style>