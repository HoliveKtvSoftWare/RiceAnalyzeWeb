import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isDev = mode !== 'production'

  return {
    // 把构建时间注入到前端，侧边栏会显示它 —— 用来判断浏览器里跑的是不是最新产物
    // （排查"改了代码但页面没变"这类缓存问题时非常直接）。
    define: {
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
    plugins: [
      vue(),
      // 仅在开发环境启用 devtools 插件：它会往产物里注入调试运行时代码，
      // 生产构建里既增大体积又拖慢初始化。
      ...(isDev ? [vueDevTools()] : []),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
    build: {
      // 目标浏览器都支持原生 ES2020+，去掉不必要的降级转换
      target: 'es2020',
      cssCodeSplit: true,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          // 把不常变动的第三方库拆成独立 chunk，
          // 业务代码更新时用户不再需要重新下载整个 vendor。
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            if (id.includes('vue-router')) return 'vendor-router'
            if (id.includes('pinia')) return 'vendor-pinia'
            if (id.includes('axios')) return 'vendor-axios'
            if (id.includes('/vue/') || id.includes('@vue/')) return 'vendor-vue'
            return undefined
          },
        },
      },
    },
    server: {
      // 开发时跳过无用的依赖预构建探测，启动/热更新更快
      warmup: {
        clientFiles: ['./src/main.js', './src/App.vue', './src/views/StemView.vue'],
      },
    },
  }
})
