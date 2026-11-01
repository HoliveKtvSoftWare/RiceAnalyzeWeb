import apiClient from './apiClient';
import { transformKeys } from '@/utils/caseTransform';

const fetchModels = (group = null) => {
  return apiClient.get('/analysis/models', {
    params: group ? { group } : {}
  }).then(response => response.data);
};

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

const getHistory = (group = null) => {
  return apiClient.get('/analysis/history', {
    params: group ? { group } : {}
  })
      .then(response => transformKeys(response.data))
      .catch(error => {
        console.error('Failed to fetch history:', error.response?.data || error.message); 
        throw error; 
      });
};

const getMetrics = (analysisId, options = {}) => {
  const { unit = 'μm', scale = 500 } = options;
  return apiClient.get(`/analysis/metrics/${analysisId}`, { params: { unit, scale } })
      .then(response => response.data)
      .catch(error => {
        console.error('Failed to fetch analysis metrics:', error.response?.data || error.message);
        throw error;
      });
};

const deleteJob = (analysisId) => {
  console.debug(`Deleting job with ID: ${analysisId}`);
  return apiClient.delete(`/analysis/delete/${analysisId}`)
      .then(response => response.data)
      .catch(error => {
        console.error('Failed to delete job:', error.response?.data || error.message);
        throw error;
      });
};

const batchDeleteJobs = (analysisIds) => {
  console.debug(`Batch deleting ${analysisIds.length} jobs`);
  return apiClient.post('/analysis/delete/batch', { analysisIds })
      .then(response => response.data)
      .catch(error => {
        console.error('Failed to batch delete jobs:', error.response?.data || error.message);
        throw error;
      });
};

export const analysisService = {
  fetchModels,
  uploadAnalysis,
  getHistory,
  getMetrics,
  deleteJob,
  batchDeleteJobs,
};