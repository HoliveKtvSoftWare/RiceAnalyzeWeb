const UUID_PREFIX_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}[_-]/;

export function stripUuidPrefix(name) {
  return String(name || '').replace(UUID_PREFIX_RE, '');
}

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

export function cleanSampleName(filename) {
  if (!filename) return '';
  return stripTimestamp(stripUuidPrefix(filename)).replace(/\.\w+$/, '').trim();
}

export function imageUrlOf(record) {
  if (!record) return '';
  return record.annotatedImageUrl || record.originalPreviewUrl || record.originalImageUrl || '';
}

export function isArchivableRecord(record) {
  if (!record || !record.analysisId) return false;
  return Boolean(record.status === 'completed' && (record.resultJsonUrl || imageUrlOf(record)));
}

function recordTime(record) {
  const time = Date.parse(record?.createdAt || '');
  return Number.isNaN(time) ? 0 : time;
}

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