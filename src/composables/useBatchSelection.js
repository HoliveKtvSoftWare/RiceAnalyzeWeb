import { computed } from 'vue';
import { t } from '@/i18n';

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