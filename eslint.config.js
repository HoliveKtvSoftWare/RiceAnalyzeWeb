import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

export default defineConfig([
  {
    name: 'app/files-to-lint',
    // 参与检查的文件类型：JS / MJS / JSX / Vue
    files: ['**/*.{js,mjs,jsx,vue}'],
  },

  // 排除构建产物和覆盖率目录
  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  {
    languageOptions: {
      globals: {
        // 浏览器环境全局变量（window、document 等）
        ...globals.browser,
        // Vite define 注入的只读全局变量
        __BUILD_TIME__: 'readonly',
        __APP_VERSION__: 'readonly',
      },
    },
    rules: {
      // 允许 catch {} 留空：本地存储/可选功能失败时按静默降级处理
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },

  // ESLint 官方推荐规则
  js.configs.recommended,
  // Vue 官方基础规则
  ...pluginVue.configs['flat/essential'],
  // 关闭与 Prettier 冲突的格式规则
  skipFormatting,
])
