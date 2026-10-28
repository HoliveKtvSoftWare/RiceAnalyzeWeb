<template>
  <div class="user-center-view">
    <header class="view-header">
      <h1>{{ t('用户中心') }}</h1>
      <p class="view-subtitle">{{ t('管理账户信息、分析额度与安全设置') }}</p>
    </header>

    <div class="panel-grid">
      <!-- 个人信息 -->
      <section class="panel">
        <div class="panel-header">
          <h3>{{ t('个人信息') }}</h3>
          <button class="secondary small" @click="refreshUserInfo" :disabled="isLoading">
            {{ isLoading ? t('刷新中…') : t('刷新') }}
          </button>
        </div>
        <div v-if="authStore.user" class="info-list">
          <div class="info-row">
            <span class="label">{{ t('用户 ID') }}</span>
            <span class="value mono">{{ authStore.user.id || 'N/A' }}</span>
          </div>
          <div class="info-row">
            <span class="label">{{ t('邮箱') }}</span>
            <span class="value">{{ authStore.user.email || 'N/A' }}</span>
          </div>
        </div>
        <p v-else class="muted-text">{{ t('正在加载用户信息…') }}</p>
      </section>

      <!-- 额度 -->
      <section class="panel">
        <div class="panel-header">
          <h3>{{ t('分析额度') }}</h3>
        </div>
        <div class="quota">
          <div class="quota-headline">
            <span class="quota-value">{{ authStore.userQuota || 0 }}</span>
            <span class="quota-unit">{{ t('次可用') }}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: quotaPercentage + '%' }"></div>
          </div>
          <p class="progress-text">{{ t('{n}% 已使用', { n: quotaPercentage }) }}</p>
        </div>
        <div class="panel-actions">
          <button class="primary" @click="showPurchaseModal = true">{{ t('购买额度') }}</button>
          <button class="secondary" @click="showUsageHistory = true">{{ t('使用记录') }}</button>
        </div>
      </section>

      <!-- 账户设置 -->
      <section class="panel">
        <div class="panel-header">
          <h3>{{ t('账户设置') }}</h3>
        </div>
        <div class="setting-row">
          <label for="language">{{ t('界面语言') }}</label>
          <select id="language" v-model="settings.language" class="select-inline">
            <option v-for="item in SUPPORTED_LOCALES" :key="item.value" :value="item.value">
              {{ item.label }}
            </option>
          </select>
        </div>
        <div class="panel-actions">
          <button class="primary" @click="saveSettings" :disabled="!settingsChanged">{{ t('保存设置') }}</button>
          <button class="secondary" @click="resetSettings">{{ t('重置') }}</button>
        </div>
      </section>

      <!-- 安全 -->
      <section class="panel">
        <div class="panel-header">
          <h3>{{ t('安全') }}</h3>
        </div>
        <p class="muted-text">{{ t('退出当前登录，或永久删除账户及其全部数据。') }}</p>
        <div class="panel-actions">
          <button class="secondary" @click="handleLogout">{{ t('退出登录') }}</button>
          <button class="danger-ghost" @click="showDeleteModal = true">{{ t('删除账户') }}</button>
        </div>
      </section>
    </div>

    <!-- 购买额度 -->
    <div v-if="showPurchaseModal" class="modal-overlay" @click="showPurchaseModal = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>{{ t('购买额度') }}</h3>
          <button class="icon-button" type="button" :aria-label="t('关闭')" @click="showPurchaseModal = false">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div class="purchase-options">
          <button
            v-for="option in purchaseOptions"
            :key="option.id"
            type="button"
            class="purchase-option"
            :class="{ selected: selectedOption === option.id }"
            @click="selectedOption = option.id"
          >
            <span class="option-amount">{{ t('{n} 次', { n: option.amount }) }}</span>
            <span class="option-price">¥{{ option.price }}</span>
          </button>
        </div>
        <div class="modal-actions">
          <button class="secondary" @click="showPurchaseModal = false">{{ t('取消') }}</button>
          <button class="primary" @click="handlePurchase" :disabled="!selectedOption">{{ t('确认购买') }}</button>
        </div>
      </div>
    </div>

    <!-- 删除账户 -->
    <div v-if="showDeleteModal" class="modal-overlay" @click="showDeleteModal = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>{{ t('删除账户') }}</h3>
          <button class="icon-button" type="button" :aria-label="t('关闭')" @click="showDeleteModal = false">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <p class="modal-text">{{ t('此操作将永久删除您的账户和全部相关数据，且无法恢复。') }}</p>
        <label class="confirm-check">
          <input type="checkbox" v-model="deleteConfirmed" />
          {{ t('我确认要删除我的账户') }}
        </label>
        <div class="modal-actions">
          <button class="secondary" @click="showDeleteModal = false">{{ t('取消') }}</button>
          <button class="danger" @click="handleDeleteAccount" :disabled="!deleteConfirmed">{{ t('确认删除') }}</button>
        </div>
      </div>
    </div>

    <!-- 使用记录 -->
    <div v-if="showUsageHistory" class="modal-overlay" @click="showUsageHistory = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>{{ t('最近使用记录') }}</h3>
          <button class="icon-button" type="button" :aria-label="t('关闭')" @click="showUsageHistory = false">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div v-if="usageHistory.length > 0" class="history-list">
          <div v-for="record in usageHistory" :key="record.id" class="history-item">
            <span class="record-date">{{ formatDate(record.date) }}</span>
            <span class="record-action">{{ t(record.action) }}</span>
            <span class="record-cost">-{{ record.cost }}</span>
          </div>
        </div>
        <p v-else class="muted-text">{{ t('暂无使用记录') }}</p>
      </div>
    </div>
  </div>
</template>


<script setup>
import { useI18n } from '@/i18n';

const { t, locale, setLocale } = useI18n();
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { SUPPORTED_LOCALES } from '@/i18n';

const authStore = useAuthStore();
const router = useRouter();

// 响应式状态
const isLoading = ref(false);
const showPurchaseModal = ref(false);
const showDeleteModal = ref(false);
const showUsageHistory = ref(false);
const selectedOption = ref(null);
const deleteConfirmed = ref(false);

// 用户设置：语言以 i18n 当前语言为准，切换即时生效
const settings = ref({
  emailNotifications: true,
  autoSave: true,
  language: locale.value
});

// 默认设置（用于重置）
let defaultSettings = { ...settings.value };

// 下拉框改动即时应用（不必先点“保存设置”）
watch(() => settings.value.language, (next) => {
  if (next !== locale.value) setLocale(next);
});

// 外部（或刷新后）语言变化时，让下拉开态保持一致
watch(locale, (next) => {
  if (settings.value.language !== next) settings.value.language = next;
});

// 购买选项
const purchaseOptions = ref([
  { id: 1, amount: 10, price: 9.9 },
  { id: 2, amount: 50, price: 39.9 },
  { id: 3, amount: 100, price: 69.9 },
  { id: 4, amount: 200, price: 119.9 }
]);

// 使用记录（模拟数据）
const usageHistory = ref([
  { id: 1, date: new Date(Date.now() - 86400000), action: '图像分割', cost: 1 },
  { id: 2, date: new Date(Date.now() - 172800000), action: '图像分割', cost: 1 },
  { id: 3, date: new Date(Date.now() - 259200000), action: '图像分割', cost: 1 }
]);

// 计算属性
const quotaPercentage = computed(() => {
  const quota = authStore.userQuota || 0;
  const used = usageHistory.value.reduce((sum, record) => sum + record.cost, 0);
  return Math.min(Math.round((used / (quota + used)) * 100), 100);
});

const settingsChanged = computed(() => {
  return JSON.stringify(settings.value) !== JSON.stringify(defaultSettings);
});

// 生命周期
onMounted(() => {
  // 确保用户信息是最新的
  if (authStore.isAuthenticated && !authStore.user) {
    authStore.fetchUser();
  }
});

// 方法
const refreshUserInfo = async () => {
  isLoading.value = true;
  try {
    await authStore.fetchUser();
  } catch (error) {
    console.error('刷新用户信息失败:', error);
  } finally {
    isLoading.value = false;
  }
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleString('zh-CN');
  } catch {
    return 'N/A';
  }
};

const saveSettings = () => {
  // 语言已即时生效；这里只把当前选择记为“默认值”，供重置使用
  setLocale(settings.value.language);
  defaultSettings = { ...settings.value };
};

const resetSettings = () => {
  settings.value = { ...defaultSettings };
  setLocale(settings.value.language);
};

const handlePurchase = () => {
  // 这里应该调用购买API
  console.log('购买选项:', selectedOption.value);
  showPurchaseModal.value = false;
  selectedOption.value = null;
};

const handleLogout = async () => {
  await authStore.logoutAction();
  router.push('/login');
};

const handleDeleteAccount = () => {
  // 这里应该调用删除账户API
  console.log('删除账户确认');
  showDeleteModal.value = false;
  deleteConfirmed.value = false;
  // 模拟删除后登出
  handleLogout();
};

// 监听设置变化
watch(settings, (newSettings) => {
  console.log('设置已更改:', newSettings);
}, { deep: true });
</script>

<style scoped>
.user-center-view {
  max-width: 960px;
  margin: 0 auto;
  padding: 4px 0 24px;
  /* 页面切换动效：与首页、剑叶页一致，淡入 + 轻微上移。
     用 backwards 而不是 both：动画结束后不保留 transform，
     避免影响页面内 position: fixed 的弹窗定位。 */
  animation: fadeInUp 220ms ease backwards;
}

.view-header {
  margin-bottom: 20px;
  animation: fadeInUp 240ms ease backwards;
}

.view-header h1 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.view-subtitle {
  margin: 4px 0 0;
  color: var(--color-text-muted);
  font-size: 12.5px;
}

.panel-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  align-items: stretch;
}

.panel {
  display: flex;
  flex-direction: column;
  padding: 18px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  /* 四张面板依次入场，和首页功能卡片、剑叶指标卡保持同一节奏 */
  animation: fadeInUp 260ms ease backwards;
}

.panel:nth-child(1) {
  animation-delay: 20ms;
}

.panel:nth-child(2) {
  animation-delay: 50ms;
}

.panel:nth-child(3) {
  animation-delay: 80ms;
}

.panel:nth-child(4) {
  animation-delay: 110ms;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
}

.panel-header h3 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: 600;
}

.small {
  height: 26px;
  padding: 0 10px;
  font-size: 11.5px;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: 7px 0;
  border-bottom: 1px solid var(--color-border-light);
  font-size: 12.5px;
}

.info-row:last-child {
  border-bottom: none;
}

.info-row .label {
  flex-shrink: 0;
  color: var(--color-text-muted);
}

.info-row .value {
  overflow: hidden;
  color: var(--color-text-secondary);
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mono {
  font-family: var(--font-mono);
  font-size: 11.5px;
}

.quota {
  margin-bottom: 16px;
}

.quota-headline {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 10px;
}

.quota-value {
  color: var(--color-text-primary);
  font-size: 26px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.quota-unit {
  color: var(--color-text-muted);
  font-size: 12px;
}

.progress-bar {
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--color-surface-hover);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: var(--radius-full);
  background: var(--color-accent);
  transition: width var(--transition-slow);
}

.progress-text {
  margin: 8px 0 0;
  color: var(--color-text-light);
  font-size: 11.5px;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 2px 0 4px;
}

.setting-row label {
  color: var(--color-text-secondary);
  font-size: 12.5px;
}

.select-inline {
  width: auto;
  min-width: 128px;
  /* 不要写死 height：基础样式有 9px 上下内边距，32px 高度会把文字行压扁导致下半截被裁掉。
     用内边距决定高度，行高保持 1.5，视觉高度仍是 32px 左右。 */
  height: auto;
  padding: 6px 32px 6px 12px;
  font-size: 12.5px;
  line-height: 1.5;
}

.panel-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: auto;
  padding-top: 12px;
}

.muted-text {
  margin: 0 0 14px;
  color: var(--color-text-muted);
  font-size: 12.5px;
  line-height: 1.7;
}

.danger-ghost {
  border-color: var(--color-border);
  background: var(--color-surface);
  color: var(--color-error);
}

.danger-ghost:hover:not(:disabled) {
  border-color: rgba(220, 38, 38, 0.35);
  background: var(--color-error-light);
  color: var(--color-error);
}

/* ==================== 弹窗 ==================== */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(24, 24, 27, 0.36);
  animation: fadeIn var(--transition-fast) both;
}

.modal {
  width: 100%;
  max-width: 420px;
  padding: 18px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  box-shadow: var(--shadow-xl);
  animation: fadeInScale var(--transition-normal) both;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.modal-header h3 {
  margin: 0;
  font-size: 13.5px;
  font-weight: 600;
}

.icon-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
}

.icon-button:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}

.icon-button svg {
  width: 15px;
  height: 15px;
}

.modal-text {
  margin: 0 0 14px;
  color: var(--color-text-secondary);
  font-size: 12.5px;
  line-height: 1.7;
}

.purchase-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 16px;
}

.purchase-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  text-align: left;
}

.purchase-option:hover {
  border-color: var(--color-border-strong);
}

.purchase-option.selected {
  border-color: var(--color-accent);
  background: var(--color-primary-green-bg);
}

.option-amount {
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: 600;
}

.option-price {
  color: var(--color-text-muted);
  font-size: 12px;
}

.confirm-check {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  color: var(--color-text-secondary);
  font-size: 12.5px;
  cursor: pointer;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.history-list {
  display: flex;
  flex-direction: column;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border-light);
  font-size: 12.5px;
}

.history-item:last-child {
  border-bottom: none;
}

.record-date {
  flex: 1;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.record-action {
  color: var(--color-text-secondary);
}

.record-cost {
  color: var(--color-error);
  font-variant-numeric: tabular-nums;
}

@media (max-width: 760px) {
  .panel-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
