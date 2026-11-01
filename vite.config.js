import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

export default defineConfig(({ mode }) => {
  const isDev = mode !== 'production'

  return {
    define: {
      // 构建时间：侧边栏显示，用于判断浏览器里跑的是不是最新产物
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      // 版本号：从 package.json 读取，侧边栏显示 v2.1.0
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [
      // Vue 单文件组件编译插件，必需
      vue(),
      // 仅开发环境启用 Vue DevTools；生产构建不注入调试代码
      ...(isDev ? [vueDevTools()] : []),
    ],
    resolve: {
      alias: {
        // 路径别名：@ 指向 src，import 时可用 '@/stores/...'
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
    build: {
      // 目标浏览器：支持原生 ES2020，减少不必要的降级转换
      target: 'es2020',
      // 每个异步页面单独拆 CSS，首屏只加载当前页样式
      cssCodeSplit: true,
      // 关闭 gzip 体积报告，加快构建
      reportCompressedSize: false,
      // 单个 chunk 超过 900KB 才提示，避免第三方库触发噪音警告
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          // 第三方库按框架拆成独立 chunk，业务代码更新时不用重新下载 vendor
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
      // 开发服务器启动时预加载入口文件，首次打开页面更快
      warmup: {
        clientFiles: ['./src/main.js', './src/App.vue', './src/views/StemView.vue'],
      },
    },
  }
})
