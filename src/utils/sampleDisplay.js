import { t } from '@/i18n';

export function stripUuidPrefix(name) {
  return String(name ?? '').replace(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}[_-]/,
    ''
  );
}

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

export function cleanName(name) {
  if (!name) return t('未命名样本');
  return stripTimestamp(stripUuidPrefix(name)).replace(/\.\w+$/, '');
}

export function cardName(name) {
  if (!name) return t('未命名样本');
  return stripUuidPrefix(name).replace(/\.\w+$/, '');
}

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

export function unitToUmFactor(unit) {
  return { μm: 1, mm: 1000, cm: 10000 }[unit] || 1;
}

export function unitSymbolOf(unit) {
  return { μm: 'µm', mm: 'mm', cm: 'cm' }[unit] || unit;
}

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