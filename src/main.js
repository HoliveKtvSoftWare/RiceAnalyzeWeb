import { createApp } from 'vue'
import { createPinia } from 'pinia' 

import App from './App.vue'
import router from './router' 
import { locale, setLocale } from './i18n'
import './assets/main.css' 

setLocale(locale.value)

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')