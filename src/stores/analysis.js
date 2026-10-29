import { defineStore } from 'pinia';
import { t } from '@/i18n';
import { ref, computed, watch } from 'vue';
import { analysisService } from '@/services/analysisService';

const BATCH_NAME_STORAGE_KEY = 'rice_analysis_batch_names';
const BATCH_PROGRESS_STORAGE_KEY = 'rice_analysis_batch_progress';
// 上次选中的记录 id：刷新页面 / 重开标签页后据此恢复选中状态
const SELECTED_JOB_STORAGE_KEY = 'rice_analysis_selected_job';

function loadSelectedJobId() {
  try {
    return localStorage.getItem(SELECTED_JOB_STORAGE_KEY) || null;
  } catch { /* localStorage unavailable */ }
  return null;
}

function saveSelectedJobId(analysisId) {
  try {
    if (analysisId) localStorage.setItem(SELECTED_JOB_STORAGE_KEY, analysisId);
    else localStorage.removeItem(SELECTED_JOB_STORAGE_KEY);
  } catch { /* localStorage unavailable */ }
}

function loadBatchNameMap() {
  try {
    const raw = localStorage.getItem(BATCH_NAME_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* localStorage unavailable */ }
  return {};
}

function saveBatchNameMap(map) {
  try {
    localStorage.setItem(BATCH_NAME_STORAGE_KEY, JSON.stringify(map));
  } catch { /* localStorage unavailable */ }
}

function loadBatchProgress() {
  try {
    const raw = localStorage.getItem(BATCH_PROGRESS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* localStorage unavailable */ }
  return null;
}

function saveBatchProgress(progress) {
  try {
    if (progress && progress.visible) {
      localStorage.setItem(BATCH_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
    } else {
      localStorage.removeItem(BATCH_PROGRESS_STORAGE_KEY);
    }
  } catch { /* localStorage unavailable */ }
}

export const useAnalysisStore = defineStore('analysis', () => {
  const isLoading = ref(false);
  const error = ref(null);
  const historyList = ref([]);
  /** @type {{analysisId: string, originalFilename: string, originalImageUrl: string, annotatedImageUrl: string, status: string, createdAt: string, batchId?: string} | null} */
  const selectedJob = ref(null);

  const batchNameMap = ref(loadBatchNameMap());

  // 正在进行的"历史记录"请求，用于合并并发刷新（见 fetchHistoryAction）
  let historyRequestInFlight = null;
  // 上次成功拉取历史记录的时间：页面快速来回切换时直接复用，避免记录条反复重载
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

  /** @type {Array<{name: string, path: string}>} */
  const availableModels = ref([]);
  const defaultModelName = ref(null);
  const currentModelName = ref(null);
  const modelsLoaded = ref(false);
  const modelsLoading = ref(false);

  // 批次分割进度（全局浮层，跨页面保持）
  const savedProgress = loadBatchProgress();
  const batchProgress = ref(savedProgress || {
    visible: false,
    type: '',
    batchId: null,
    total: 0,
    completed: 0
  });

  // --- 统一的历史轮询调度 --------------------------------------------------
  // 批量进度浮层和单任务详情都只是"订阅"同一条轮询链路：
  // 同一时刻最多只有一个定时器在跑，之前是两处 setInterval 各自请求历史接口，
  // 轮询期间请求量翻倍、响应也更容易被占满。
  const POLL_BASE_DELAY = 1200;
  const POLL_MAX_DELAY = 3000;

  let pollTimer = null;
  let pollDelay = POLL_BASE_DELAY;
  let lastStatusSignature = '';
  let batchFinalHideTimer = null;
  const pollReasons = new Set();

  let lastSavedProgress = '';

  watch(batchProgress, (val) => {
    // 只在真正变化时写 localStorage，避免每次进度刷新都序列化一次
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

  /** 每次历史数据刷新后同步批量进度浮层 */
  function syncBatchProgress() {
    const progress = batchProgress.value;
    if (!progress.visible) return;

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

    // 状态有变化时保持较快节奏；长时间没有变化就逐步降频，减少无谓请求
    const signature = statusSignature(historyList.value);
    if (signature !== lastStatusSignature) {
      lastStatusSignature = signature;
      pollDelay = POLL_BASE_DELAY;
    } else {
      pollDelay = Math.min(POLL_MAX_DELAY, pollDelay + 200);
    }

    if (pollReasons.size > 0) schedulePoll(pollDelay);
  }

  /**
   * 订阅历史轮询（reason 用来去重：'batch' 批次进度、'job' 单任务详情）
   */
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

    startHistoryPolling('batch');
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

    startHistoryPolling('batch');
  }

  function clearBatchProgress() {
    stopBatchProgressPolling();
    batchProgress.value = { visible: false, type: '', batchId: null, total: 0, completed: 0 };
  }

  /**
   * 设置/清除错误信息
   */
  function setError(message) {
    // 这个 action 负责所有对 error状态的修改
    error.value = message;
  }

  /**
   * 从后端拉取可用模型列表
   */
  async function fetchModelsAction() {
    modelsLoading.value = true;
    try {
      // 茎秆页只取茎秆模型，剑叶模型由剑叶页面单独获取
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

  /**
   * 上传图片文件进行分析
   * @param {File} file - 要上传的文件
   * @param {string} batchId - 批次ID，用于标识同一次上传的多个文件
   * @param {string} [modelName] - 选中的模型名称（可选）
   */
  async function uploadFileAction(file, batchId = null, modelName = null, onProgress = null, manageLoading = true, batchName = null) {
    if (manageLoading) isLoading.value = true;
    setError(null);
    try {
      const responseData = await analysisService.uploadFile(file, batchId, modelName, onProgress, batchName);
      console.log('Upload successful, response:', responseData);

      if (responseData.analysisId && responseData.originalFilename) {
        if (batchId && batchName) {
          setBatchName(batchId, batchName);
        }
        await fetchHistoryAction(false, true);
      } else {
        console.error('Upload response missing analysis_id or original_filename:', responseData);
        setError(t('上传响应无效。')); // 调用 action 设置错误
      }
      return true; // 表示上传操作成功
    } catch (err) {
      console.error('Upload action failed:', err.response?.data || err.message);
      // 从后端错误中提取 detail 字段
      const detail = err.response?.data?.detail || err.message || t('上传文件失败。');
      setError(detail); // 调用 action 设置错误
      return false; // 表示上传操作失败
    } finally {
      if (manageLoading) isLoading.value = false;
    }
  }

  /**
   * 自适应上传分析（统一入口）
   * 根据传入文件数量自动适配后端单张/批量处理
   * @param {File[]} files - 文件数组（1个或多个）
   * @param {string} [modelName] - 选中的模型名称（可选）
   * @param {Function} [onProgress] - 上传进度回调
   */
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

  /**
   * 批量上传文件夹进行分析
   * @param {FileList|Array} files - 文件夹中的文件列表
   * @param {string} [modelName] - 选中的模型名称（可选，整个批次用同一个模型）
   */
  async function uploadFolderAction(files, modelName = null, onProgress = null, manageLoading = true, batchName = null) {
    if (manageLoading) isLoading.value = true;
    setError(null);
    try {
      const responseData = await analysisService.uploadFolder(files, modelName, onProgress, batchName);
      console.log('Folder upload successful, response:', responseData);

      const responseBatchId = responseData?.batchId || responseData?.batch_id;
      if (responseBatchId && batchName) {
        setBatchName(responseBatchId, batchName);
      }

      await fetchHistoryAction(false, true);

      return responseData; // 返回响应数据
    } catch (err) {
      console.error('Folder upload action failed:', err.response?.data || err.message);
      const detail = err.response?.data?.detail || err.message || t('上传文件夹失败。');
      setError(detail);
      return null;
    } finally {
      if (manageLoading) isLoading.value = false;
    }
  }

  /**
   * 获取分析历史记录
   * @param {boolean} [manageLoading=true] - 是否管理全局 isLoading 状态
   * @param {boolean} [force=false] - 是否强制发起新请求。
   *   上传完成等"数据已变化"的场景传 true，避免复用轮询中发出的旧请求结果。
   */
  async function fetchHistoryAction(manageLoading = true, force = false) {
    // 单飞（single-flight）：已有请求在飞时直接复用，
    // 轮询、进度浮层、页面挂载可能同时触发刷新，没必要重复打后端。
    if (historyRequestInFlight && !force) {
      return historyRequestInFlight;
    }

    if (manageLoading) isLoading.value = true;
    setError(null);

    const request = (async () => {
      // 茎秆页只取 task_type=stem 的记录，避免把剑叶记录混进来
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
        // 刷新页面后恢复上次选中的记录：按 id 在当前用户的历史里找，
        // 记录已被删除（或不属于当前账号）时自然匹配不到，顺手清掉这条过期记录。
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

  /**
   * 页面挂载时使用：数据还新鲜就不重复请求，避免记录条和缩略图重新加载。
   * 轮询仍然走 fetchHistoryAction，不受这里的节流影响。
   */
  async function fetchHistoryIfStale(manageLoading = true, maxAge = HISTORY_FRESH_MS) {
    if (historyList.value.length > 0 && Date.now() - lastHistoryFetchAt < maxAge) {
      return historyList.value;
    }
    return fetchHistoryAction(manageLoading);
  }

  function selectJobAction(job) {
    console.debug('Job selected:', job);
    selectedJob.value = job; // 更新选中的记录
    saveSelectedJobId(job?.analysisId || null);
    // 选中新任务时也清除错误
    setError(null);
  }

  /**
   * 删除指定的分析记录
   */
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

  // 刷新后恢复批次进度浮层
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
    startHistoryPolling,
    stopHistoryPolling,
    clearBatchProgress,
    uploadFileAction,
    uploadFolderAction,
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