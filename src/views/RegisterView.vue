<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-header">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 21V10" />
            <path d="M12 10c0-3.3 2.7-6 6-6 0 3.3-2.7 6-6 6Z" />
            <path d="M12 14c0-3.3-2.7-6-6-6 0 3.3 2.7 6 6 6Z" />
            <path d="M8.5 21h7" />
          </svg>
        </span>
        <h1>{{ t('创建账户') }}</h1>
        <p class="auth-subtitle">{{ t('注册后即可上传图像并导出表型数据') }}</p>
      </div>

      <form class="auth-form" @submit.prevent="handleRegister">
        <div class="form-group">
          <label for="email">{{ t('邮箱') }}</label>
          <input
            type="email"
            id="email"
            v-model="email"
            placeholder="name@example.com"
            required
            autocomplete="email"
          />
        </div>

        <div class="form-group">
          <label for="password">{{ t('密码') }}</label>
          <input
            type="password"
            id="password"
            v-model="password"
            :placeholder="t('至少 6 位字符')"
            required
            autocomplete="new-password"
          />
        </div>

        <div class="form-group">
          <label for="confirmPassword">{{ t('确认密码') }}</label>
          <input
            type="password"
            id="confirmPassword"
            v-model="confirmPassword"
            :placeholder="t('再次输入密码')"
            required
            autocomplete="new-password"
          />
        </div>

        <p v-if="errorMessage" class="form-error">{{ errorMessage }}</p>
        <p v-if="successMessage" class="form-success">{{ successMessage }}</p>

        <button type="submit" class="primary submit-button" :disabled="isLoading">
          <span v-if="isLoading" class="spinner" aria-hidden="true"></span>
          <span>{{ isLoading ? t('注册中') : t('注册') }}</span>
        </button>
      </form>

      <p class="auth-footer">
        {{ t('已有账户？') }}
        <router-link to="/login">{{ t('返回登录') }}</router-link>
      </p>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from '@/i18n';

const { t } = useI18n();
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const errorMessage = ref('');
const successMessage = ref('');
const isLoading = ref(false);

const authStore = useAuthStore();
const router = useRouter();

const handleRegister = async () => {
  if (password.value !== confirmPassword.value) {
    errorMessage.value = t('两次输入的密码不一致。');
    return;
  }

  isLoading.value = true;
  errorMessage.value = '';
  successMessage.value = '';

  const success = await authStore.registerAction({
    email: email.value,
    password: password.value,
  });

  isLoading.value = false;

  if (success) {
    successMessage.value = t('注册成功，正在跳转到登录页面…');
    setTimeout(() => {
      router.push({ name: 'login' });
    }, 2000);
  } else {
    errorMessage.value = t('注册失败，该邮箱可能已被占用。');
  }
};
</script>

<style scoped>
.auth-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px;
  background:
    radial-gradient(720px 320px at 50% -8%, var(--color-primary-green-lightest), transparent 70%),
    var(--color-background);
}

.auth-card {
  width: 100%;
  max-width: 396px;
  padding: 32px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  box-shadow: var(--shadow-xs);
  animation: authIn var(--transition-slow) ease both;
}

@keyframes authIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.auth-header {
  margin-bottom: 22px;
  text-align: center;
}

.brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  margin-bottom: 16px;
  border-radius: var(--radius-lg);
  background: var(--color-primary-green-lightest);
  color: var(--color-primary-green-dark);
}

.brand-mark svg {
  width: 22px;
  height: 22px;
}

.auth-header h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.auth-subtitle {
  margin: 6px 0 0;
  color: var(--color-text-muted);
  font-size: 12.5px;
  line-height: 1.6;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 500;
}

.form-group input {
  height: 38px;
  font-size: 13.5px;
}

.form-error {
  margin: 8px 0 0;
  padding: 8px 10px;
  border: 1px solid rgba(220, 38, 38, 0.16);
  border-radius: var(--radius-md);
  background: var(--color-error-light);
  color: var(--color-error);
  font-size: 12px;
  line-height: 1.5;
}

.form-success {
  margin: 8px 0 0;
  padding: 8px 10px;
  border: 1px solid rgba(22, 163, 74, 0.16);
  border-radius: var(--radius-md);
  background: var(--color-primary-green-lightest);
  color: var(--color-primary-green-dark);
  font-size: 12px;
  line-height: 1.5;
}

.submit-button {
  width: 100%;
  height: 38px;
  margin-top: 14px;
  font-size: 13.5px;
  font-weight: 500;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 1.5px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.auth-footer {
  margin: 20px 0 0;
  padding-top: 18px;
  border-top: 1px solid var(--color-border-light);
  color: var(--color-text-muted);
  font-size: 12.5px;
  text-align: center;
}

.auth-footer a {
  margin-left: 2px;
  font-weight: 500;
}
</style>
