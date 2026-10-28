<template>
  <main class="main-area">
    <div v-if="analysisStore.error" class="main-alert" role="alert">
      <span class="main-alert-text">{{ analysisStore.error }}</span>
      <button class="main-alert-close" type="button" :aria-label="t('关闭提示')" @click="analysisStore.setError(null)">×</button>
    </div>

        <section class="upload-sidebar">
          <h3 class="sidebar-title">{{ t('新建分析') }}</h3>
          <div class="upload-controls">
            <div class="model-select">
              <div class="model-select-label">{{ t('推理模型') }}</div>
              <div class="model-select-wrapper">
                <select id="model-choice" v-model="analysisStore.currentModelName" :disabled="analysisStore.isLoading || analysisStore.modelsLoading">
                  <option v-if="analysisStore.modelsLoading" value="">{{ t('加载中...') }}</option>
                  <option v-else-if="analysisStore.availableModels.length === 0" :value="null">{{ t('默认模型') }}</option>
                  <option
                    v-for="m in analysisStore.availableModels"
                    :key="m.name"
                    :value="m.name"
                  >{{ m.name }}</option>
                </select>
              </div>
            </div>

            <div class="picker-row">
              <label class="file-input-label">
                <input type="file" @change="handleFileSelect" accept="image/*" :disabled="analysisStore.isLoading" ref="fileInput" multiple />
                <span class="label-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m5 18 5-5 4 4 3-3 3 3" />
                  </svg>
                </span>
                <span>{{ t('选择图片') }}</span>
              </label>

              <label class="folder-input-label">
                <input type="file" @change="handleFolderSelect" :webkitdirectory="true" :mozdirectory="true" :directory="true" accept="image/*" :disabled="analysisStore.isLoading" ref="folderInput" />
                <span class="label-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H10l2 2h6.5A2.5 2.5 0 0 1 21 10.5v7A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5Z" />
                  </svg>
                </span>
                <span>{{ t('选择文件夹') }}</span>
              </label>
            </div>

            <button @click="handleUnifiedUpload" :disabled="totalPendingFiles === 0 || analysisStore.isLoading" class="primary upload-button">
              {{ analysisStore.isLoading ? t('处理中…') : (totalPendingFiles > 1 ? t('开始分析（{n} 张）', { n: totalPendingFiles }) : t('开始分析')) }}
            </button>
          </div>

          <div class="job-details">
            <div class="detail-row">
              <span class="detail-label">{{ t('文件') }}</span>
              <span v-if="analysisStore.selectedJob" class="detail-filename" :title="analysisStore.selectedJob.originalFilename">
                {{ stripTimestamp(analysisStore.selectedJob.originalFilename) }}
              </span>
              <span v-else class="detail-empty">{{ t('未选择') }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">{{ t('状态') }}</span>
              <span v-if="analysisStore.selectedJob" class="status-tag" :class="`status-${analysisStore.selectedJob.status}`">
                <span v-if="analysisStore.selectedJob.status === 'processing'" class="status-spinner"></span>
                {{ translateStatus(analysisStore.selectedJob.status) }}
              </span>
              <span v-else class="status-tag status-unselected">{{ t('未选择') }}</span>
            </div>
          </div>
        </section>

        <div class="image-group" v-if="analysisStore.selectedJob || previewPendingFile">
          <div class="image-section-wrapper">
            <section class="image-section card">
            <div class="image-container">
              <div class="image-head">
                <h4>{{ previewPendingFile ? t('待处理图片预览') : t('原始图片') }}</h4>
                <a
                  v-if="getOriginalImageUrl()"
                  class="image-open"
                  :href="getOriginalImageUrl()"
                  target="_blank"
                  rel="noopener"
                >{{ t('大图 ↗') }}</a>
              </div>
              <!-- 图片视口：overflow:hidden 把缩放/拖拽后的图片裁切在这一块里 -->
              <div
                  v-if="getOriginalImageUrl()"
                  class="image-viewport"
                  :style="{ cursor: imageState.original.isDragging ? 'grabbing' : (imageState.original.scale > 1 ? 'grab' : 'zoom-in') }"
                  @mouseenter="handleMouseEnter('original')"
                  @mouseleave="handleMouseLeave('original')"
                  @wheel="handleWheel('original', $event)"
                  @mousedown="handleMouseDown('original', $event)"
              >
                <img
                    :src="withRetry(getOriginalImageUrl(), retryToken.original)"
                    ref="originalImgRef"
                    :alt="t('原始图片')"
                    draggable="false"
                    @load="imageLoaded('original')"
                    @error="handleImageError('original')"
                    :style="{
                    transform: `scale(${imageState.original.scale}) translate(${imageState.original.position.x}px, ${imageState.original.position.y}px)`
                  }"
                    :class="{
                    loading: !imageStatus.original.loaded && !imageStatus.original.error,
                    dragging: imageState.original.isDragging
                  }"
                />
                <!-- 放大倍率 + 重置：绝对定位覆盖在图片之上，始终不会被放大的图片盖住 -->
                <div v-if="imageState.original.scale !== 1 || imageState.original.position.x !== 0 || imageState.original.position.y !== 0" class="scale-indicator">
                  <span>{{ t('缩放: {n}%', { n: (imageState.original.scale * 100).toFixed(0) }) }}</span>
                  <button @click="resetScale('original')" class="reset-button">{{ t('重置') }}</button>
                </div>
              </div>
              <p v-if="imageStatus.original.error" class="error-message image-error">
                {{ t('无法加载原始图片') }}<template v-if="imageErrorDetail.original">（{{ imageErrorDetail.original }}）</template>
              </p>
              <p v-else-if="!getOriginalImageUrl()" class="image-missing">
                {{ previewPendingFile
                  ? t('无图片')
                  : (analysisStore.selectedJob?.filesMissing
                      ? t('原始图片文件已丢失（可能已被清理），建议删除该记录后重新分析')
                      : t('无原始图片记录')) }}
              </p>
            </div>
          </section>
          </div>

          <template v-if="analysisStore.selectedJob && !previewPendingFile">
          <div class="image-section-wrapper">
          <section class="image-section card">
            <div class="image-container">
              <div class="image-head">
                <h4>{{ t('分割图片') }}</h4>
                <a
                  v-if="analysisStore.selectedJob.annotatedImageUrl"
                  class="image-open"
                  :href="analysisStore.selectedJob.annotatedImageUrl"
                  target="_blank"
                  rel="noopener"
                >{{ t('大图 ↗') }}</a>
              </div>
              <!-- 图片视口：overflow:hidden 把缩放/拖拽后的图片裁切在这一块里 -->
              <div
                  v-if="analysisStore.selectedJob.annotatedImageUrl && analysisStore.selectedJob.status === 'completed'"
                  class="image-viewport"
                  :style="{ cursor: imageState.annotated.isDragging ? 'grabbing' : (imageState.annotated.scale > 1 ? 'grab' : 'zoom-in') }"
                  @mouseenter="handleMouseEnter('annotated')"
                  @mouseleave="handleMouseLeave('annotated')"
                  @wheel="handleWheel('annotated', $event)"
                  @mousedown="handleMouseDown('annotated', $event)"
              >
                <img
                    :src="withRetry(analysisStore.selectedJob.annotatedImageUrl, retryToken.annotated)"
                    ref="annotatedImgRef"
                    :alt="t('标注图片')"
                    draggable="false"
                    @load="imageLoaded('annotated')"
                    @error="handleImageError('annotated')"
                    :style="{
                    transform: `scale(${imageState.annotated.scale}) translate(${imageState.annotated.position.x}px, ${imageState.annotated.position.y}px)`
                  }"
                    :class="{
                    loading: !imageStatus.annotated.loaded && !imageStatus.annotated.error,
                    dragging: imageState.annotated.isDragging
                  }"
                />
                <!-- 放大倍率 + 重置：绝对定位覆盖在图片之上，始终不会被放大的图片盖住 -->
                <div v-if="imageState.annotated.scale !== 1 || imageState.annotated.position.x !== 0 || imageState.annotated.position.y !== 0" class="scale-indicator">
                  <span>{{ t('缩放: {n}%', { n: (imageState.annotated.scale * 100).toFixed(0) }) }}</span>
                  <button @click="resetScale('annotated')" class="reset-button">{{ t('重置') }}</button>
                </div>
              </div>
              <p v-if="analysisStore.selectedJob.status === 'processing'" class="status-processing">{{ t('处理中...') }}</p>
              <div v-else-if="analysisStore.selectedJob.status === 'failed'" class="failed-detail">
                <p class="status-failed error-message">{{ t('❌ 分析失败') }}</p>
                <p v-if="analysisStore.selectedJob.errorMessage" class="failed-error-msg">{{ analysisStore.selectedJob.errorMessage }}</p>
                <p class="failed-meta" v-if="displayModelUsed(analysisStore.selectedJob.modelUsed)">{{ t('使用模型：{name}', { name: displayModelUsed(analysisStore.selectedJob.modelUsed) }) }}</p>
              </div>
              <p v-else-if="analysisStore.selectedJob.status === 'completed' && !analysisStore.selectedJob.annotatedImageUrl" class="image-missing">
                {{ analysisStore.selectedJob.filesMissing
                  ? t('标注图片文件已丢失（可能已被清理），建议删除该记录后重新分析')
                  : t('标注图片 URL 为空') }}
              </p>
              <p v-else-if="!(analysisStore.selectedJob.status!=='completed'||analysisStore.selectedJob.annotatedImageUrl)" class="status-completed">{{ t('分析完成') }}</p>
              <p v-else-if="imageStatus.annotated.error" class="error-message image-error">
                {{ t('无法加载标注图片') }}<template v-if="imageErrorDetail.annotated">（{{ imageErrorDetail.annotated }}）</template>
              </p>
              <p v-else-if="analysisStore.selectedJob.status !== 'completed' && !analysisStore.selectedJob.annotatedImageUrl">{{ t('暂无标注图片') }}</p>
            </div>
          </section>
          </div>
          </template>
        </div>

        <section class="image-group card placeholder" v-else>
          <p>{{ t('请从右侧列表中选择一个分割记录以查看详情') }}</p>
        </section>

        <div class="right-panel">
          <section class="upper-panel card">
            <h3>{{ t('待处理文件') }}</h3>
            <div v-if="selectedFiles.length > 0" class="pending-group">
              <div class="pending-group-title">{{ t('单张文件 ({n})', { n: selectedFiles.length }) }}</div>
              <ul class="pending-list stagger-in">
                <li
                  v-for="(file, index) in selectedFiles"
                  :key="'s-'+index"
                  class="pending-item clickable"
                  :class="{ 'is-previewing': isPreviewingFile('single', index) }"
                  @click="previewFromPendingList(file, 'single', index)"
                >
                  <span class="pending-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m5 18 5-5 4 4 3-3 3 3" />
                    </svg>
                  </span>
                  <span class="pending-name" :title="file.name">{{ file.name }}</span>
                  <span class="pending-size">({{ (file.size / 1024).toFixed(1) }} KB)</span>
                  <button @click.stop="removeSelectedFile(index)" class="pending-remove" :title="t('移除')">×</button>
                </li>
              </ul>
            </div>
            <div v-if="selectedFolderFiles.length > 0" class="pending-group">
              <div class="pending-group-title">{{ t('文件夹文件 ({n})', { n: selectedFolderFiles.length }) }}</div>
              <ul class="pending-list stagger-in">
                <li
                  v-for="(file, index) in selectedFolderFiles"
                  :key="'f-'+index"
                  class="pending-item clickable"
                  :class="{ 'is-previewing': isPreviewingFile('folder', index) }"
                  @click="previewFromPendingList(file, 'folder', index)"
                >
                  <span class="pending-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m5 18 5-5 4 4 3-3 3 3" />
                    </svg>
                  </span>
                  <span class="pending-name" :title="file.name">{{ file.name }}</span>
                  <span class="pending-size">({{ (file.size / 1024).toFixed(1) }} KB)</span>
                  <button @click.stop="removeFolderFile(index)" class="pending-remove" :title="t('移除')">×</button>
                </li>
              </ul>
            </div>
            <p v-if="selectedFiles.length === 0 && selectedFolderFiles.length === 0" class="no-pending">{{ t('暂无待处理文件') }}</p>

            <transition name="slide-up">
              <div v-if="uploadProgress.visible" class="upload-progress-panel">
                <div class="upload-progress-header">
                  <span class="upload-progress-label">
                    <span class="upload-progress-spinner" :class="{ done: uploadProgress.phase === 'done' }"></span>
                    {{ uploadProgress.currentFile }}
                  </span>
                  <span class="upload-progress-percent">{{ uploadProgress.percent }}%</span>
                </div>
                <div class="upload-progress-track">
                  <div
                    class="upload-progress-fill"
                    :class="{ done: uploadProgress.phase === 'done' }"
                    :style="{ width: uploadProgress.percent + '%' }"
                  ></div>
                </div>
              </div>
            </transition>
          </section>

          <aside class="job-list-section card" ref="jobListSectionRef">
            <div class="section-header">
              <div class="section-title-row">
                <h3>{{ t('分割记录') }}</h3>
                <label class="select-all-checkbox" :class="{ 'has-selection': selectedAnalysisIds.length > 0 }">
                  <input
                      type="checkbox"
                      :checked="isAllSelected"
                      :indeterminate="isIndeterminate"
                      @change="toggleSelectAll"
                  />
                  <span class="checkbox-box">
                    <span class="checkbox-check"></span>
                  </span>
                  {{ t('全选') }}
                </label>
              </div>
              <div class="section-actions">
                <button
                    @click="batchExportJson"
                    :disabled="isExporting || selectedCompletedCount === 0"
                    class="download-summary-button json-batch">
                  {{ isExporting
                    ? t('导出中...')
                    : (selectedAnalysisIds.length > 0
                      ? t('导出 JSON（{done}/{total}）', { done: selectedCompletedCount, total: selectedAnalysisIds.length })
                      : t('导出 JSON')) }}
                </button>
                <button
                    @click="openDownloadDialog"
                    :disabled="analysisStore.isLoading || excelStore.isLoading || selectedCompletedCount === 0"
                    class="download-summary-button excel-batch">
                  {{ excelStore.isLoading
                    ? t('导出中...')
                    : (analysisStore.isLoading
                      ? t('处理中...')
                      : (selectedAnalysisIds.length > 0
                        ? t('导出 Excel（{done}/{total}）', { done: selectedCompletedCount, total: selectedAnalysisIds.length })
                        : t('导出 Excel'))) }}
                </button>
                <button
                    @click="handleBatchDelete"
                    :disabled="analysisStore.isLoading || selectedAnalysisIds.length === 0"
                    class="download-summary-button delete-batch">
                  {{ analysisStore.isLoading
                    ? t('处理中...')
                    : (selectedAnalysisIds.length > 0
                      ? t('删除（{n}）', { n: selectedAnalysisIds.length })
                      : t('删除')) }}
                </button>
              </div>
            </div>

            <div v-if="excelStore.isLoading" class="export-progress-bar">
              <div class="export-progress-info">
                <span>{{ excelStore.taskMessage || t('正在生成 Excel...') }}</span>
                <span v-if="excelStore.taskTotal > 0">{{ excelStore.taskProgress }}/{{ excelStore.taskTotal }}</span>
              </div>
              <div class="export-progress-track">
                <div
                  class="export-progress-fill"
                  :style="{ width: exportProgressPercent + '%' }"
                ></div>
              </div>
            </div>
            <div v-if="excelStore.error" class="error-message">{{ excelStore.error }}</div>
            <ul v-if="groupedHistory.length > 0" class="job-list stagger-in" ref="jobListRef">
            <template v-for="group in groupedHistory" :key="group.batchId">
              <!-- 批次组标题 -->
              <li
                  class="batch-item"
                  :class="{
                    'expanded': isBatchExpanded(group.batchId),
                    'selected': analysisStore.selectedJob?.batchId === group.batchId || (!group.hasFolder && analysisStore.selectedJob?.analysisId === group.jobs[0]?.analysisId)
                  }"
              >
                <div class="batch-header" @click="handleBatchClick(group)">
                  <label
                      v-if="group.hasFolder"
                      class="folder-select-all"
                      @click.stop
                  >
                    <input
                        type="checkbox"
                        :checked="isFolderAllSelected(group)"
                        :indeterminate="isFolderIndeterminate(group)"
                        @change="toggleFolderSelectAll(group)"
                    />
                  </label>
                  <input
                      v-if="!group.hasFolder"
                      type="checkbox"
                      :value="group.jobs[0].analysisId"
                      v-model="selectedAnalysisIds"
                      @click.stop
                      class="job-checkbox"
                  />
                  <span class="batch-icon" aria-hidden="true">
                    <svg v-if="group.hasFolder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H10l2 2h6.5A2.5 2.5 0 0 1 21 10.5v7A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5Z" />
                    </svg>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m5 18 5-5 4 4 3-3 3 3" />
                    </svg>
                  </span>
                  <span class="batch-label">
                    <template v-if="group.hasFolder">
                      {{ getGroupBatchName(group) || t('未命名批次 ({n} 个文件)', { n: group.jobs.length }) }}
                    </template>
                    <template v-else>
                      {{ group.jobs[0]?.originalFilename }}
                    </template>
                  </span>
                  <span v-if="!group.hasFolder && displayModelUsed(group.jobs[0]?.modelUsed)" class="batch-model-tag" :title="t('使用模型: {name}', { name: displayModelUsed(group.jobs[0].modelUsed) })">
                    {{ displayModelUsed(group.jobs[0].modelUsed) }}
                  </span>
                  <span class="batch-timestamp">{{ formatDate(group.createdAt) }}</span>
                  <button
                      v-if="group.hasFolder"
                      @click.stop="toggleBatch(group.batchId)"
                      class="expand-button"
                      :title="t('展开/收起')"
                  >
                    <span class="expand-icon">{{ isBatchExpanded(group.batchId) ? '▼' : '▶' }}</span>
                  </button>
                  <span
                    v-if="!group.hasFolder"
                    class="status-indicator"
                    :class="`status-${group.jobs[0]?.status}`"
                    :title="group.jobs[0]?.status === 'failed' && group.jobs[0]?.errorMessage ? t('分析失败：{msg}', { msg: group.jobs[0].errorMessage }) : translateStatus(group.jobs[0]?.status)"
                  ></span>
                  <button
                      v-if="!group.hasFolder"
                      @click.stop="deleteJob(group.jobs[0].analysisId, group.jobs[0].originalFilename)"
                      :disabled="analysisStore.isLoading"
                      class="delete-button"
                      :title="t('删除记录')"
                  >
                    ×
                  </button>
                </div>

                <!-- 展开的文件列表-->
                <ul v-if="group.hasFolder && isBatchExpanded(group.batchId)" class="batch-content">
                  <li
                      v-for="job in group.jobs"
                      :key="job.analysisId"
                      class="job-item nested"
                      :class="{ 'selected': analysisStore.selectedJob?.analysisId === job.analysisId }"
                      @click.stop="selectJob(job)"
                  >
                    <input
                        type="checkbox"
                        :value="job.analysisId"
                        v-model="selectedAnalysisIds"
                        @click.stop
                        class="job-checkbox"
                    />
                    <div class="job-info">
                      <span class="filename">{{ job.originalFilename }}</span>
                      <span v-if="displayModelUsed(job.modelUsed)" class="job-model-tag" :title="t('使用模型: {name}', { name: displayModelUsed(job.modelUsed) })">{{ displayModelUsed(job.modelUsed) }}</span>
                      <span
                        class="status-indicator"
                        :class="`status-${job.status}`"
                        :title="job.status === 'failed' && job.errorMessage ? t('分析失败：{msg}', { msg: job.errorMessage }) : translateStatus(job.status)"
                      ></span>
                    </div>
                    <button
                        @click.stop="deleteJob(job.analysisId, job.originalFilename)"
                        :disabled="analysisStore.isLoading"
                        class="delete-button"
                        :title="t('删除记录')"
                    >
                      ×
                    </button>
                  </li>
                </ul>
              </li>
            </template>
          </ul>
          <p v-else-if="analysisStore.isLoading">{{ t('正在加载历史记录...') }}</p>
          <p v-else class="no-jobs-message">{{ t('暂无分析记录。') }}</p>
          </aside>
        </div>

  </main>

  <!-- Excel下载数据项选择弹窗 -->
  <ExcelDownload
      :visible="showDownloadDialog"
      :download-type="currentDownloadType"
      :job="singleSelectedJob"
      :selected-count="selectedAnalysisIds.length"
      @close="closeDownloadDialog"
      @download="handleExcelDownload"
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
</template>


<script setup>
import { useI18n } from '@/i18n';

const { t } = useI18n();
import {ref, reactive, watch, computed, nextTick, onMounted, onUnmounted} from 'vue';
import { useAnalysisStore } from '@/stores/analysis';
import { useExcelStore } from '@/stores/excel';
import { exportService } from '@/services/exportService';
import ExcelDownload from '@/components/ExcelDownload.vue';
import { beginCriticalOperation, endCriticalOperation } from '@/services/apiClient';

const analysisStore = useAnalysisStore();
const excelStore = useExcelStore();

const showDownloadDialog = ref(false);
const currentDownloadType = ref('summary'); // 'summary' 或 'single'

// JSON导出相关状态
const selectedAnalysisIds = ref([]);
const isExporting = ref(false);

const jobListSectionRef = ref(null);

let prevSectionHeight = 0;
let transitioning = false;

watch(() => selectedAnalysisIds.value.length, () => {
  const section = jobListSectionRef.value;
  if (!section || transitioning) return;
  prevSectionHeight = section.scrollHeight;
}, { flush: 'pre' });

watch(() => selectedAnalysisIds.value.length, () => {
  nextTick(() => {
    const section = jobListSectionRef.value;
    if (!section || transitioning) return;
    const newSectionHeight = section.scrollHeight;
    const delta = newSectionHeight - prevSectionHeight;
    if (Math.abs(delta) < 1) return;

    transitioning = true;
    section.style.height = prevSectionHeight + 'px';
    section.style.overflow = 'hidden';
    section.offsetHeight;
    section.style.transition = 'height 400ms cubic-bezier(0.4, 0, 0.2, 1)';
    requestAnimationFrame(() => {
      section.style.height = newSectionHeight + 'px';
    });
    setTimeout(() => {
      section.style.transition = '';
      section.style.height = '';
      section.style.overflow = '';
      transitioning = false;
    }, 450);
  });
});

// 记录已刷新过的任务ID，避免重复刷新
const refreshedJobs = ref(new Set());

// 当前展开的批次ID
const expandedBatchIds = ref(new Set());

// 生成本地存储的批次名称（优先用后端返回的，其次用 localStorage）
const getGroupBatchName = (group) => {
  const firstJob = group.jobs[0];
  const backendName = firstJob?.batchName || firstJob?.batch_name;
  if (backendName) return backendName;

  if (group.batchId && !group.batchId.startsWith('single_')) {
    const storedName = analysisStore.getBatchName(group.batchId);
    if (storedName) return storedName;
  }

  return null;
};

// 按批次ID分组的历史记录
const groupedHistory = computed(() => {
  const groups = {};
  analysisStore.historyList.forEach(job => {
    const batchId = job.batchId || 'single_' + job.analysisId;
    if (!groups[batchId]) {
      groups[batchId] = {
        batchId: batchId,
        jobs: [],
        createdAt: job.createdAt,
        hasFolder: false
      };
    }
    groups[batchId].jobs.push(job);
  });

  Object.values(groups).forEach(g => {
    g.hasFolder = g.jobs.length > 1;
  });

  return Object.values(groups).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
});

const allAnalysisIds = computed(() => {
  return analysisStore.historyList.map(job => job.analysisId);
});

const singleSelectedJob = computed(() => {
  const ids = getCompletedSelectedIds();
  if (ids.length === 1) {
    return analysisStore.historyList.find(job => job.analysisId === ids[0]) || analysisStore.selectedJob;
  }
  return analysisStore.selectedJob;
});

const completedAnalysisIds = computed(() => {
  return analysisStore.historyList
    .filter(job => job.status === 'completed')
    .map(job => job.analysisId);
});

const selectedCompletedCount = computed(() => {
  const completedSet = new Set(completedAnalysisIds.value);
  return selectedAnalysisIds.value.filter(id => completedSet.has(id)).length;
});

const exportProgressPercent = computed(() => {
  const total = excelStore.taskTotal;
  const progress = excelStore.taskProgress;
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.round((progress / total) * 100));
});

const isAllSelected = computed(() => {
  return allAnalysisIds.value.length > 0 &&
    allAnalysisIds.value.every(id => selectedAnalysisIds.value.includes(id));
});

const isIndeterminate = computed(() => {
  const total = allAnalysisIds.value.length;
  if (total === 0) return false;
  const selected = selectedAnalysisIds.value.filter(id => allAnalysisIds.value.includes(id)).length;
  return selected > 0 && selected < total;
});

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedAnalysisIds.value = [];
  } else {
    selectedAnalysisIds.value = [...allAnalysisIds.value];
  }
};

const folderAllIds = (group) => {
  return group.jobs.map(job => job.analysisId);
};

const isFolderAllSelected = (group) => {
  const ids = folderAllIds(group);
  return ids.length > 0 && ids.every(id => selectedAnalysisIds.value.includes(id));
};

const isFolderIndeterminate = (group) => {
  const ids = folderAllIds(group);
  if (ids.length === 0) return false;
  const selected = ids.filter(id => selectedAnalysisIds.value.includes(id)).length;
  return selected > 0 && selected < ids.length;
};

const toggleFolderSelectAll = (group) => {
  const ids = folderAllIds(group);
  if (isFolderAllSelected(group)) {
    selectedAnalysisIds.value = selectedAnalysisIds.value.filter(id => !ids.includes(id));
  } else {
    const set = new Set([...selectedAnalysisIds.value, ...ids]);
    selectedAnalysisIds.value = [...set];
  }
};

// 切换批次展开状态
const toggleBatch = (batchId) => {
  if (expandedBatchIds.value.has(batchId)) {
    expandedBatchIds.value.delete(batchId);
  } else {
    expandedBatchIds.value.add(batchId);
  }
};

// 判断批次是否展开
const isBatchExpanded = (batchId) => {
  return expandedBatchIds.value.has(batchId);
};

// 处理批次点击
const handleBatchClick = (group) => {
  if (group.hasFolder) {
    // 如果是文件夹，切换展开状态
    toggleBatch(group.batchId);
  } else {
    // 如果是单文件，直接选中任务
    selectJob(group.jobs[0]);
  }
};

// 打开下载弹窗（根据选中数量自动决定类型）
const openDownloadDialog = () => {
  const ids = getCompletedSelectedIds();
  if (ids.length === 0) {
    analysisStore.setError(t('请先勾选至少一个已完成的任务'));
    return;
  }
  currentDownloadType.value = ids.length === 1 ? 'single' : 'batch';
  showDownloadDialog.value = true;
};

// 关闭弹窗
const closeDownloadDialog = () => {
  showDownloadDialog.value = false;
  currentDownloadType.value = 'single';
};

// 处理Excel下载
const handleExcelDownload = async (downloadData) => {
  let success = false;
  if (downloadData.type === 'single') {
    const id = selectedAnalysisIds.value[0] || analysisStore.selectedJob?.analysisId;
    if (!id) return;
    const job = analysisStore.historyList.find(j => j.analysisId === id) || analysisStore.selectedJob;
    const originalFilename = job?.originalFilename || '';
    success = await excelStore.downloadSingleExcelAction(id, originalFilename, downloadData.columns, downloadData.unit);
  } else if (downloadData.type === 'batch') {
    success = await excelStore.downloadBatchExcelAction(selectedAnalysisIds.value, downloadData.columns, downloadData.unit);
  } else if (downloadData.type === 'summary') {
    success = await excelStore.downloadExcelSummaryAction(downloadData.columns, downloadData.unit);
  }
  if (success) {
    console.log('Excel download initiated:', downloadData.type, selectedAnalysisIds.value.length, 'items');
  }
};

const getCompletedSelectedIds = () => {
  const completedSet = new Set(completedAnalysisIds.value);
  return selectedAnalysisIds.value.filter(id => completedSet.has(id));
};

const batchExportJson = async () => {
  const ids = getCompletedSelectedIds();
  if (ids.length === 0) {
    showToast(t('请先勾选已完成的记录'), 'error');
    return;
  }
  isExporting.value = true;
  try {
    if (ids.length === 1) {
      const job = analysisStore.historyList.find(j => j.analysisId === ids[0]) || analysisStore.selectedJob;
      const originalFilename = job?.originalFilename || '';
      await exportService.exportSingleJson(ids[0], originalFilename);
      console.log('Single JSON export successful');
    } else {
      await exportService.batchExportJson(ids);
      console.log('Batch JSON export successful');
    }
    selectedAnalysisIds.value = selectedAnalysisIds.value.filter(id => !ids.includes(id));
  } catch (err) {
    console.error('JSON export failed:', err);
  } finally {
    isExporting.value = false;
  }
};

const handleBatchDelete = async () => {
  if (selectedAnalysisIds.value.length === 0) return;
  const count = selectedAnalysisIds.value.length;
  const confirmed = confirm(t('确定要删除选中的 {n} 条记录吗？此操作不可恢复，同时会清理关联的原图、标注图和 JSON 文件。', { n: count }));
  if (!confirmed) return;
  const result = await analysisStore.batchDeleteAction([...selectedAnalysisIds.value]);
  if (result) {
    const skipped = result.skipped_ids || [];
    selectedAnalysisIds.value = [];
    if (skipped.length > 0) {
      showToast(t('成功删除 {n} 条记录', { n: result.deleted_count }), 'success');
    } else {
      showToast(t('成功删除 {n} 条记录', { n: result.deleted_count }), 'success');
    }
  }
};

const toast = reactive({
  visible: false,
  message: '',
  type: 'success'
});
const toastIconMap = {
  success: '✓',
  error: '✕',
  info: 'ℹ'
};
let toastTimer = null;

const showToast = (message, type = 'success', duration = 1000) => {
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
  toast.message = message;
  toast.type = type;
  toast.visible = true;
  toastTimer = setTimeout(() => {
    toast.visible = false;
    toastTimer = null;
  }, duration);
};

const hideToast = () => {
  toast.visible = false;
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
};

const uploadSuccessMessage = ref('');
const fileInput = ref(null);
const originalImgRef = ref(null);
const annotatedImgRef = ref(null);
const imageStatus = reactive({
  original: { loaded: false, error: false },
  annotated: { loaded: false, error: false },
});
// 图片加载失败时附加的可读原因（HTTP 状态 / 网络错误），显示在错误提示里
const imageErrorDetail = reactive({ original: '', annotated: '' });
// 失败重试的时间戳参数：0 表示还没重试过，非 0 时拼到 URL 上绕过浏览器缓存
const retryToken = reactive({ original: 0, annotated: 0 });

const withRetry = (url, token) => {
  if (!url || !token) return url;
  return `${url}${url.includes('?') ? '&' : '?'}__retry=${token}`;
};

// 图片缩放和拖拽状态
const imageState = reactive({
  original: {
    scale: 1,
    isHovering: false,
    isDragging: false,
    position: { x: 0, y: 0 },
    dragStart: { x: 0, y: 0 }
  },
  annotated: {
    scale: 1,
    isHovering: false,
    isDragging: false,
    position: { x: 0, y: 0 },
    dragStart: { x: 0, y: 0 }
  },
});

const emptyImageState = () => ({
  scale: 1,
  isHovering: false,
  isDragging: false,
  position: { x: 0, y: 0 },
  dragStart: { x: 0, y: 0 }
});

// 仅在切换到另一条记录时重置缩放/拖拽状态。
// 之前监听整个 selectedJob 对象，每次轮询刷新历史都会生成新对象，
// 导致处理中每 2 秒就把用户的缩放/拖拽重置一次。
watch(() => analysisStore.selectedJob?.analysisId, () => {
  imageState.original = emptyImageState();
  imageState.annotated = emptyImageState();
});

// 任务状态驱动轮询：统一使用 store 里的单条轮询链路，不再另开 setInterval
watch(
  () => analysisStore.selectedJob?.status,
  (status, oldStatus) => {
    if (status === 'processing') {
      analysisStore.startHistoryPolling('job');
    } else {
      analysisStore.stopHistoryPolling('job');
    }

    if (oldStatus === 'processing') {
      uploadSuccessMessage.value = status === 'completed' ? t('文件处理完成！') : '';
    }
  },
  { immediate: true }
);

// 组件挂载时获取历史和模型列表
onMounted(() => {
  analysisStore.fetchHistoryAction();
  analysisStore.fetchModelsAction();
});

// 处理文件选择（支持单文件和多文件选择）
const selectedFiles = ref([]);
const selectedFolderFiles = ref([]);
const folderInput = ref(null);

const totalPendingFiles = computed(() => {
  return selectedFiles.value.length + selectedFolderFiles.value.length;
});

// 上传进度条
const uploadProgress = ref({
  visible: false,
  percent: 0,
  currentFile: '',
  completed: 0,
  total: 0,
  phase: 'uploading'
});

// 待处理文件预览
const previewPendingFile = ref(null);
const blobUrls = new Set();

const getOriginalImageUrl = () => {
  if (previewPendingFile.value) {
    return previewPendingFile.value.blobUrl;
  }
  return analysisStore.selectedJob?.originalImageUrl;
};

const isPreviewingFile = (listType, index) => {
  if (!previewPendingFile.value) return false;
  return previewPendingFile.value.listType === listType && previewPendingFile.value.index === index;
};

const previewFromPendingList = (file, listType, index) => {
  resetScale('original');
  imageStatus.original = { loaded: false, error: false };

  const blobUrl = URL.createObjectURL(file);
  blobUrls.add(blobUrl);

  previewPendingFile.value = {
    file,
    blobUrl,
    listType,
    index,
    name: file.name
  };
};

const clearPreviewPendingFile = () => {
  if (previewPendingFile.value) {
    const url = previewPendingFile.value.blobUrl;
    if (blobUrls.has(url)) {
      URL.revokeObjectURL(url);
      blobUrls.delete(url);
    }
    previewPendingFile.value = null;
  }
};

const handleFileSelect = (event) => {
  const files = Array.from(event.target.files).filter(file => file.type.startsWith('image/'));
  if (files.length > 0) {
    selectedFiles.value = files;
    uploadSuccessMessage.value = '';
    analysisStore.setError(null);
    clearPreviewPendingFile();
  } else {
    selectedFiles.value = [];
    clearPreviewPendingFile();
  }
};

const removeSelectedFile = (index) => {
  if (previewPendingFile.value && previewPendingFile.value.listType === 'single' && previewPendingFile.value.index === index) {
    clearPreviewPendingFile();
  } else if (previewPendingFile.value && previewPendingFile.value.listType === 'single' && previewPendingFile.value.index > index) {
    previewPendingFile.value.index--;
  }
  selectedFiles.value.splice(index, 1);
};

const removeFolderFile = (index) => {
  if (previewPendingFile.value && previewPendingFile.value.listType === 'folder' && previewPendingFile.value.index === index) {
    clearPreviewPendingFile();
  } else if (previewPendingFile.value && previewPendingFile.value.listType === 'folder' && previewPendingFile.value.index > index) {
    previewPendingFile.value.index--;
  }
  selectedFolderFiles.value.splice(index, 1);
};

// 处理文件夹选择
const handleFolderSelect = (event) => {
  const files = Array.from(event.target.files).filter(file => file.type.startsWith('image/'));
  if (files.length > 0) {
    selectedFolderFiles.value = files;
    uploadSuccessMessage.value = '';
    analysisStore.setError(null);
    clearPreviewPendingFile();
  } else {
    selectedFolderFiles.value = [];
    clearPreviewPendingFile();
  }
};

// 统一上传分析 —— 根据文件数量自动适配后端单张/批量接口
const handleUnifiedUpload = async () => {
  if (totalPendingFiles.value === 0) {
    analysisStore.setError(t('请先选择图片文件或文件夹！'));
    return;
  }

  const allFiles = [...selectedFiles.value, ...selectedFolderFiles.value];
  const totalFiles = allFiles.length;
  const isBatch = totalFiles > 1;

  uploadSuccessMessage.value = '';

  uploadProgress.value = {
    visible: true,
    percent: 0,
    currentFile: isBatch ? t('批量上传中 ({done}/{total})', { done: 0, total: totalFiles }) : t('上传中: {name}', { name: allFiles[0].name }),
    completed: 0,
    total: totalFiles,
    phase: 'uploading'
  };

  console.log(`[UnifiedUpload] ${isBatch ? t('批量') : t('单张')}模式，共 ${totalFiles} 个文件，使用模型: ${analysisStore.currentModelName}`);

  let response = null;
  beginCriticalOperation();
  try {
    response = await analysisStore.uploadAnalysisAction(
      allFiles,
      analysisStore.currentModelName,
      (percent) => {
        uploadProgress.value.percent = percent;
        if (isBatch) {
          const estimatedCompleted = Math.round((percent / 100) * totalFiles);
          uploadProgress.value.currentFile = t('批量上传中 ({done}/{total})', { done: estimatedCompleted, total: totalFiles });
        }
      }
    );
  } finally {
    endCriticalOperation();
  }

  if (response) {
    uploadProgress.value.percent = 100;
    uploadProgress.value.phase = 'done';
    uploadProgress.value.currentFile = t('上传完成，后端处理中...');
    uploadProgress.value.completed = totalFiles;
    setTimeout(() => { uploadProgress.value.visible = false; }, 2500);

    const responseBatchId = response.batchId || response.batch_id;

    let jobToSelect = null;
    if (isBatch) {
      uploadSuccessMessage.value = t('已成功提交 {n} 个文件进行批量处理...', { n: totalFiles });
      analysisStore.startBatchProgressPolling('stem', totalFiles, responseBatchId);

      if (responseBatchId) {
        jobToSelect = analysisStore.historyList.find(j => j.batchId === responseBatchId) || null;
      }
    } else {
      const filename = response.originalFilename || response.original_filename || allFiles[0].name;
      uploadSuccessMessage.value = t('文件 "{name}" 已成功提交后台处理...', { name: filename });
      analysisStore.startBatchProgressPolling('stem', 1, responseBatchId);

      const newAnalysisId = response.analysisId || response.analysis_id;
      if (newAnalysisId) {
        jobToSelect = analysisStore.historyList.find(j => j.analysisId === newAnalysisId) || null;
      }
    }

    if (!jobToSelect) {
      const responseCreatedAt = response.createdAt || response.created_at;
      if (responseCreatedAt) {
        jobToSelect = analysisStore.historyList.find(j => j.createdAt === responseCreatedAt) || null;
      }
    }

    if (!jobToSelect && analysisStore.historyList.length > 0) {
      jobToSelect = analysisStore.historyList[0];
    }

    if (jobToSelect) {
      analysisStore.selectJobAction(jobToSelect);
    }
  } else {
    uploadProgress.value.visible = false;
  }

  selectedFiles.value = [];
  selectedFolderFiles.value = [];
  clearPreviewPendingFile();
  if (fileInput.value) fileInput.value.value = '';
  if (folderInput.value) folderInput.value.value = '';

  refreshedJobs.value.clear();
};

// 处理选中历史记录
const selectJob = (job) => {
  clearPreviewPendingFile();
  uploadSuccessMessage.value = '';
  analysisStore.selectJobAction(job);
};

// 删除分割记录
const deleteJob = async (analysisId, filename) => {
  if (!confirm(t('确定要删除记录 "{name}" 吗？此操作不可撤销。', { name: filename }))) {
    return;
  }

  const success = await analysisStore.deleteJobAction(analysisId);
  if (success) {
    showToast(t('删除成功'), 'success');
  }
};

// 处理图片加载错误：先带时间戳重试一次（排除浏览器缓存里的失败响应），
// 仍然失败才展示错误，并附带一个可读的原因（HTTP 状态码 / 网络错误）。
const handleImageError = async (type) => {
  const url = type === 'original'
    ? getOriginalImageUrl()
    : analysisStore.selectedJob?.annotatedImageUrl;

  if (!retryToken[type] && url) {
    retryToken[type] = Date.now();
    return;
  }

  imageStatus[type] = { loaded: true, error: true };

  if (!url) {
    imageErrorDetail[type] = t('图片地址为空');
    return;
  }

  try {
    const resp = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    imageErrorDetail[type] = resp.ok ? t('图片无法解码') : `HTTP ${resp.status}`;
  } catch {
    imageErrorDetail[type] = t('网络错误，无法访问图片');
  }
};

// 处理图片加载成功
const imageLoaded = (type) => {
  imageStatus[type] = { loaded: true, error: false };
  imageErrorDetail[type] = '';
};

/**
 * 主动校正图片加载状态。
 *
 * 为什么需要它：当图片命中浏览器缓存（我们给 /static 加了强缓存）或元素被复用，
 * 浏览器可能不会再派发 load 事件，只依赖 @load 会让状态一直停在"未加载"，
 * 图片就一直是 loading 样式（变淡/骨架），看起来像"没加载出来"。
 */
const syncImageStatus = (type) => {
  const el = type === 'original' ? originalImgRef.value : annotatedImgRef.value;
  if (!el) return;
  if (el.complete && el.naturalWidth > 0) {
    imageStatus[type] = { loaded: true, error: false };
  } else if (el.complete && el.naturalWidth === 0 && el.getAttribute('src')) {
    imageStatus[type] = { loaded: true, error: true };
  }
};

const watchImageSource = (type, getter) => {
  watch(getter, async () => {
    imageStatus[type] = { loaded: false, error: false };
    imageErrorDetail[type] = '';
    retryToken[type] = 0;
    await nextTick();
    syncImageStatus(type);
  }, { flush: 'post' });
};

watchImageSource('original', () => getOriginalImageUrl());
watchImageSource('annotated', () => analysisStore.selectedJob?.annotatedImageUrl);

// 处理鼠标进入图片
const handleMouseEnter = (type) => {
  imageState[type].isHovering = true;
};

// 处理鼠标离开图片
const handleMouseLeave = (type) => {
  imageState[type].isHovering = false;
};

// 处理鼠标滚轮缩放
const handleWheel = (type, event) => {
  if (!imageState[type].isHovering) return;

  event.preventDefault();

  const delta = event.deltaY > 0 ? -0.1 : 0.1;
  const newScale = Math.max(0.5, Math.min(5, imageState[type].scale + delta));

  imageState[type].scale = parseFloat(newScale.toFixed(2));

  // 缩小后原本的平移量可能已经超出边界，这里重新夹紧一次
  clampImagePosition(type);
};

// 重置图片缩放
const resetScale = (type) => {
  imageState[type].scale = 1;
  imageState[type].position = { x: 0, y: 0 };
};

/**
 * 把平移量夹紧在「图片仍然铺满可视区域」的范围内。
 *
 * transform 是 scale(s) translate(x, y)：translate 先作用再被 scale 放大，
 * 所以视觉位移是 s * x。按 object-fit: contain 后图片实际占据的尺寸算出
 * 每个方向最多能移动多少，避免把图片拖出视口后露出大片空白。
 */
const clampImagePosition = (type) => {
  const el = type === 'original' ? originalImgRef.value : annotatedImgRef.value;
  const state = imageState[type];
  if (!el || !el.clientWidth || !el.clientHeight) return;

  const naturalWidth = el.naturalWidth || el.clientWidth;
  const naturalHeight = el.naturalHeight || el.clientHeight;

  // object-fit: contain 之后，图片内容在元素内的实际显示尺寸
  const fitRatio = Math.min(el.clientWidth / naturalWidth, el.clientHeight / naturalHeight);
  const contentWidth = naturalWidth * fitRatio;
  const contentHeight = naturalHeight * fitRatio;

  const maxX = Math.max(0, (contentWidth * state.scale - el.clientWidth) / (2 * state.scale));
  const maxY = Math.max(0, (contentHeight * state.scale - el.clientHeight) / (2 * state.scale));

  state.position.x = Math.max(-maxX, Math.min(maxX, state.position.x));
  state.position.y = Math.max(-maxY, Math.min(maxY, state.position.y));
};

// 处理鼠标按下开始拖拽
const handleMouseDown = (type, event) => {
  if (event.button !== 0) return; // 只响应左键

  // 点在放大倍率/重置按钮上时不触发拖拽
  if (event.target instanceof Element && event.target.closest('.scale-indicator')) return;

  imageState[type].isDragging = true;
  imageState[type].dragStart = {
    x: event.clientX - imageState[type].position.x,
    y: event.clientY - imageState[type].position.y
  };

  // 只在真正拖拽期间挂载全局监听：之前是常驻监听，页面上任何一次
  // 鼠标移动都会触发两个全局回调，纯属浪费。
  attachDragListeners();

  // 阻止默认行为，避免文本选择
  event.preventDefault();
};

// 处理鼠标移动拖拽
const handleMouseMove = (type, event) => {
  if (!imageState[type].isDragging) return;

  const deltaX = event.clientX - imageState[type].dragStart.x;
  const deltaY = event.clientY - imageState[type].dragStart.y;

  imageState[type].position.x = deltaX;
  imageState[type].position.y = deltaY;

  // 限制在图片区块内，防止把图片拖出视口露出空白
  clampImagePosition(type);
};

// 处理鼠标释放结束拖拽
const handleMouseUp = (type) => {
  imageState[type].isDragging = false;
};

// 全局鼠标事件处理
const handleGlobalMouseMove = (event) => {
  if (imageState.original.isDragging) {
    handleMouseMove('original', event);
  }
  if (imageState.annotated.isDragging) {
    handleMouseMove('annotated', event);
  }
};

const handleGlobalMouseUp = () => {
  if (imageState.original.isDragging) {
    handleMouseUp('original');
  }
  if (imageState.annotated.isDragging) {
    handleMouseUp('annotated');
  }
  // 拖拽结束立即摘掉全局监听
  detachDragListeners();
};

const attachDragListeners = () => {
  window.addEventListener('mousemove', handleGlobalMouseMove, { passive: true });
  window.addEventListener('mouseup', handleGlobalMouseUp);
};

const detachDragListeners = () => {
  window.removeEventListener('mousemove', handleGlobalMouseMove);
  window.removeEventListener('mouseup', handleGlobalMouseUp);
};

// 组件卸载时移除事件监听
onUnmounted(() => {
  window.removeEventListener('mousemove', handleGlobalMouseMove);
  window.removeEventListener('mouseup', handleGlobalMouseUp);
  clearPreviewPendingFile();
  blobUrls.forEach(url => URL.revokeObjectURL(url));
  blobUrls.clear();
  analysisStore.stopHistoryPolling('job');
});

// 格式化日期 - 确保UTC时间正确转为本地时间
const formatDate = (date) => {
  if (!date) return '';
  let parsedDate;
  if (typeof date === 'string') {
    // 匹配 ISO 8601 格式但不带时区标识的字符串 (如 "2026-07-08T08:18:00")
    // 以及 "2026-07-08 08:18:00" 这类格式，均视为 UTC 时间
    const isoPattern = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;
    if (isoPattern.test(date) && !date.endsWith('Z') && !date.includes('+') && !date.includes('GMT')) {
      // 将空格替换为 T 并附加 Z，强制当作 UTC 时间解析
      const normalized = date.replace(' ', 'T') + 'Z';
      parsedDate = new Date(normalized);
      // 如果解析失败(Invalid Date)，回退到原始字符串
      if (isNaN(parsedDate.getTime())) {
        parsedDate = new Date(date);
      }
    } else {
      parsedDate = new Date(date);
    }
  } else {
    parsedDate = new Date(date);
  }
  if (isNaN(parsedDate.getTime())) return '';
  return parsedDate.toLocaleString('zh-CN', { dateStyle: 'short', timeStyle: 'short', hour12: false });
};

const stripTimestamp = (filename) => {
  if (!filename) return '';
  const dotIdx = filename.lastIndexOf('.');
  const ext = dotIdx > 0 ? filename.slice(dotIdx) : '';
  let base = dotIdx > 0 ? filename.slice(0, dotIdx) : filename;
  base = base
    .replace(/_\d{14}$/, '')
    .replace(/_\d{8}_\d{6}$/, '')
    .replace(/_\d{13}$/, '')
    .replace(/_\d{10}$/, '')
    .replace(/\s*-\s*\d{14}$/, '')
    .replace(/\s*-\s*\d{8}_\d{6}$/, '')
    .replace(/\s*-\s*\d{13}$/, '')
    .replace(/\s*-\s*\d{10}$/, '');
  return base + ext;
};

// 翻译状态
const translateStatus = (status) => {
  const statusMap = {
    processing: t('处理中'), completed: t('已完成'), failed: t('失败'),
    queued: t('排队中'), pending: t('待处理')
  };
  return statusMap[status] || status;
};

// 翻译 modelUsed 字段（三种值：实际名 / "default" / null）
const displayModelUsed = (val) => {
  if (!val) return null;          // null / undefined / '' — 老数据，不显示
  if (val === 'default') return t('默认模型');
  return val;                     // 实际模型名，直接展示
};

</script>


<style scoped>
/* ==================== 工作台三栏布局 ==================== */
.main-area {
  display: grid;
  align-content: start;
  grid-template-columns: 264px minmax(0, 1fr) 344px;
  gap: 16px;
  align-items: start;
  min-height: 100%;
}

.main-alert {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border: 1px solid rgba(220, 38, 38, 0.18);
  border-radius: var(--radius-md);
  background: var(--color-error-light);
  color: var(--color-error);
  font-size: 12.5px;
  /* 出错时从上方滑入，视线能立刻注意到 */
  animation: alertIn 200ms ease backwards;
}

.main-alert-text {
  flex: 1;
  min-width: 0;
  word-break: break-word;
}

.main-alert-close {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: inherit;
  font-size: 14px;
  line-height: 1;
}

.main-alert-close:hover {
  background: rgba(220, 38, 38, 0.1);
}

.main-area h3 {
  margin: 0 0 12px;
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

/* ==================== 左：新建分析 ==================== */
.upload-sidebar {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
}

.upload-controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.model-select {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.model-select-label {
  color: var(--color-text-muted);
  font-size: 12px;
}

.model-select-wrapper select {
  /* 同 UserCenter 的语言下拉：基础样式自带 9px 上下内边距，
     再写死 34px 高度会把 12.5px 的文字压扁、下半截被裁掉。 */
  height: auto;
  padding: 7px 32px 7px 12px;
  font-size: 12.5px;
}

.picker-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.file-input-label,
.folder-input-label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 34px;
  padding: 0 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 12.5px;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast),
    color var(--transition-fast), transform var(--transition-fast);
}

.file-input-label:hover,
.folder-input-label:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-border-strong);
  color: var(--color-text-primary);
  transform: translateY(-1px);
}

.file-input-label:active,
.folder-input-label:active {
  transform: translateY(0) scale(0.99);
}

.file-input-label input,
.folder-input-label input {
  display: none;
}

.label-icon {
  display: flex;
  color: var(--color-text-muted);
  transition: transform var(--transition-fast), color var(--transition-fast);
}

.file-input-label:hover .label-icon,
.folder-input-label:hover .label-icon {
  color: var(--color-text-secondary);
  transform: scale(1.1);
}

.label-icon svg {
  width: 15px;
  height: 15px;
}

.upload-button {
  width: 100%;
  height: 36px;
  font-size: 13px;
}

.job-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 14px;
  border-top: 1px solid var(--color-border-light);
}

.detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
}

.detail-label {
  flex-shrink: 0;
  color: var(--color-text-muted);
}

.detail-filename {
  max-width: 150px;
  overflow: hidden;
  color: var(--color-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-empty {
  color: var(--color-text-light);
}

/* 状态标签 */
.status-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 1px 8px;
  border-radius: var(--radius-full);
  font-size: 11.5px;
  font-weight: 500;
}

.status-tag.status-processing {
  background: var(--color-info-light);
  color: #1d4ed8;
}

.status-tag.status-completed {
  background: var(--color-primary-green-lightest);
  color: var(--color-primary-green-dark);
}

.status-tag.status-failed {
  background: var(--color-error-light);
  color: var(--color-error);
}

.status-tag.status-unselected {
  background: var(--color-surface-hover);
  color: var(--color-text-muted);
}

.status-spinner {
  width: 9px;
  height: 9px;
  border: 1.5px solid rgba(29, 78, 216, 0.28);
  border-top-color: #1d4ed8;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

/* ==================== 中：图像对照 ==================== */
.image-group {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
  min-width: 0;
}

.image-section-wrapper {
  min-width: 0;
}

.image-section {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
}

.image-section h4 {
  margin: 0 0 10px;
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 500;
}

.image-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.image-head h4 {
  margin: 0;
}

.image-open {
  flex-shrink: 0;
  color: var(--color-text-light);
  font-size: 11.5px;
  text-decoration: none;
  transition: color var(--transition-fast), transform var(--transition-fast);
}

.image-open:hover {
  color: var(--color-primary-green-dark);
  text-decoration: underline;
  transform: translate(1px, -1px);
}

.image-container {
  min-width: 0;
}

/* 图片视口：固定尺寸 + overflow:hidden。
   图片的缩放/拖拽都只作用在视口内部，放大后不会溢出到卡片、
   旁边的图片区块或页面上其它元素。
   position:relative 让倍率/重置浮层以它为定位基准。 */
.image-viewport {
  position: relative;
  height: min(52vh, 460px);
  overflow: hidden;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  /* 独立层叠上下文，避免缩放后的图片影响外部层叠顺序 */
  isolation: isolate;
  /* 触控板/触摸设备上不要触发页面滚动或缩放 */
  touch-action: none;
}

.image-container img {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: contain;
  user-select: none;
  transform-origin: center center;
  /* 滚轮缩放时平滑过渡；拖拽时在下面关掉，保证跟手 */
  transition: transform 160ms ease-out;
  /* 缩放由内联 transform 控制，这里避免子像素抖动 */
  will-change: transform;
}

/* 加载中只做一层很淡的骨架底色，绝不降低图片自身的不透明度：
   之前用 opacity 表示"加载中"，一旦 load 事件因缓存命中而没触发，
   图片就会一直显示成半透明，看起来像完全没加载出来。 */
.image-container img.loading {
  background-image: linear-gradient(
    100deg,
    var(--color-surface-muted) 30%,
    var(--color-surface-hover) 50%,
    var(--color-surface-muted) 70%
  );
  background-size: 220% 100%;
  animation: imgShimmer 1.3s ease-in-out infinite;
}

@keyframes imgShimmer {
  from {
    background-position: 120% 0;
  }
  to {
    background-position: -120% 0;
  }
}

.image-container img.dragging {
  cursor: grabbing;
  /* 拖拽时直接跟手，不做过渡 */
  transition: none;
}

/* 放大倍率 + 重置按钮：覆盖在图片上方的浮层。
   绝对定位 + z-index 保证图片无论放大、拖拽到什么位置，
   这个浮层始终显示在图片之上，不会被盖住。 */
.scale-indicator {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 5px 3px 10px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.12);
  color: var(--color-text-secondary);
  font-size: 11.5px;
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
  cursor: default;
  /* 首次放大时浮层弹入，避免突兀出现（backwards：结束后不保留 transform） */
  animation: popIn 160ms ease backwards;
}

.reset-button {
  height: 22px;
  padding: 0 8px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 11.5px;
  cursor: pointer;
}

.reset-button:hover {
  border-color: var(--color-border-strong);
  color: var(--color-text-primary);
}

.image-error {
  margin-top: 8px;
}

/* 文件已丢失（只剩数据库记录）时的占位提示 */
.image-missing {
  margin: 8px 0 0;
  padding: 8px 10px;
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.6;
}

.status-processing {
  margin-top: 8px;
  color: var(--color-text-muted);
  font-size: 12px;
}

.status-completed {
  margin-top: 8px;
  color: var(--color-primary-green-dark);
  font-size: 12px;
}

.failed-detail {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
}

.status-failed {
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  color: var(--color-error);
  font-size: 12px;
  font-weight: 500;
  animation: none;
}

.failed-error-msg {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 11.5px;
  line-height: 1.6;
  word-break: break-word;
}

.failed-meta {
  margin: 0;
  color: var(--color-text-light);
  font-size: 11px;
}

.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 380px;
  padding: 24px;
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-xl);
  background: transparent;
  color: var(--color-text-light);
  font-size: 12.5px;
  text-align: center;
}

/* ==================== 右：待处理 + 记录 ==================== */
.right-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.upper-panel {
  padding: 14px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
}

.pending-group + .pending-group {
  margin-top: 12px;
}

.pending-group-title {
  margin-bottom: 6px;
  color: var(--color-text-muted);
  font-size: 11.5px;
}

.pending-list {
  display: flex;
  max-height: 168px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
  flex-direction: column;
  gap: 2px;
}

.pending-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: 12px;
  transition: background-color var(--transition-fast), color var(--transition-fast),
    transform var(--transition-fast);
}

.pending-item.clickable {
  cursor: pointer;
}

.pending-item.clickable:hover {
  background: var(--color-surface-hover);
  transform: translateX(2px);
}

.pending-item.clickable:active {
  transform: translateX(2px) scale(0.995);
}

.pending-item.is-previewing {
  background: var(--color-primary-green-bg);
  color: var(--color-primary-green-dark);
}

.pending-icon {
  display: flex;
  flex-shrink: 0;
  color: var(--color-text-light);
}

.pending-icon svg {
  width: 14px;
  height: 14px;
}

.pending-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pending-size {
  flex-shrink: 0;
  color: var(--color-text-light);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.pending-remove {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-light);
  font-size: 13px;
  line-height: 1;
}

.pending-remove:hover {
  background: var(--color-error-light);
  color: var(--color-error);
}

.no-pending {
  margin: 10px 0 0;
  color: var(--color-text-light);
  font-size: 12px;
}

/* 上传进度 */
.upload-progress-panel {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border-light);
}

.upload-progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--color-text-secondary);
  font-size: 11.5px;
}

.upload-progress-label {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
}

.upload-progress-spinner {
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  border: 1.5px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.upload-progress-spinner.done {
  border: none;
  background: var(--color-success);
  animation: none;
}

.upload-progress-percent {
  flex-shrink: 0;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.upload-progress-track {
  height: 3px;
  margin-top: 8px;
  border-radius: var(--radius-full);
  background: var(--color-surface-hover);
  overflow: hidden;
}

.upload-progress-fill {
  height: 100%;
  border-radius: var(--radius-full);
  background: var(--color-accent);
  transition: width var(--transition-slow);
}

.upload-progress-fill.done {
  background: var(--color-success);
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* 记录列表 */
.job-list-section {
  display: flex;
  flex-direction: column;
  min-height: 260px;
  padding: 14px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
}

.section-header {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 12px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--color-border-light);
}

.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.section-title-row h3 {
  margin: 0;
}

.section-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.download-summary-button {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 11.5px;
  font-weight: 500;
}

.download-summary-button:hover:not(:disabled) {
  border-color: var(--color-border-strong);
  color: var(--color-text-primary);
}

/* 三个批量操作按钮的 hover 风格与记录条目的删除按钮保持一致：
   浅色底 + 边框带语义色描边 + 语义色文字。
   导出 JSON 用黄色（提示型），导出 Excel 用绿色（成功型），删除用红色。 */
.download-summary-button.json-batch:hover:not(:disabled) {
  border-color: rgba(217, 119, 6, 0.35);
  background: var(--color-warning-light);
  color: var(--color-warning);
}

.download-summary-button.excel-batch:hover:not(:disabled) {
  border-color: rgba(22, 163, 74, 0.35);
  background: var(--color-primary-green-lightest);
  color: var(--color-primary-green-dark);
}

.download-summary-button.delete-batch:hover:not(:disabled) {
  border-color: rgba(220, 38, 38, 0.35);
  background: var(--color-error-light);
  color: var(--color-error);
}

.select-all-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text-muted);
  font-size: 11.5px;
  cursor: pointer;
  user-select: none;
}

.select-all-checkbox input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
}

.checkbox-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border: 1px solid var(--color-border-strong);
  border-radius: 4px;
  background: var(--color-surface);
  transition: background-color var(--transition-fast), border-color var(--transition-fast);
}

.checkbox-check {
  width: 7px;
  height: 4px;
  border-left: 1.5px solid #fff;
  border-bottom: 1.5px solid #fff;
  opacity: 0;
  transform: rotate(-45deg) translateY(-1px);
}

.select-all-checkbox input:checked + .checkbox-box {
  border-color: var(--color-accent);
  background: var(--color-accent);
}

.select-all-checkbox input:checked + .checkbox-box .checkbox-check {
  opacity: 1;
}

.select-all-checkbox.has-selection {
  color: var(--color-text-secondary);
}

/* 导出进度 */
.export-progress-bar {
  margin-bottom: 10px;
  padding: 10px;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.export-progress-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--color-text-muted);
  font-size: 11.5px;
}

.export-progress-track {
  height: 3px;
  margin-top: 8px;
  border-radius: var(--radius-full);
  background: var(--color-border);
  overflow: hidden;
}

.export-progress-fill {
  height: 100%;
  border-radius: var(--radius-full);
  background: var(--color-accent);
  transition: width var(--transition-slow);
}

/* 记录条目 */
.job-list {
  display: flex;
  flex: 1;
  max-height: calc(100vh - 300px);
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
  flex-direction: column;
  gap: 1px;
}

.batch-item {
  border-radius: var(--radius-md);
}

.batch-item.selected {
  background: var(--color-primary-green-bg);
}

.batch-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: var(--radius-md);
  cursor: pointer;
}

.batch-header:hover {
  background: var(--color-surface-hover);
}

.batch-item.selected > .batch-header:hover {
  background: transparent;
}

.batch-icon {
  display: flex;
  flex-shrink: 0;
  color: var(--color-text-light);
}

.batch-icon svg {
  width: 15px;
  height: 15px;
}

.batch-item.selected .batch-icon {
  color: var(--color-primary-green);
}

.batch-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: 12.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.batch-item.selected .batch-label {
  color: var(--color-primary-green-dark);
  font-weight: 500;
}

.batch-model-tag,
.job-model-tag {
  flex-shrink: 0;
  padding: 0 5px;
  border: 1px solid var(--color-border-light);
  border-radius: 4px;
  background: var(--color-surface-muted);
  color: var(--color-text-light);
  font-size: 10.5px;
  line-height: 1.6;
}

.batch-timestamp {
  flex-shrink: 0;
  color: var(--color-text-light);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.expand-button {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-text-light);
}

.expand-button:hover {
  color: var(--color-text-secondary);
}

.expand-icon {
  font-size: 9px;
  line-height: 1;
}

.status-indicator {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-text-light);
}

.status-indicator.status-processing {
  background: var(--color-info);
  animation: statusPulse 1.6s ease-in-out infinite;
}

.status-indicator.status-completed {
  background: var(--color-success);
  /* 处理完成瞬间弹一下，提示状态已变化 */
  animation: popIn 220ms ease backwards;
}

.status-indicator.status-failed {
  background: var(--color-error);
}

.delete-button {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--color-text-light);
  font-size: 13px;
  line-height: 1;
  opacity: 0;
  transition: opacity var(--transition-fast), background-color var(--transition-fast);
}

.batch-header:hover .delete-button,
.job-item:hover .delete-button {
  opacity: 1;
}

.delete-button:hover {
  background: var(--color-error-light);
  color: var(--color-error);
}

.batch-content {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin: 0 0 4px;
  padding: 0 0 0 22px;
  list-style: none;
  /* 展开文件夹时子项依次淡入 */
  animation: fadeInUp 200ms ease backwards;
}

.job-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 6px;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.job-item:hover {
  background: var(--color-surface-hover);
}

.job-item.selected {
  background: var(--color-primary-green-bg);
}

.job-item.selected:hover {
  background: var(--color-primary-green-lightest);
}

.job-info {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.filename {
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.job-item.selected .filename {
  color: var(--color-primary-green-dark);
}

.job-checkbox {
  flex-shrink: 0;
}

.folder-select-all {
  display: flex;
  flex-shrink: 0;
}

.no-jobs-message {
  margin: 20px 0;
  color: var(--color-text-light);
  font-size: 12px;
  text-align: center;
}

@keyframes statusPulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}

/* ==================== Toast ==================== */
.toast-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 72px;
  pointer-events: none;
}

.toast-content {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 420px;
  padding: 10px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-lg);
  color: var(--color-text-primary);
  font-size: 12.5px;
  pointer-events: auto;
}

.toast-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  color: #fff;
  font-size: 10px;
  line-height: 1;
}

.toast-success .toast-icon {
  background: var(--color-success);
}

.toast-error .toast-icon {
  background: var(--color-error);
}

.toast-info .toast-icon {
  background: var(--color-info);
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ==================== 响应式 ==================== */
@media (max-width: 1280px) {
  .main-area {
    grid-template-columns: 244px minmax(0, 1fr) 308px;
  }
}

@media (max-width: 1080px) {
  .main-area {
    grid-template-columns: 244px minmax(0, 1fr);
  }

  .right-panel {
    grid-column: 1 / -1;
    flex-direction: row;
    align-items: flex-start;
  }

  .upper-panel {
    flex: 0 0 300px;
  }

  .job-list-section {
    flex: 1;
  }

  .job-list {
    max-height: none;
  }
}

@media (max-width: 820px) {
  .main-area {
    grid-template-columns: minmax(0, 1fr);
  }

  .image-group {
    grid-template-columns: minmax(0, 1fr);
  }

  .right-panel {
    flex-direction: column;
  }

  .upper-panel {
    flex: none;
    width: 100%;
  }
}
</style>
