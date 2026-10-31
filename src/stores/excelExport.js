import { defineStore } from 'pinia';
import { t } from '@/i18n';
import { ref } from 'vue';
import { excelService } from '@/services/excelService';

const ASYNC_THRESHOLD = 1;

export const useExcelExportStore = defineStore('excelExport', () => {
    const isLoading = ref(false);
    const error = ref(null);

    const taskProgress = ref(0);
    const taskTotal = ref(0);
    const taskMessage = ref('');

    function setError(message) {
        error.value = message;
    }

    function resetProgress() {
        taskProgress.value = 0;
        taskTotal.value = 0;
        taskMessage.value = '';
    }

    function onProgressUpdate({ progress, total, message }) {
        taskProgress.value = progress ?? 0;
        if (total && total > 0) {
            taskTotal.value = total;
        }
        taskMessage.value = message || '';
    }

    async function downloadSingleExcelAction(analysisId, originalFilename, selectedColumns, unit, group = 'stem') {
        isLoading.value = true;
        setError(null);
        resetProgress();
        taskTotal.value = 1;
        taskMessage.value = t('正在生成 Excel...');
        try {
            const result = await excelService.exportSingleToExcel(analysisId, originalFilename, selectedColumns, unit, group);
            taskProgress.value = 1;
            console.log(`Single Excel downloaded: ${result.filename}`);
            return true;
        } catch (err) {
            console.error('Download single Excel failed:', err);
            const detail = err.response?.data?.detail || err.message || t('下载Excel报告失败。');
            setError(detail);
            return false;
        } finally {
            isLoading.value = false;
        }
    }

    async function downloadBatchExcelAction(analysisIds, selectedColumns, unit, group = 'stem') {
        isLoading.value = true;
        setError(null);
        resetProgress();
        taskTotal.value = analysisIds.length;

        const useAsync = analysisIds.length > ASYNC_THRESHOLD;
        if (useAsync) {
            taskProgress.value = 0;
            taskMessage.value = t('正在提交导出任务...');
        } else {
            taskProgress.value = 0;
            taskMessage.value = t('正在生成 Excel...');
        }

        try {
            if (useAsync) {
                const { taskId } = await excelService.batchExportToExcel(
                    analysisIds, selectedColumns, unit, true, group
                );
                taskMessage.value = t('导出任务已提交，处理中...');
                await excelService.pollAndDownloadTask(taskId, onProgressUpdate, 1500);
            } else {
                await excelService.batchExportToExcel(
                    analysisIds, selectedColumns, unit, false, group
                );
            }
            taskProgress.value = analysisIds.length;
            console.log(`Batch Excel downloaded (${analysisIds.length} items)`);
            return true;
        } catch (err) {
            console.error('Download batch Excel failed:', err);
            const detail = err.response?.data?.detail || err.message || t('批量下载Excel报告失败。');
            setError(detail);
            return false;
        } finally {
            isLoading.value = false;
            resetProgress();
        }
    }

    return {
        isLoading,
        error,
        taskProgress,
        taskTotal,
        taskMessage,
        setError,
        downloadSingleExcelAction,
        downloadBatchExcelAction,
    };
});