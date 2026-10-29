import { defineStore } from 'pinia';
import { reactive, ref } from 'vue';
import { analysisService } from '@/services/analysisService';
import { exportService } from '@/services/exportService';
import { buildDataGroups, isArchivableRecord } from '@/utils/dataGroups';
import { t } from '@/i18n';

const GROUPS = ['stem', 'leaf'];

/**
 * 通过 blob 读取后端错误信息：下载接口设置了 responseType='blob'，
 * 后端返回的 { detail } 也会被包在 Blob 里，直接 err.message 只会得到
 * “Request failed with status code 400”，对用户没有帮助。
 */
async function readDownloadError(error) {
  const data = error?.response?.data;
  if (data instanceof Blob) {
    try {
      const text = await data.text();
      const parsed = JSON.parse(text);
      if (parsed?.detail) return String(parsed.detail);
    } catch {
      /* Blob 不是 JSON 时退回通用提示 */
    }
  }
  if (typeof data?.detail === 'string') return data.detail;
  return error?.message || t('下载失败。');
}

export const useDataCenterStore = defineStore('dataCenter', () => {
  /** 原始历史记录（已过滤为至少拥有图片或 JSON 的已完成记录） */
  const records = reactive({ stem: [], leaf: [] });
  const loading = reactive({ stem: false, leaf: false });
  const loaded = reactive({ stem: false, leaf: false });
  const errors = reactive({ stem: null, leaf: null });

  /**
   * 勾选状态按「数据项」记录：图片和 JSON 是两个独立项，
   * key 形如 `{analysisId}:image` / `{analysisId}:json`。
   */
  const selectedKeys = reactive({ stem: [], leaf: [] });
  const downloading = ref(false);
  /** 正在单独下载 JSON 的数据项 key */
  const downloadingJsonKey = ref(null);

  /** 单条 JSON 下载完成后的轻提示，由页面监听并显示 toast */
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

  /** 只勾选某一类数据（image=掩膜图 / json），已有的另一类勾选保持不变 */
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

  /** 收集当前分组下已勾选的数据项（图片 / JSON 各自独立） */
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

  /** 当前分组下已勾选的图片项（表型数据面板 / Excel 导出用） */
  function selectedImageItems(group) {
    return selectedItems(group).filter((item) => item.kind === 'image');
  }

  /**
   * 下载当前数据类型下勾选的数据。
   * 后端只打包被勾选的文件（图片或 JSON），不会自动把同一条记录的另一种文件塞进来。
   */
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

  /** 单独下载一条 JSON 文件（不打包、不勾选） */
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
