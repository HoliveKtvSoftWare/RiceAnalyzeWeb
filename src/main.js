// src/main.js

import { createApp } from 'vue'
import { createPinia } from 'pinia' // 1. 导入 Pinia

import App from './App.vue'
import router from './router' // 2. 导入我们配置好的 Router
import { locale, setLocale } from './i18n'
import './assets/main.css' // 导入全局样式

// 同步一次 <html lang>：既反映持久化的语言，也让浏览器/读屏软件拿到正确语言
setLocale(locale.value)

// 创建 Vue 应用实例
const app = createApp(App)

// 3. 注册 Pinia 插件
app.use(createPinia())
// 4. 注册 Router 插件
app.use(router)

// 将应用挂载到 HTML 页面中 ID 为 'app' 的元素上
app.mount('#app')
