<template>
  <!-- 数据中心的文件夹列表 -->
  <div class="data-folder-list">
    <div v-if="loading && !groups.length" class="folder-skeleton" aria-hidden="true">
      <div v-for="index in 3" :key="index" class="skeleton-folder">
        <span class="skeleton-check"></span>
        <span class="skeleton-icon"></span>
        <span class="skeleton-line"></span>
        <span class="skeleton-badge"></span>
      </div>
    </div>

    <div v-else-if="!groups.length" class="data-empty">
      <span class="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H10l2 2h6.5A2.5 2.5 0 0 1 21 10.5v7A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5Z" />
          <path d="M8 13.5h8" />
        </svg>
      </span>
      <h3>{{ emptyTitle }}</h3>
      <p>{{ emptyHint }}</p>
    </div>

    <!-- 单个文件夹卡片 -->
    <article v-for="folder in groups" :key="folder.id" class="data-folder">
      <div class="folder-header">
        <label class="folder-check" :title="t('选择整个文件夹')" @click.stop>
          <input
            type="checkbox"
            :checked="folderSelected(folder)"
            :indeterminate.prop="folderIndeterminate(folder)"
            :aria-label="t('选择文件夹 {name}', { name: folderTitle(folder) })"
            @change="toggleFolder(folder)"
          />
        </label>

        <button
          type="button"
          class="folder-toggle"
          :aria-expanded="isExpanded(folder.id)"
          @click="toggleExpanded(folder.id)"
        >
          <svg
            class="folder-chevron"
            :class="{ open: isExpanded(folder.id) }"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.9"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 6 15 12 9 18" />
          </svg>

          <span class="folder-icon" :class="`is-${folder.type}`">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H10l2 2h6.5A2.5 2.5 0 0 1 21 10.5v7A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5Z" />
            </svg>
          </span>

          <span class="folder-text">
            <span class="folder-name" :title="folder.name || folderTitle(folder)">{{ folderTitle(folder) }}</span>
            <span class="folder-meta">
              <span v-if="folder.type === 'batch'" class="folder-kind">{{ t('批次') }}</span>
              <span v-else class="folder-kind">{{ t('单张') }}</span>
              <span class="meta-sep">·</span>
              <span>{{ t('{n} 张图片', { n: imageCount(folder) }) }}</span>
              <span class="meta-sep">·</span>
              <span>{{ t('{n} 个 JSON', { n: jsonCount(folder) }) }}</span>
              <span class="meta-sep">·</span>
              <span>{{ formatTime(folder.createdAt) }}</span>
            </span>
          </span>

          <span class="folder-count">{{ folder.items.length }}</span>
        </button>
      </div>

      <div v-show="isExpanded(folder.id)" class="folder-body">
        <label
          v-for="item in folder.items"
          :key="item.key"
          class="data-row"
          :class="[`is-${item.kind}`, { selected: isItemSelected(item) }]"
        >
          <input
            class="row-check"
            type="checkbox"
            :checked="isItemSelected(item)"
            :aria-label="t('选择数据 {name}', { name: itemName(item) })"
            @change="emit('toggle-item', item.key)"
          />

          <span class="row-icon" :class="`is-${item.kind}`">
            <svg
              v-if="item.kind === 'image'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="8.5" cy="10" r="1.4" />
              <path d="m3 16 5-4 4 3 3-2 6 5" />
            </svg>
            <svg
              v-else
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="m9 8-4 4 4 4" />
              <path d="m15 8 4 4-4 4" />
              <path d="m13.5 5-3 14" />
            </svg>
          </span>

          <span class="row-main">
            <span class="row-name" :title="itemTitle(item)">{{ itemName(item) }}</span>
            <span class="row-meta">
              <span class="file-chip" :class="item.kind">
                <svg
                  v-if="item.kind === 'image'"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m3 15 5-4 4 3 3-2 6 5" />
                </svg>
                <svg
                  v-else
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="m9 8-4 4 4 4" />
                  <path d="m15 8 4 4-4 4" />
                </svg>
                {{ item.kind === 'image' ? t('掩膜图') : 'JSON' }}
              </span>
              <span class="meta-sep">·</span>
              <span>{{ formatTime(item.createdAt) }}</span>
              <template v-if="modelLabel(item.record?.modelUsed)">
                <span class="meta-sep">·</span>
                <span class="row-model">{{ modelLabel(item.record?.modelUsed) }}</span>
              </template>
            </span>
          </span>

          <span class="row-side">
            <a
              v-if="item.kind === 'image'"
              class="row-action view"
              :href="item.url"
              target="_blank"
              rel="noopener"
              :title="t('查看大图')"
              @click.stop
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M14 4h6v6" />
                <path d="m20 4-9 9" />
                <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
              </svg>
              <span>{{ t('查看大图') }}</span>
            </a>

            <button
              v-else
              type="button"
              class="row-action download"
              :disabled="downloadingJsonKey === item.key"
              :title="t('下载 JSON')"
              @click.stop.prevent="emit('download-json', item)"
            >
              <span v-if="downloadingJsonKey === item.key" class="row-action-spinner" aria-hidden="true"></span>
              <svg
                v-else
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M12 4v11" />
                <path d="m7.5 11 4.5 4.5 4.5-4.5" />
                <path d="M4 19h16" />
              </svg>
              <span>{{ downloadingJsonKey === item.key ? t('下载中…') : t('下载 JSON') }}</span>
            </button>
          </span>
        </label>
      </div>
    </article>
  </div>
</template>

<script setup>
import { reactive, watch } from 'vue';
import { useI18n } from '@/i18n';

const { t } = useI18n();

const props = defineProps({
  groups: {
    type: Array,
    default: () => [],
  },
  selectedKeys: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  emptyTitle: {
    type: String,
    default: '',
  },
  emptyHint: {
    type: String,
    default: '',
  },
  downloadingJsonKey: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['toggle-item', 'toggle-group', 'download-json']);

const expandedIds = reactive(new Set());
const knownIds = new Set();

watch(
  () => props.groups,
  (groups) => {
    const current = new Set(groups.map((folder) => folder.id));
    for (const id of [...expandedIds]) {
      if (!current.has(id)) expandedIds.delete(id);
    }
    for (const id of [...knownIds]) {
      if (!current.has(id)) knownIds.delete(id);
    }
    for (const id of current) {
      if (!knownIds.has(id)) {
        knownIds.add(id);
        expandedIds.add(id);
      }
    }
  },
  { immediate: true }
);

function isExpanded(folderId) {
  return expandedIds.has(folderId);
}

function toggleExpanded(folderId) {
  if (expandedIds.has(folderId)) expandedIds.delete(folderId);
  else expandedIds.add(folderId);
}

function recordCount(folder) {
  return new Set(folder.items.map((item) => item.analysisId)).size;
}

function folderTitle(folder) {
  if (folder.name) return folder.name;
  if (folder.type === 'batch') return t('批次（{n} 条）', { n: recordCount(folder) });
  return t('未命名样本');
}

function imageCount(folder) {
  return folder.items.filter((item) => item.kind === 'image').length;
}

function jsonCount(folder) {
  return folder.items.filter((item) => item.kind === 'json').length;
}

function itemName(item) {
  const sample = item.sampleName || t('未命名样本');
  return item.kind === 'json' ? `${sample}.json` : sample;
}

function itemTitle(item) {
  const filename = item.record?.originalFilename || item.sampleName || '';
  if (!filename) return itemName(item);
  return item.kind === 'json' ? `${filename} · JSON` : filename;
}

function modelLabel(value) {
  if (!value) return '';
  return value === 'default' ? t('默认模型') : value;
}

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isItemSelected(item) {
  return props.selectedKeys.includes(item.key);
}

function folderSelected(folder) {
  return props.selectedKeys.length > 0 && folder.items.every((item) => props.selectedKeys.includes(item.key));
}

function folderIndeterminate(folder) {
  const count = folder.items.filter((item) => props.selectedKeys.includes(item.key)).length;
  return count > 0 && count < folder.items.length;
}

function toggleFolder(folder) {
  emit(
    'toggle-group',
    folder.items.map((item) => item.key)
  );
}
</script>

<style scoped>
.data-folder-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: var(--data-area-max-height, clamp(360px, 60vh, 720px));
  padding-right: 4px;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-gutter: stable;
}

.data-folder {
  flex-shrink: 0;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  animation: fadeInUp 240ms ease backwards;
}

.data-folder:hover {
  border-color: var(--color-border-strong);
}

.folder-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 14px 6px 12px;
  background: var(--color-surface-muted);
}

.folder-check {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  cursor: pointer;
}

.folder-toggle {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 6px 0;
  border: none;
  background: transparent;
  color: inherit;
  text-align: left;
}

.folder-toggle:hover:not(:disabled) {
  background: transparent;
}

.folder-chevron {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  color: var(--color-text-light);
  transition: transform var(--transition-normal), color var(--transition-fast);
}

.folder-chevron.open {
  transform: rotate(90deg);
}

.folder-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-md);
  background: var(--color-primary-green-lightest);
  color: var(--color-primary-green-dark);
}

.folder-icon.is-single {
  background: var(--color-surface-hover);
  color: var(--color-text-muted);
}

.folder-icon svg {
  width: 16px;
  height: 16px;
}

.folder-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  gap: 1px;
}

.folder-name {
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  color: var(--color-text-muted);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
}

.folder-kind {
  color: var(--color-primary-green-dark);
  font-weight: 500;
}

.meta-sep {
  color: var(--color-text-light);
}

.folder-count {
  flex-shrink: 0;
  min-width: 24px;
  padding: 1px 7px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.folder-body {
  border-top: 1px solid var(--color-border-light);
}

.data-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 14px 9px 40px;
  border-bottom: 1px solid var(--color-border-light);
  background: var(--color-surface);
  cursor: pointer;
  transition: background-color var(--transition-fast), box-shadow var(--transition-fast);
}

.data-row:last-child {
  border-bottom: none;
}

.data-row:hover {
  background: var(--color-surface-hover);
}

.data-row.selected {
  background: var(--color-primary-green-bg);
  box-shadow: inset 3px 0 0 var(--color-accent);
}

.row-check {
  flex-shrink: 0;
}

.row-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.row-icon.is-image {
  background: var(--color-primary-green-lightest);
  color: var(--color-primary-green-dark);
}

.row-icon.is-json {
  background: var(--color-info-light);
  color: var(--color-info);
}

.row-icon svg {
  width: 18px;
  height: 18px;
}

.row-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  gap: 3px;
}

.row-name {
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  color: var(--color-text-muted);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
}

.file-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 10.5px;
  font-weight: 500;
  line-height: 1.5;
}

.file-chip svg {
  width: 11px;
  height: 11px;
  color: var(--color-primary-green-dark);
}

.file-chip.json {
  color: var(--color-info);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.02em;
}

.file-chip.json svg {
  color: var(--color-info);
}

.row-model {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-side {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.row-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 9px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  font-size: 11.5px;
  font-weight: 500;
  text-decoration: none;
  transition: background-color var(--transition-fast), border-color var(--transition-fast),
    color var(--transition-fast);
}

.row-action svg {
  width: 13px;
  height: 13px;
}

.row-action.view:hover {
  border-color: rgba(22, 163, 74, 0.2);
  background: var(--color-primary-green-lightest);
  color: var(--color-primary-green-dark);
  text-decoration: none;
}

.row-action.download {
  border-color: var(--color-border);
  background: var(--color-surface);
  color: var(--color-info);
}

.row-action.download:hover:not(:disabled) {
  border-color: rgba(37, 99, 235, 0.25);
  background: var(--color-info-light);
  color: var(--color-info);
}

.row-action:disabled {
  opacity: 0.55;
  cursor: default;
}

.row-action-spinner {
  width: 12px;
  height: 12px;
  border: 1.5px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.data-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  padding: 48px 24px;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  text-align: center;
}

.empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  margin-bottom: 14px;
  border-radius: var(--radius-lg);
  background: var(--color-primary-green-lightest);
  color: var(--color-primary-green-dark);
}

.empty-icon svg {
  width: 24px;
  height: 24px;
}

.data-empty h3 {
  margin: 0 0 6px;
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 600;
}

.data-empty p {
  max-width: 380px;
  margin: 0;
  color: var(--color-text-muted);
  font-size: 12.5px;
  line-height: 1.7;
}

.folder-skeleton {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.skeleton-folder {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 62px;
  padding: 0 16px;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
}

.skeleton-check,
.skeleton-icon,
.skeleton-line,
.skeleton-badge {
  display: block;
  border-radius: var(--radius-sm);
  background: var(--color-surface-hover);
  animation: pulse 1.4s ease-in-out infinite;
}

.skeleton-check {
  width: 15px;
  height: 15px;
}

.skeleton-icon {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-md);
}

.skeleton-line {
  flex: 1;
  height: 12px;
}

.skeleton-badge {
  width: 28px;
  height: 18px;
  border-radius: var(--radius-full);
}

@media (max-width: 720px) {
  .data-row {
    padding-left: 16px;
  }

  .row-action {
    padding: 0 6px;
  }

  .row-icon {
    width: 34px;
    height: 34px;
  }

  .row-model {
    display: none;
  }
}
</style>
