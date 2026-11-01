import { defineStore } from 'pinia';
import { reactive, ref } from 'vue';
import { analysisService } from '@/services/analysisService';
import { exportService } from '@/services/exportService';
import { buildDataGroups, isArchivableRecord } from '@/utils/dataGroups';
import { t } from '@/i18n';

const GROUPS = ['stem', 'leaf'];

async function readDownloadError(error) {
  const data = error?.response?.data;
  if (data instanceof Blob) {
    try {
      const text = await data.text();
      const parsed = JSON.parse(text);
      if (parsed?.detail) return String(parsed.detail);
    } catch {
    }
  }
  if (typeof data?.detail === 'string') return data.detail;
  return error?.message || t('下载失败。');
}

export const useDataCenterStore = defineStore('dataCenter', () => {
  const records = reactive({ stem: [], leaf: [] });
  const loading = reactive({ stem: false, leaf: false });
  const loaded = reactive({ stem: false, leaf: false });
  const errors = reactive({ stem: null, leaf: null });

  const selectedKeys = reactive({ stem: [], leaf: [] });
  const downloading = ref(false);
  const downloadingJsonKey = ref(null);

  const notice = ref(null);
  let noticeId = 0;

  function pushNotice(message, type = 'success') {
    notice.value = { id: ++noticeId, message, type };
  }

  function clearNotice() {
    notice.value = null;
  }

  function isGroup(group) {
    return GROUPS.includes(group);
  }

  function groupsFor(group) {
    return buildDataGroups(records[group] || []);
  }

  function selectedCount(group) {
    return selectedKeys[group]?.length || 0;
  }

  function isSelected(group, itemKey) {
    return Boolean(selectedKeys[group]?.includes(itemKey));
  }

  function isFolderSelected(group, folder) {
    const keys = selectedKeys[group] || [];
    return folder.items.length > 0 && folder.items.every((item) => keys.includes(item.key));
  }

  function isFolderIndeterminate(group, folder) {
    const keys = selectedKeys[group] || [];
    const count = folder.items.filter((item) => keys.includes(item.key)).length;
    return count > 0 && count < folder.items.length;
  }

  function pruneSelection(group) {
    const valid = new Set(
      groupsFor(group).flatMap((folder) => folder.items.map((item) => item.key))
    );
    selectedKeys[group] = selectedKeys[group].filter((key) => valid.has(key));
  }

  async function fetchGroup(group, force = false) {
    if (!isGroup(group) || loading[group]) return records[group];
    if (loaded[group] && !force) return records[group];

    loading[group] = true;
    errors[group] = null;
    try {
      const list = await analysisService.getHistory(group);
      records[group] = Array.isArray(list) ? list.filter(isArchivableRecord) : [];
      pruneSelection(group);
      loaded[group] = true;
      return records[group];
    } catch (error) {
      errors[group] = error?.response?.data?.detail || error?.message || t('无法加载数据。');
      records[group] = [];
      selectedKeys[group] = [];
      return [];
    } finally {
      loading[group] = false;
    }
  }

  function toggleItem(group, itemKey) {
    if (!isGroup(group) || !itemKey) return;
    const index = selectedKeys[group].indexOf(itemKey);
    if (index >= 0) selectedKeys[group].splice(index, 1);
    else selectedKeys[group].push(itemKey);
  }

  function toggleGroup(group, itemKeys) {
    if (!isGroup(group)) return;
    const keys = Array.isArray(itemKeys) ? itemKeys : [];
    if (!keys.length) return;
    const selected = new Set(selectedKeys[group]);
    const allSelected = keys.every((key) => selected.has(key));
    if (allSelected) {
      selectedKeys[group] = selectedKeys[group].filter((key) => !keys.includes(key));
    } else {
      selectedKeys[group] = Array.from(new Set([...selectedKeys[group], ...keys]));
    }
  }

  function selectAll(group) {
    if (!isGroup(group)) return;
    selectedKeys[group] = groupsFor(group).flatMap((folder) =>
      folder.items.map((item) => item.key)
    );
  }

  function selectKind(group, kind) {
    if (!isGroup(group) || (kind !== 'image' && kind !== 'json')) return;
    const keys = groupsFor(group).flatMap((folder) =>
      folder.items.filter((item) => item.kind === kind).map((item) => item.key)
    );
    selectedKeys[group] = Array.from(new Set([...selectedKeys[group], ...keys]));
  }

  function selectImages(group) {
    selectKind(group, 'image');
  }

  function selectJson(group) {
    selectKind(group, 'json');
  }

  function clearSelection(group) {
    if (!isGroup(group)) return;
    selectedKeys[group] = [];
  }

  function clearError(group) {
    if (isGroup(group)) errors[group] = null;
  }

  function selectedItems(group) {
    const selected = new Set(selectedKeys[group] || []);
    const items = [];
    for (const folder of groupsFor(group)) {
      for (const item of folder.items) {
        if (selected.has(item.key)) items.push(item);
      }
    }
    return items;
  }

  function selectedImageItems(group) {
    return selectedItems(group).filter((item) => item.kind === 'image');
  }

  async function downloadSelected(group) {
    if (!isGroup(group) || downloading.value) return null;
    const items = selectedItems(group);
    if (!items.length) {
      errors[group] = t('请先勾选要下载的数据。');
      return null;
    }

    downloading.value = true;
    errors[group] = null;
    try {
      const payload = items.map((item) => ({
        analysisId: item.analysisId,
        kind: item.kind,
      }));
      const result = await exportService.downloadPackages(payload, group);
      const exported = new Set(items.map((item) => item.key));
      selectedKeys[group] = selectedKeys[group].filter((key) => !exported.has(key));
      return result;
    } catch (error) {
      errors[group] = await readDownloadError(error);
      return null;
    } finally {
      downloading.value = false;
    }
  }

  async function downloadJson(group, item) {
    if (!isGroup(group) || !item || item.kind !== 'json') return false;
    if (downloadingJsonKey.value) return false;

    downloadingJsonKey.value = item.key;
    errors[group] = null;
    try {
      const result = await exportService.exportSingleJson(
        item.analysisId,
        item.sampleName || 'export'
      );
      pushNotice(t('已开始下载 {name}', { name: result.filename }), 'success');
      return true;
    } catch (error) {
      errors[group] = await readDownloadError(error);
      return false;
    } finally {
      downloadingJsonKey.value = null;
    }
  }

  return {
    records,
    loading,
    loaded,
    errors,
    selectedKeys,
    downloading,
    downloadingJsonKey,
    notice,
    groupsFor,
    selectedCount,
    isSelected,
    isFolderSelected,
    isFolderIndeterminate,
    fetchGroup,
    toggleItem,
    toggleGroup,
    selectAll,
    selectImages,
    selectJson,
    clearSelection,
    clearError,
    selectedItems,
    selectedImageItems,
    downloadSelected,
    downloadJson,
    clearNotice,
  };
});