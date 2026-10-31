import { t } from '@/i18n';

/**
 * 样本文件名 / 展示文本的公共处理。
 *
 * 上传时后端会在文件名前加 uuid，末尾加时间戳；
 * 界面上不同位置需要保留的粒度不同，这里集中处理，避免两个分析页各写一套。
 */

/** 去掉上传时加的 uuid 前缀（兼容 - 与 _ 分隔） */
export function stripUuidPrefix(name) {
  return String(name ?? '').replace(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}[_-]/,
    ''
  );
}

/** 去掉上传时追加的时间戳后缀，保留扩展名 */
export function stripTimestamp(filename) {
  if (!filename) return '';
  const dotIdx = filename.lastIndexOf('.');
  const ext = dotIdx > 0 ? filename.slice(dotIdx) : '';
  let base = dotIdx > 0 ? filename.slice(0, dotIdx) : filename;
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

/** 标题用的名字：uuid、扩展名、时间戳都去掉 */
export function cleanName(name) {
  if (!name) return t('未命名样本');
  return stripTimestamp(stripUuidPrefix(name)).replace(/\.\w+$/, '');
}

/** 记录卡片用的名字：保留上传时间戳（去掉扩展名），方便区分同名文件 */
export function cardName(name) {
  if (!name) return t('未命名样本');
  return stripUuidPrefix(name).replace(/\.\w+$/, '');
}

// 中文原文作为 key，t() 在读取时调用，切换语言才能即时生效
const STATUS_TEXT = {
  processing: '处理中',
  completed: '已完成',
  failed: '失败',
  queued: '排队中',
  pending: '待处理',
  uploading: '处理中',
};

export function statusLabel(status) {
  return t(STATUS_TEXT[status] || status || '未知');
}

/** 翻译 modelUsed 字段（三种值：实际名 / "default" / null） */
export function displayModelUsed(val) {
  if (!val) return null;
  if (val === 'default') return t('默认模型');
  return val;
}

export function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const number = Number(value);
  if (Math.abs(number) >= 1000) return number.toFixed(1);
  return number.toFixed(2);
}

export function formatScale(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const number = Number(value);
  if (Math.abs(number) >= 1) return Number(number.toFixed(4)).toString();
  return Number(number.toPrecision(4)).toString();
}

/** μm 到当前单位的换算系数（长度） */
export function unitToUmFactor(unit) {
  return { μm: 1, mm: 1000, cm: 10000 }[unit] || 1;
}

/** 显示用的单位符号（μm → µm） */
export function unitSymbolOf(unit) {
  return { μm: 'µm', mm: 'mm', cm: 'cm' }[unit] || unit;
}

/**
 * 后端指标里的比例尺换算到当前单位。
 * scaleUmPerPx 恒为 µm/px，优先用它换算；旧接口没有时退回 scalePerPx。
 */
export function scalePerPxOf(metrics, unit) {
  if (!metrics) return null;
  if (metrics.scaleUmPerPx !== null && metrics.scaleUmPerPx !== undefined) {
    return Number(metrics.scaleUmPerPx) / unitToUmFactor(unit);
  }
  if (metrics.scalePerPx !== null && metrics.scalePerPx !== undefined) {
    return Number(metrics.scalePerPx);
  }
  return null;
}
