import { computed } from 'vue';
import { t } from '@/i18n';

/**
 * 批次角标的公共逻辑（茎秆 / 剑叶记录条共用）。
 *
 * 同一个 batchId 下的记录数量大于 1 时显示角标；
 * 点击角标整批勾选/取消勾选。
 *
 * @param {object} options
 * @param {import('vue').Ref<Array>} options.jobs 当前页面的历史记录列表
 * @param {() => string[]} options.getSelectedIds 读取当前勾选
 * @param {(ids: string[]) => void} options.setSelectedIds 写回勾选
 * @param {(job: object) => string} [options.resolveBatchName] 额外的批次名来源
 */
export function useBatchSelection({ jobs, getSelectedIds, setSelectedIds, resolveBatchName }) {
  const batchCountMap = computed(() => {
    const map = {};
    for (const job of jobs.value) {
      if (job.batchId) map[job.batchId] = (map[job.batchId] || 0) + 1;
    }
    return map;
  });

  const batchCountOf = (batchId) => (batchId ? batchCountMap.value[batchId] || 0 : 0);

  const batchNameOf = (job) => {
    if (!job) return '';
    return job.batchName || (resolveBatchName ? resolveBatchName(job) : '') || '';
  };

  const batchChipLabel = (job) =>
    batchNameOf(job) || t('批次 {n} 张', { n: batchCountOf(job.batchId) });

  const batchJobIds = (batchId) =>
    jobs.value.filter(job => job.batchId === batchId).map(job => job.analysisId);

  const isBatchSelected = (job) => {
    const ids = batchJobIds(job.batchId);
    const selected = getSelectedIds();
    return ids.length > 0 && ids.every(id => selected.includes(id));
  };

  function toggleBatchSelection(job) {
    const ids = batchJobIds(job.batchId);
    if (!ids.length) return;
    const selected = getSelectedIds();
    if (isBatchSelected(job)) {
      setSelectedIds(selected.filter(id => !ids.includes(id)));
    } else {
      setSelectedIds(Array.from(new Set([...selected, ...ids])));
    }
  }

  return { batchCountOf, batchNameOf, batchChipLabel, isBatchSelected, toggleBatchSelection };
}
