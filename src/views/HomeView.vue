<template>
  <div class="home-view">
    <section class="hero">
      <div class="hero-main">
        <p class="eyebrow">{{ t('水稻微表型 · 结构分割') }}</p>
        <h1 class="hero-title">
          {{ t('用深度学习量化') }}<br />
          {{ t('茎秆与剑叶的微观结构') }}
        </h1>
        <p class="hero-desc">
          {{ t('上传显微图像，自动分割茎秆、维管束与空腔，输出 15 项表型指标，并支持 Excel / JSON 一键导出。') }}
        </p>
        <div class="hero-actions">
          <router-link to="/stem" class="btn primary">{{ t('开始分析') }}</router-link>
          <router-link to="/flag-leaf" class="btn secondary">{{ t('剑叶分析') }}</router-link>
        </div>
      </div>

      <aside class="hero-panel">
        <div class="panel-row">
          <span class="panel-label">{{ t('识别组织') }}</span>
          <span class="panel-value">{{ t('4 类') }}</span>
        </div>
        <div class="panel-row">
          <span class="panel-label">{{ t('表型指标') }}</span>
          <span class="panel-value">{{ t('15 项') }}</span>
        </div>
        <div class="panel-row">
          <span class="panel-label">{{ t('导出格式') }}</span>
          <span class="panel-value">Excel · JSON</span>
        </div>
        <p class="panel-note">{{ t('支持整文件夹批量提交，处理进度实时可见') }}</p>
      </aside>
    </section>

    <section class="features">
      <h2 class="section-title">{{ t('核心能力') }}</h2>
      <div class="feature-grid stagger-in">
        <article v-for="feature in features" :key="feature.title" class="feature-card">
          <span class="feature-icon" v-html="feature.icon"></span>
          <h3 class="feature-title">{{ t(feature.title) }}</h3>
          <p class="feature-desc">{{ t(feature.desc) }}</p>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup>
import { useI18n } from '@/i18n';

const { t } = useI18n();
const icon = (paths) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

const features = [
  {
    icon: icon('<path d="M4 7h16" /><path d="M4 12h10" /><path d="M4 17h7" />'),
    title: '一键分割',
    desc: '上传图像即开始分析，自动生成带掩膜的标注图与 LabelMe 格式 JSON。',
  },
  {
    icon: icon('<circle cx="8" cy="9" r="3" /><circle cx="16" cy="15" r="3" /><path d="M4 20h6M14 4h6" />'),
    title: '维管束计数',
    desc: '自动区分大、小维管束，统计数量、总面积及两者比值。',
  },
  {
    icon: icon('<path d="M12 3v18" /><path d="M5 8h14" /><path d="M7 20h10" />'),
    title: '几何测量',
    desc: '茎秆直径、周长、面积、空腔面积及其与茎秆的比值，全部自动计算。',
  },
  {
    icon: icon('<rect x="3" y="7" width="12" height="12" rx="2" /><path d="M9 3h10a2 2 0 0 1 2 2v10" />'),
    title: '批量处理',
    desc: '支持整文件夹提交，后台逐张处理，批量进度集中在浮层展示。',
  },
  {
    icon: icon('<path d="M12 3v10" /><path d="m8 9 4 4 4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />'),
    title: '数据导出',
    desc: '自由勾选需要的指标，导出单条报告、批量总表或原始 JSON。',
  },
  {
    icon: icon('<rect x="3" y="4" width="18" height="14" rx="2" /><path d="M7 8h6M7 12h4" /><path d="M8 21h8" />'),
    title: '结果可复核',
    desc: '原图与分割结果并排对照，支持缩放与拖拽，便于人工核查。',
  },
];
</script>

<style scoped>
.home-view {
  max-width: 1180px;
  margin: 0 auto;
  padding: 8px 0 24px;
}

/* ==================== 首屏 ==================== */
.hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 32px;
  align-items: center;
  padding: 36px 0 44px;
}

.eyebrow {
  margin: 0 0 14px;
  color: var(--color-primary-green-dark);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.hero-title {
  margin: 0 0 16px;
  color: var(--color-text-primary);
  font-size: 30px;
  font-weight: 600;
  line-height: 1.32;
  letter-spacing: -0.02em;
}

.hero-desc {
  max-width: 480px;
  margin: 0 0 26px;
  color: var(--color-text-secondary);
  font-size: 13.5px;
  line-height: 1.75;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  padding: 0 18px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  transition: background-color var(--transition-fast), border-color var(--transition-fast),
    color var(--transition-fast);
}

.btn:hover {
  text-decoration: none;
}

.btn.primary {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #fff;
}

.btn.primary:hover {
  background: var(--color-accent-hover);
  border-color: var(--color-accent-hover);
  color: #fff;
}

.btn.secondary {
  background: var(--color-surface);
  border-color: var(--color-border);
  color: var(--color-text-secondary);
}

.btn.secondary:hover {
  border-color: var(--color-border-strong);
  color: var(--color-text-primary);
}

/* ---- 右侧指标卡 ---- */
.hero-panel {
  padding: 6px 18px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
}

.panel-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border-light);
}

.panel-label {
  color: var(--color-text-muted);
  font-size: 12.5px;
}

.panel-value {
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: 600;
}

.panel-note {
  padding: 12px 0 14px;
  color: var(--color-text-light);
  font-size: 12px;
  line-height: 1.6;
}

/* ==================== 功能列表 ==================== */
.section-title {
  margin: 0 0 16px;
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 600;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
}

.feature-card {
  padding: 20px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  transition: border-color var(--transition-fast), transform var(--transition-normal),
    box-shadow var(--transition-normal);
}

.feature-card:hover {
  border-color: var(--color-border-strong);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.feature-card:hover .feature-icon {
  transform: scale(1.06);
}

.feature-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  margin-bottom: 14px;
  border-radius: var(--radius-md);
  background: var(--color-primary-green-lightest);
  color: var(--color-primary-green-dark);
  transition: transform var(--transition-fast);
}

.feature-icon :deep(svg) {
  width: 17px;
  height: 17px;
}

.feature-title {
  margin: 0 0 6px;
  color: var(--color-text-primary);
  font-size: 13.5px;
  font-weight: 600;
}

.feature-desc {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 12.5px;
  line-height: 1.7;
}

@media (max-width: 900px) {
  .hero {
    grid-template-columns: minmax(0, 1fr);
    gap: 24px;
    padding: 20px 0 32px;
  }

  .hero-title {
    font-size: 24px;
  }
}
</style>
