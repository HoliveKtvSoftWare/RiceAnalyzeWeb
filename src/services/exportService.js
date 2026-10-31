import apiClient from './apiClient';
import { downloadBlob } from '@/utils/fileDownload';

const exportSingleJson = (analysisId, originalFilename) => {
  console.debug('Exporting JSON for analysis:', analysisId, originalFilename);
  return apiClient.get('/export/json/' + analysisId, {
    responseType: 'blob'
  }).then(response => {
    const filename = downloadBlob(response, 'export.json');
    return { success: true, filename };
  }).catch(error => {
    console.error('Failed to export single JSON:', error.response?.data || error.message);
    throw error;
  });
};

const batchExportJson = (analysisIds) => {
  const params = analysisIds.map(id => 'analysis_ids=' + encodeURIComponent(id)).join('&');
  console.debug('Batch exporting JSON for', analysisIds.length, 'analyses');
  return apiClient.post('/export/json/batch?' + params, null, {
    responseType: 'blob',
    timeout: 0
  }).then(response => {
    const filename = downloadBlob(response, 'batch_export.zip');
    return { success: true, filename };
  }).catch(error => {
    console.error('Failed to batch export JSON:', error.response?.data || error.message);
    throw error;
  });
};

/**
 * 下载选中的数据项（图片或 JSON，可混合）。
 * 后端只打包传入的文件，并按样本名放进对应目录。
 * @param {Array<{analysisId: string, kind: 'image'|'json'}>} items
 * @param {'stem'|'leaf'} [group]
 */
const downloadPackages = (items, group = null) => {
  console.debug('Downloading data packages for', items.length, 'items');
  return apiClient.post('/export/packages', {
    items,
    group,
  }, {
    responseType: 'blob',
    timeout: 0,
  }).then(response => {
    const filename = downloadBlob(response, 'data_package.zip');
    return { success: true, filename, count: items.length };
  }).catch(error => {
    console.error('Failed to download data packages:', error.response?.data || error.message);
    throw error;
  });
};

export const exportService = {
  exportSingleJson,
  batchExportJson,
  downloadPackages,
};