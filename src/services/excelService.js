import apiClient from './apiClient';
import { t } from '@/i18n';
import { downloadBlob } from '@/utils/fileDownload';
import { transformKeys } from '@/utils/caseTransform';

const getExportColumns = (group = 'stem') => {
    console.debug('Fetching export columns configuration...');
    return apiClient.get('/excel/columns', { params: { group } })
        .then(response => response.data)
        .catch(error => {
            console.error('Failed to fetch export columns:', error.response?.data || error.message);
            throw error;
        });
};

const exportSingleToExcel = (analysisId, originalFilename, selectedColumns, unit, group = 'stem') => {
    console.debug(`Exporting single analysis ${analysisId} (${originalFilename}) to Excel...`);
    return apiClient.post(`/excel/${analysisId}`, { selectedColumns, unit, group }, {
        responseType: 'blob',
        timeout: group === 'leaf' ? 0 : 30000
    }).then(response => {
        console.debug('Single Excel export successful');
        const filename = downloadBlob(response, 'export.xlsx');
        return { filename };
    }).catch(error => {
        console.error('Failed to export single Excel:', error.response?.data || error.message);
        throw error;
    });
};

const batchExportToExcel = (analysisIds, selectedColumns, unit, asyncMode = false, group = 'stem') => {
    console.debug(`Batch exporting ${analysisIds.length} analyses to Excel, asyncMode:`, asyncMode);
    return apiClient.post('/excel/batch', { analysisIds, selectedColumns, unit, asyncMode, group }, {
        responseType: asyncMode ? 'json' : 'blob',
        timeout: asyncMode ? 10000 : (group === 'leaf' ? 0 : Math.max(30000, analysisIds.length * 2000))
    }).then(response => {
        if (asyncMode) {
            const data = transformKeys(response.data);
            console.debug('Batch export async task submitted, taskId:', data.taskId);
            return data;
        }
        console.debug('Batch Excel export successful (sync)');
        const filename = downloadBlob(response, 'batch_export.xlsx');
        return { filename };
    }).catch(error => {
        console.error('Failed to batch export Excel:', error.response?.data || error.message);
        throw error;
    });
};

const getTaskStatus = (taskId) => {
    return apiClient.get(`/excel/tasks/${taskId}`)
        .then(response => transformKeys(response.data))
        .catch(error => {
            console.error('Failed to get task status:', error.response?.data || error.message);
            throw error;
        });
};

const downloadTaskResult = (taskId) => {
    return apiClient.get(`/excel/download/${taskId}`, {
        responseType: 'blob',
        timeout: 120000
    }).then(response => {
        const filename = downloadBlob(response, 'export.xlsx');
        return { filename };
    }).catch(error => {
        console.error('Failed to download task result:', error.response?.data || error.message);
        throw error;
    });
};

const pollAndDownloadTask = (taskId, onProgress, interval = 1500) => {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        let lastProgress = -1;
        const maxAttempts = 300;
        let timer = null;
        let stopped = false;

        const finish = (fn, value) => {
            if (stopped) return;
            stopped = true;
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            fn(value);
        };

        const poll = async () => {
            attempts++;
            if (attempts > maxAttempts) {
                finish(reject, new Error(t('导出任务超时')));
                return;
            }
            try {
                const status = await getTaskStatus(taskId);
                if ((status.progress ?? 0) > lastProgress) {
                    attempts = 0;
                    lastProgress = status.progress ?? 0;
                }
                onProgress?.({
                    status: status.status,
                    progress: status.progress ?? 0,
                    total: status.total ?? 0,
                    message: status.message || ''
                });

                if (status.status === 'completed') {
                    try {
                        const result = await downloadTaskResult(taskId);
                        finish(resolve, result);
                    } catch (dlErr) {
                        finish(reject, dlErr);
                    }
                    return;
                }
                if (status.status === 'failed') {
                    finish(reject, new Error(status.error || t('导出任务失败')));
                    return;
                }
                if (!stopped) timer = setTimeout(poll, interval);
            } catch (err) {
                finish(reject, err);
            }
        };

        poll();
    });
};

export const excelService = {
    getExportColumns,
    exportSingleToExcel,
    batchExportToExcel,
    getTaskStatus,
    downloadTaskResult,
    pollAndDownloadTask,
};