import { defineStore } from 'pinia';
import { t } from '@/i18n';
import { computed, ref } from 'vue';
import { analysisService } from '@/services/analysisService';
import { useStemAnalysisStore } from '@/stores/stemAnalysis';

const GROUP = 'leaf';
const POLL_INTERVAL = 1500;

export const useLeafAnalysisStore = defineStore('leafAnalysis', () => {
  const models = ref([]);
  const defaultModel = ref(null);
  const currentModel = ref(null);
  const modelsLoading = ref(false);
  const modelsLoaded = ref(false);

  const history = ref([]);
  const selectedJob = ref(null);
  const selectedIds = ref([]);

  const loading = ref(false);
  const error = ref(null);
  const uploading = ref(false);
  const uploadPercent = ref(0);
  const unit = ref('μm');

  const metrics = ref(null);
  const metricsLoading = ref(false);
  const metricsError = ref(null);
  const metricsJobId = ref(null);

  let pollTimer = null;

  const processingJobs = computed(() => history.value.filter(job => job.status === 'processing'));
  const hasProcessing = computed(() => processingJobs.value.length > 0);
  const completedSelected = computed(() => selectedIds.value.filter(id => {
    const job = history.value.find(item => item.analysisId === id);
    return job && job.status === 'completed';
  }));

  function setError(message) {
    error.value = message;
  }

  function stopPolling() {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  function ensurePolling() {
    stopPolling();
    if (!hasProcessing.value) return;
    pollTimer = setTimeout(async () => {
      pollTimer = null;
      await fetchHistory(false);
    }, POLL_INTERVAL);
  }

  async function fetchModels() {
    modelsLoading.value = true;
    try {
      const data = await analysisService.fetchModels(GROUP);
      models.value = data.models || [];
      defaultModel.value = data.default || null;
      const names = models.value.map(item => item.name);
      if (!currentModel.value || !names.includes(currentModel.value)) {
        currentModel.value = defaultModel.value || names[0] || null;
      }
      modelsLoaded.value = true;
    } catch (err) {
      console.error('Leaf models fetch failed:', err.response?.data || err.message);
      modelsLoaded.value = true;
    } finally {
      modelsLoading.value = false;
    }
  }

  function syncBatchProgress(list) {
    const analysisStore = useStemAnalysisStore();
    const progress = analysisStore.batchProgress;
    if (!progress.visible || progress.type !== 'flag_leaf') return;

    let jobs = list;
    if (progress.batchId) {
      const filtered = list.filter(job => job.batchId === progress.batchId);
      if (filtered.length > 0) jobs = filtered;
    }
    const completed = jobs.filter(job => job.status !== 'processing' && job.status !== 'queued').length;
    analysisStore.setBatchProgressCompleted(completed);
  }

  async function fetchHistory(manageLoading = true) {
    if (manageLoading) loading.value = true;
    try {
      const list = await analysisService.getHistory(GROUP);
      history.value = list;
      syncBatchProgress(list);

      if (selectedJob.value) {
        const previous = selectedJob.value;
        const updated = list.find(job => job.analysisId === previous.analysisId);
        if (updated) {
          selectedJob.value = updated;
          const justCompleted = previous.status !== 'completed' && updated.status === 'completed';
          if (updated.status === 'completed' && (justCompleted || metricsJobId.value !== updated.analysisId)) {
            fetchMetrics(updated.analysisId);
          }
        }
      }
      const ids = new Set(list.map(job => job.analysisId));
      selectedIds.value = selectedIds.value.filter(id => ids.has(id));

      return list;
    } catch (err) {
      console.error('Leaf history fetch failed:', err.response?.data || err.message);
      setError(t('无法加载剑叶分析记录。'));
      history.value = [];
      return [];
    } finally {
      if (manageLoading) loading.value = false;
      ensurePolling();
    }
  }

  async function selectJob(job) {
    selectedJob.value = job;
    setError(null);
    if (job && job.status === 'completed') {
      await fetchMetrics(job.analysisId);
    } else {
      metrics.value = null;
      metricsError.value = null;
      metricsJobId.value = null;
    }
  }

  async function fetchMetrics(analysisId) {
    if (!analysisId) return;
    metricsLoading.value = true;
    metricsError.value = null;
    try {
      const data = await analysisService.getMetrics(analysisId, { unit: unit.value });
      if (selectedJob.value && selectedJob.value.analysisId === analysisId) {
        metrics.value = data.metrics || null;
        metricsJobId.value = analysisId;
      }
    } catch (err) {
      metricsError.value = err.response?.data?.detail || err.message || t('指标加载失败');
      metrics.value = null;
      metricsJobId.value = null;
    } finally {
      metricsLoading.value = false;
    }
  }

  async function setUnit(nextUnit) {
    unit.value = nextUnit;
    if (selectedJob.value && selectedJob.value.status === 'completed') {
      await fetchMetrics(selectedJob.value.analysisId);
    }
  }

  async function upload(files, onProgress = null) {
    if (!files || files.length === 0) return null;
    uploading.value = true;
    uploadPercent.value = 0;
    setError(null);
    try {
      const names = models.value.map(item => item.name);
      const modelName = names.includes(currentModel.value)
        ? currentModel.value
        : (defaultModel.value || names[0] || null);
      const response = await analysisService.uploadAnalysis(
        files,
        modelName,
        (percent) => {
          uploadPercent.value = percent;
          if (onProgress) onProgress(percent);
        },
        GROUP
      );
      await fetchHistory(false);

      const analysisStore = useStemAnalysisStore();
      const batchId = response?.batchId || response?.batch_id || null;
      analysisStore.startBatchProgressPolling('flag_leaf', files.length, batchId);
      syncBatchProgress(history.value);

      return response;
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || t('上传剑叶图片失败。');
      if (String(detail).includes(t('未知模型'))) {
        await fetchModels();
      }
      setError(detail);
      return null;
    } finally {
      uploading.value = false;
      uploadPercent.value = 0;
    }
  }

  async function removeJob(analysisId) {
    loading.value = true;
    setError(null);
    try {
      await analysisService.deleteJob(analysisId);
      history.value = history.value.filter(job => job.analysisId !== analysisId);
      selectedIds.value = selectedIds.value.filter(id => id !== analysisId);
      if (selectedJob.value && selectedJob.value.analysisId === analysisId) {
        selectedJob.value = null;
        metrics.value = null;
        metricsJobId.value = null;
      }
      return true;
    } catch (err) {
      setError(err.response?.data?.detail || err.message || t('删除记录失败。'));
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function removeBatch(analysisIds) {
    if (!analysisIds || analysisIds.length === 0) return null;
    loading.value = true;
    setError(null);
    try {
      const result = await analysisService.batchDeleteJobs(analysisIds);
      const removed = new Set(analysisIds);
      history.value = history.value.filter(job => !removed.has(job.analysisId));
      selectedIds.value = selectedIds.value.filter(id => !removed.has(id));
      if (selectedJob.value && removed.has(selectedJob.value.analysisId)) {
        selectedJob.value = null;
        metrics.value = null;
        metricsJobId.value = null;
      }
      return result;
    } catch (err) {
      setError(err.response?.data?.detail || err.message || t('批量删除失败。'));
      return null;
    } finally {
      loading.value = false;
    }
  }

  function toggleSelect(analysisId) {
    const index = selectedIds.value.indexOf(analysisId);
    if (index >= 0) selectedIds.value.splice(index, 1);
    else selectedIds.value.push(analysisId);
  }

  function selectAll(analysisIds) {
    selectedIds.value = [...analysisIds];
  }

  function clearSelection() {
    selectedIds.value = [];
  }

  return {
    GROUP,
    models,
    currentModel,
    modelsLoading,
    modelsLoaded,
    history,
    selectedJob,
    selectedIds,
    loading,
    error,
    uploading,
    uploadPercent,
    unit,
    metrics,
    metricsLoading,
    metricsError,
    processingJobs,
    completedSelected,
    setError,
    fetchModels,
    fetchHistory,
    selectJob,
    setUnit,
    upload,
    removeJob,
    removeBatch,
    toggleSelect,
    selectAll,
    clearSelection,
    stopPolling,
  };
});