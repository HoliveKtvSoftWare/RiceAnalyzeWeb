import { defineStore } from 'pinia';
import { t } from '@/i18n';
import { ref, computed, watch } from 'vue';
import { analysisService } from '@/services/analysisService';

const BATCH_NAME_STORAGE_KEY = 'rice_analysis_batch_names';
const BATCH_PROGRESS_STORAGE_KEY = 'rice_analysis_batch_progress';
const SELECTED_JOB_STORAGE_KEY = 'rice_analysis_selected_job';

function loadSelectedJobId() {
  try {
    return localStorage.getItem(SELECTED_JOB_STORAGE_KEY) || null;
  } catch {   }
  return null;
}

function saveSelectedJobId(analysisId) {
  try {
    if (analysisId) localStorage.setItem(SELECTED_JOB_STORAGE_KEY, analysisId);
    else localStorage.removeItem(SELECTED_JOB_STORAGE_KEY);
  } catch {   }
}

function loadBatchNameMap() {
  try {
    const raw = localStorage.getItem(BATCH_NAME_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {   }
  return {};
}

function saveBatchNameMap(map) {
  try {
    localStorage.setItem(BATCH_NAME_STORAGE_KEY, JSON.stringify(map));
  } catch {   }
}

function loadBatchProgress() {
  try {
    const raw = localStorage.getItem(BATCH_PROGRESS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {   }
  return null;
}

function saveBatchProgress(progress) {
  try {
    if (progress && progress.visible) {
      localStorage.setItem(BATCH_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
    } else {
      localStorage.removeItem(BATCH_PROGRESS_STORAGE_KEY);
    }
  } catch {   }
}

export const useStemAnalysisStore = defineStore('stemAnalysis', () => {
  const isLoading = ref(false);
  const error = ref(null);
  const historyList = ref([]);
  const selectedJob = ref(null);

  const batchNameMap = ref(loadBatchNameMap());

  let historyRequestInFlight = null;
  let lastHistoryFetchAt = 0;
  const HISTORY_FRESH_MS = 15000;

  function setBatchName(batchId, name) {
    if (!batchId || !name) return;
    batchNameMap.value[batchId] = name;
    saveBatchNameMap(batchNameMap.value);
  }

  function getBatchName(batchId) {
    if (!batchId) return null;
    return batchNameMap.value[batchId] || null;
  }

  const availableModels = ref([]);
  const defaultModelName = ref(null);
  const currentModelName = ref(null);
  const modelsLoaded = ref(false);
  const modelsLoading = ref(false);

  const savedProgress = loadBatchProgress();
  const batchProgress = ref(savedProgress || {
    visible: false,
    type: '',
    batchId: null,
    total: 0,
    completed: 0
  });

  const POLL_BASE_DELAY = 1200;
  const POLL_MAX_DELAY = 3000;

  let pollTimer = null;
  let pollDelay = POLL_BASE_DELAY;
  let lastStatusSignature = '';
  let batchFinalHideTimer = null;
  const pollReasons = new Set();

  let lastSavedProgress = '';

  watch(batchProgress, (val) => {
    const signature = `${val.visible}|${val.type}|${val.batchId}|${val.total}|${val.completed}`;
    if (signature === lastSavedProgress) return;
    lastSavedProgress = signature;
    saveBatchProgress(val);
  }, { deep: true });

  const batchProgressPercent = computed(() => {
    const total = batchProgress.value.total;
    const completed = batchProgress.value.completed;
    if (!total || total <= 0) return 0;
    return Math.min(100, Math.round((completed / total) * 1000) / 10);
  });

  function statusSignature(list) {
    let sig = '';
    for (const job of list) sig += job.status === 'processing' ? '1' : '0';
    return sig;
  }

  function clearPollTimer() {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  function schedulePoll(delay) {
    clearPollTimer();
    pollTimer = setTimeout(pollTick, delay);
  }

  function syncBatchProgress() {
    const progress = batchProgress.value;
    if (!progress.visible) return;
    if (progress.type !== 'stem') return;

    let targetJobs = historyList.value;
    if (progress.batchId) {
      const filtered = historyList.value.filter(j => j.batchId === progress.batchId);
      if (filtered.length > 0) targetJobs = filtered;
    }

    progress.completed = targetJobs.filter(j => j.status !== 'processing').length;

    if (progress.total > 0 && progress.completed >= progress.total) {
      stopHistoryPolling('batch');
      if (!batchFinalHideTimer) {
        batchFinalHideTimer = setTimeout(() => {
          batchProgress.value.visible = false;
          batchFinalHideTimer = null;
        }, 2000);
      }
    }
  }

  async function pollTick() {
    pollTimer = null;
    if (pollReasons.size === 0) return;

    try {
      await fetchHistoryAction(false);
    } catch (err) {
      console.error('History polling error:', err);
    }

    const signature = statusSignature(historyList.value);
    if (signature !== lastStatusSignature) {
      lastStatusSignature = signature;
      pollDelay = POLL_BASE_DELAY;
    } else {
      pollDelay = Math.min(POLL_MAX_DELAY, pollDelay + 200);
    }

    if (pollReasons.size > 0) schedulePoll(pollDelay);
  }

  function startHistoryPolling(reason = 'job') {
    if (pollReasons.has(reason)) return;
    pollReasons.add(reason);
    lastStatusSignature = statusSignature(historyList.value);
    pollDelay = POLL_BASE_DELAY;
    schedulePoll(POLL_BASE_DELAY);
  }

  function stopHistoryPolling(reason = 'job') {
    pollReasons.delete(reason);
    if (pollReasons.size === 0) clearPollTimer();
  }

  function stopBatchProgressPolling() {
    stopHistoryPolling('batch');
    if (batchFinalHideTimer) {
      clearTimeout(batchFinalHideTimer);
      batchFinalHideTimer = null;
    }
  }

  function startBatchProgressPolling(type, totalCount, batchId = null) {
    stopBatchProgressPolling();

    batchProgress.value = {
      visible: true,
      type: type,
      batchId: batchId,
      total: totalCount,
      completed: 0
    };

    if (type === 'stem') startHistoryPolling('batch');
  }

  function resumeBatchProgressPolling(type, totalCount, batchId, currentCompleted) {
    stopBatchProgressPolling();

    batchProgress.value = {
      visible: true,
      type: type,
      batchId: batchId,
      total: totalCount,
      completed: currentCompleted
    };

    if (type === 'stem') startHistoryPolling('batch');
  }

  function setBatchProgressCompleted(completed) {
    const progress = batchProgress.value;
    if (!progress.visible) return;

    progress.completed = Math.max(0, Math.min(progress.total, Number(completed) || 0));

    if (progress.total > 0 && progress.completed >= progress.total) {
      if (!batchFinalHideTimer) {
        batchFinalHideTimer = setTimeout(() => {
          batchProgress.value.visible = false;
          batchFinalHideTimer = null;
        }, 2000);
      }
    }
  }

  function clearBatchProgress() {
    stopBatchProgressPolling();
    batchProgress.value = { visible: false, type: '', batchId: null, total: 0, completed: 0 };
  }

  function setError(message) {
    error.value = message;
  }

  async function fetchModelsAction() {
    modelsLoading.value = true;
    try {
      const data = await analysisService.fetchModels('stem');
      availableModels.value = data.models || [];
      defaultModelName.value = data.default || null;
      if (!currentModelName.value && data.default) {
        currentModelName.value = data.default;
      }
      modelsLoaded.value = true;
      console.log('Models fetched:', availableModels.value, 'default:', defaultModelName.value);
    } catch (err) {
      console.error('Failed to fetch models:', err.response?.data || err.message);
      modelsLoaded.value = true;
    } finally {
      modelsLoading.value = false;
    }
  }

  async function uploadAnalysisAction(files, modelName = null, onProgress = null) {
    isLoading.value = true;
    setError(null);
    try {
      const responseData = await analysisService.uploadAnalysis(files, modelName, onProgress);
      console.log('Unified upload successful, response:', responseData);

      await fetchHistoryAction(false, true);

      return responseData;
    } catch (err) {
      console.error('Unified upload action failed:', err.response?.data || err.message);
      const detail = err.response?.data?.detail || err.message || t('上传文件失败。');
      setError(detail);
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchHistoryAction(manageLoading = true, force = false) {
    if (historyRequestInFlight && !force) {
      return historyRequestInFlight;
    }

    if (manageLoading) isLoading.value = true;
    setError(null);

    const request = (async () => {
      const historyData = await analysisService.getHistory('stem');
      historyList.value = historyData;
      lastHistoryFetchAt = Date.now();

      let mapChanged = false;
      for (const job of historyData) {
        if (job.batchId && job.batchName) {
          if (batchNameMap.value[job.batchId] !== job.batchName) {
            batchNameMap.value[job.batchId] = job.batchName;
            mapChanged = true;
          }
        }
      }
      if (mapChanged) {
        saveBatchNameMap(batchNameMap.value);
      }

      if (selectedJob.value) {
        const updated = historyData.find(j => j.analysisId === selectedJob.value.analysisId);
        if (updated) {
          selectedJob.value = updated;
        }
      } else {
        const storedId = loadSelectedJobId();
        if (storedId) {
          const restored = historyData.find(j => j.analysisId === storedId);
          if (restored) selectedJob.value = restored;
          else saveSelectedJobId(null);
        }
      }

      syncBatchProgress();
      return historyData;
    })();

    historyRequestInFlight = request;

    try {
      return await request;
    } catch (err) {
      console.error('Fetch history action failed:', err);
      setError(t('无法加载分析历史记录。'));
      historyList.value = [];
      return historyList.value;
    } finally {
      if (historyRequestInFlight === request) historyRequestInFlight = null;
      if (manageLoading) isLoading.value = false;
    }
  }

  async function fetchHistoryIfStale(manageLoading = true, maxAge = HISTORY_FRESH_MS) {
    if (historyList.value.length > 0 && Date.now() - lastHistoryFetchAt < maxAge) {
      return historyList.value;
    }
    return fetchHistoryAction(manageLoading);
  }

  function selectJobAction(job) {
    console.debug('Job selected:', job);
    selectedJob.value = job; 
    saveSelectedJobId(job?.analysisId || null);
    setError(null);
  }

  async function deleteJobAction(analysisId) {
    isLoading.value = true;
    setError(null);
    try {
      await analysisService.deleteJob(analysisId);

      const index = historyList.value.findIndex(job => job.analysisId === analysisId);
      if (index !== -1) {
        historyList.value.splice(index, 1);
      }

      if (selectedJob.value && selectedJob.value.analysisId === analysisId) {
        selectedJob.value = null;
        saveSelectedJobId(null);
      }

      console.log(`Job ${analysisId} deleted successfully`);
      return true;
    } catch (err) {
      console.error('Delete job action failed:', err);
      const detail = err.response?.data?.detail || err.message || t('删除记录失败。');
      setError(detail);
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function batchDeleteAction(analysisIds) {
    isLoading.value = true;
    setError(null);
    try {
      const result = await analysisService.batchDeleteJobs(analysisIds);

      const deletedSet = new Set(analysisIds);
      historyList.value = historyList.value.filter(job => !deletedSet.has(job.analysisId));

      if (selectedJob.value && deletedSet.has(selectedJob.value.analysisId)) {
        selectedJob.value = null;
        saveSelectedJobId(null);
      }

      console.log('Batch delete result:', result);
      return result;
    } catch (err) {
      console.error('Batch delete action failed:', err);
      const detail = err.response?.data?.detail || err.message || t('批量删除记录失败。');
      setError(detail);
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  if (batchProgress.value.visible && batchProgress.value.total > 0 && batchProgress.value.completed < batchProgress.value.total) {
    const { type, total, batchId, completed } = batchProgress.value;
    resumeBatchProgressPolling(type, total, batchId, completed);
  }

  return {
    isLoading,
    error,
    historyList,
    selectedJob,
    availableModels,
    defaultModelName,
    currentModelName,
    modelsLoaded,
    modelsLoading,
    batchProgress,
    batchProgressPercent,
    batchNameMap,
    setBatchName,
    getBatchName,
    startBatchProgressPolling,
    setBatchProgressCompleted,
    startHistoryPolling,
    stopHistoryPolling,
    clearBatchProgress,
    uploadAnalysisAction,
    fetchHistoryAction,
    fetchHistoryIfStale,
    fetchModelsAction,
    selectJobAction,
    setError,
    deleteJobAction,
    batchDeleteAction,
  };
});