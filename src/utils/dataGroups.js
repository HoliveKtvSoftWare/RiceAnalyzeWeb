/**
 * 数据中心的纯函数工具：
 * - 把一条分析记录拆成「图片」和「JSON」两个独立的数据项；
 * - 把同批次记录收进一个文件夹，单张上传记录则用样本名作为文件夹名。
 *
 * 这里不依赖 Vue / i18n，方便单独复用和测试。
 */

const UUID_PREFIX_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}[_-]/;

/** 去掉上传时后端加的 uuid 前缀（历史接口一般已经去掉，这里做兜底） */
export function stripUuidPrefix(name) {
  return String(name || '').replace(UUID_PREFIX_RE, '');
}

/** 去掉文件名末尾由后端拼接的上传时间戳 */
export function stripTimestamp(filename) {
  if (!filename) return '';
  const dotIndex = filename.lastIndexOf('.');
  const ext = dotIndex > 0 ? filename.slice(dotIndex) : '';
  let base = dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
  base = base
    .replace(/_\d{14}$/, '')
    .replace(/_\d{8}_\d{6}$/, '')
    .replace(/_\d{13}$/, '')
    .replace(/_\d{10}$/, '')
    .replace(/\s*-\s*\d{14}$/, '')
    .replace(/\s*-\s*\d{8}_\d{6}$/, '')
    .replace(/\s*-\s*\d{13}$/, '')
    .replace(/\s*-\s*\d{10}$/, '');
  return base + ext;
}

/** 样本名：去掉 uuid、扩展名与上传时间戳，例如 `2-3_20261028_094355.tif` -> `2-3` */
export function cleanSampleName(filename) {
  if (!filename) return '';
  return stripTimestamp(stripUuidPrefix(filename)).replace(/\.\w+$/, '').trim();
}

/**
 * 图片数据用于展示 / 查看大图的 URL。
 *
 * 数据中心展示的是带掩膜的分割图（annotatedImageUrl）；
 * 旧记录没有标注图时，才退回原图预览 / 原图。
 */
export function imageUrlOf(record) {
  if (!record) return '';
  return record.annotatedImageUrl || record.originalPreviewUrl || record.originalImageUrl || '';
}

/** 记录是否至少拥有图片或 JSON 之一，可以进入数据中心 */
export function isArchivableRecord(record) {
  if (!record || !record.analysisId) return false;
  return Boolean(record.status === 'completed' && (record.resultJsonUrl || imageUrlOf(record)));
}

function recordTime(record) {
  const time = Date.parse(record?.createdAt || '');
  return Number.isNaN(time) ? 0 : time;
}

/**
 * 一条记录拆成独立的数据项：先图片，后 JSON。
 * 每一项都有自己的 key / checkbox，可以单独勾选、下载。
 */
function buildFileItems(record) {
  const analysisId = record.analysisId;
  const sampleName = cleanSampleName(record.originalFilename);
  const items = [];

  const imageUrl = imageUrlOf(record);
  if (imageUrl) {
    items.push({
      key: `${analysisId}:image`,
      analysisId,
      kind: 'image',
      sampleName,
      url: imageUrl,
      createdAt: record.createdAt,
      record,
    });
  }

  if (record.resultJsonUrl) {
    items.push({
      key: `${analysisId}:json`,
      analysisId,
      kind: 'json',
      sampleName,
      url: record.resultJsonUrl,
      createdAt: record.createdAt,
      record,
    });
  }

  return items;
}

function singleFolder(record) {
  return {
    id: `single:${record.analysisId}`,
    type: 'single',
    name: cleanSampleName(record.originalFilename),
    batchId: record.batchId || null,
    items: buildFileItems(record),
    createdAt: record.createdAt,
    timestamp: recordTime(record),
  };
}

/**
 * 把归档记录整理成文件夹列表。
 *
 * 规则：
 * - 同批次且有多条记录 -> 一个批次文件夹，名称为批次名（缺失时由组件回退显示）；
 * - 单张上传 / 批次只剩一条记录 -> 文件夹名称就是图片的样本名。
 *
 * @param {Array<object>} records 历史记录
 * @returns {Array<{id: string, type: 'batch'|'single', name: string, items: Array<object>, createdAt: string, timestamp: number}>}
 */
export function buildDataGroups(records) {
  const list = Array.isArray(records) ? records.filter(isArchivableRecord) : [];
  const sorted = [...list].sort((a, b) => recordTime(b) - recordTime(a));

  const batchMap = new Map();
  const groups = [];

  for (const record of sorted) {
    if (!record.batchId) {
      groups.push(singleFolder(record));
      continue;
    }
    if (!batchMap.has(record.batchId)) batchMap.set(record.batchId, []);
    batchMap.get(record.batchId).push(record);
  }

  for (const [batchId, recordsInBatch] of batchMap) {
    if (recordsInBatch.length <= 1) {
      groups.push(singleFolder(recordsInBatch[0]));
      continue;
    }

    const ordered = [...recordsInBatch].sort((a, b) => {
      const left = Number.isFinite(a.batchIndex) ? a.batchIndex : Number.MAX_SAFE_INTEGER;
      const right = Number.isFinite(b.batchIndex) ? b.batchIndex : Number.MAX_SAFE_INTEGER;
      if (left !== right) return left - right;
      return recordTime(a) - recordTime(b);
    });
    const latest = ordered.reduce(
      (current, item) => (recordTime(item) > recordTime(current) ? item : current),
      ordered[0]
    );

    groups.push({
      id: `batch:${batchId}`,
      type: 'batch',
      name: ordered.find((item) => item.batchName)?.batchName || '',
      batchId,
      items: ordered.flatMap(buildFileItems),
      createdAt: latest.createdAt,
      timestamp: recordTime(latest),
    });
  }

  return groups.sort((a, b) => b.timestamp - a.timestamp);
}
