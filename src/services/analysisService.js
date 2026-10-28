import apiClient from './apiClient';
import { transformKeys } from '@/utils/transform';

/**
 * 获取后端可用的模型列表
 * @param {string} [group] - 分析大类：stem=茎秆 / leaf=剑叶；不传返回全部
 * @returns {Promise<{models: Array<{name: string, path: string}>, default: string}>}
 */
const fetchModels = (group = null) => {
  return apiClient.get('/analysis/models', {
    params: group ? { group } : {}
  }).then(response => response.data);
};

/**
 * 上传图片文件进行分析
 * @param {File} file - 用户选择的图片文件对象
 * @param {string} batchId - 批次ID，用于标识同一次上传的多个文件
 * @param {string} [modelName] - 选中的模型名称（可选，不传则后端用默认模型）
 * @returns {Promise<object>} 后端返回的包含 analysis_id 的响应数据或抛出错误
 */
const uploadFile = (file, batchId = null, modelName = null, onProgress = null, batchName = null) => {
  const formData = new FormData();
  formData.append('file', file);
  if (batchId) {
    formData.append('batch_id', batchId);
  }
  if (modelName) {
    formData.append('model_name', modelName);
  }
  if (batchName) {
    formData.append('batch_name', batchName);
  }

  return apiClient.post('/analysis/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.round((event.loaded * 100) / event.total));
      }
    },
  }).then(response => transformKeys(response.data));
};

/**
 * 批量上传文件夹中的图片进行分析
 * @param {FileList|Array} files - 文件夹中的文件列表
 * @param {string} [modelName] - 选中的模型名称（可选，整个批次用同一个模型）
 * @returns {Promise<object>} 后端返回的批量上传结果
 */
const uploadFolder = (files, modelName = null, onProgress = null, batchName = null) => {
  const fileArray = Array.from(files);
  const formData = new FormData();
  fileArray.forEach(file => {
    formData.append('files', file);
  });
  if (modelName) {
    formData.append('model_name', modelName);
  }
  if (batchName) {
    formData.append('batch_name', batchName);
  }

  return apiClient.post('/analysis/upload/batch', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.round((event.loaded * 100) / event.total));
      }
    },
  }).then(response => transformKeys(response.data));
};

/**
 * 自适应上传分析（统一入口）
 * 根据文件数量自动调用后端自适应接口，单张/批量一键处理
 * @param {File[]} files - 文件数组（1个或多个）
 * @param {string} [modelName] - 选中的模型名称（可选）
 * @param {Function} [onProgress] - 上传进度回调
 * @param {string} [taskType] - 分析类型：stem（默认）/ leaf
 * @returns {Promise<object>} 后端响应（已经过 transformKeys 转换）
 *   - 单张: 包含 analysisId 字段
 *   - 批量: 包含 totalFiles 和 analyses 数组
 */
const uploadAnalysis = (files, modelName = null, onProgress = null, taskType = 'stem') => {
  const fileArray = Array.isArray(files) ? files : Array.from(files);
  const formData = new FormData();
  fileArray.forEach(file => {
    formData.append('files', file);
  });
  if (modelName) {
    formData.append('model_name', modelName);
  }
  formData.append('task_type', taskType);

  return apiClient.post('/analysis/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.round((event.loaded * 100) / event.total));
      }
    },
  }).then(response => transformKeys(response.data));
};

/**
 * 获取当前用户的分析历史记录
 * @param {string} [group] - 分析大类：stem=茎秆 / leaf=剑叶；不传返回全部
 * @returns {Promise<Array<object>>} 包含分析记录对象的数组或抛出错误
 */
const getHistory = (group = null) => {
  // 注意：这里不要 debug 打印整个响应体。轮询期间每 1~3 秒就会返回一次
  // 上百条记录，把整棵对象序列化到控制台会明显增加主线程开销。
  return apiClient.get('/analysis/history', {
    params: group ? { group } : {}
  })
      .then(response => transformKeys(response.data))
      .catch(error => {
        console.error('Failed to fetch history:', error.response?.data || error.message); // 添加日志
        throw error; // 将错误继续抛出
      });
};

/**
 * 获取单条已完成记录的指标明细（面积 / 周长 / 维管束计数等）
 * @param {string} analysisId - 分析记录 ID
 * @param {{unit?: string, scale?: number}} [options]
 * @returns {Promise<{analysisId: string, taskType: string, unit: string, metrics: object}>}
 */
const getMetrics = (analysisId, options = {}) => {
  const { unit = 'μm', scale = 500 } = options;
  return apiClient.get(`/analysis/metrics/${analysisId}`, { params: { unit, scale } })
      .then(response => response.data)
      .catch(error => {
        console.error('Failed to fetch analysis metrics:', error.response?.data || error.message);
        throw error;
      });
};

/**
 * 删除指定的分析记录
 * @param {string} analysisId - 要删除的分析记录ID
 * @returns {Promise<object>} 删除操作的结果
 */
const deleteJob = (analysisId) => {
  console.debug(`Deleting job with ID: ${analysisId}`);
  return apiClient.delete(`/analysis/delete/${analysisId}`)
      .then(response => response.data)
      .catch(error => {
        console.error('Failed to delete job:', error.response?.data || error.message);
        throw error;
      });
};

/**
 * 批量删除分析记录
 * @param {Array<string>} analysisIds - 要删除的分析记录ID数组
 * @returns {Promise<object>} 批量删除操作的结果
 */
const batchDeleteJobs = (analysisIds) => {
  console.debug(`Batch deleting ${analysisIds.length} jobs`);
  return apiClient.post('/analysis/delete/batch', { analysisIds })
      .then(response => response.data)
      .catch(error => {
        console.error('Failed to batch delete jobs:', error.response?.data || error.message);
        throw error;
      });
};

// 导出服务对象
export const analysisService = {
  fetchModels,
  uploadFile,
  uploadFolder,
  uploadAnalysis,
  getHistory,
  getMetrics,
  deleteJob,
  batchDeleteJobs,
};