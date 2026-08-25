import { createApp } from 'vue'
import { createPinia } from 'pinia'
import {
  create, NAlert, NButton, NCheckbox, NCollapse, NCollapseItem, NConfigProvider, NForm, NFormItem,
  NDropdown, NInput, NInputNumber, NMessageProvider, NModal, NPopconfirm, NRadio, NRadioGroup, NSelect,
  NSpace, NSwitch, NTag
} from 'naive-ui'
import App from './App.vue'
import './styles.css'
import { cssThemeVariables } from './ui-theme'

for (const [name, value] of Object.entries(cssThemeVariables)) document.documentElement.style.setProperty(name, String(value))

const naive = create({
  components: [
    NAlert, NButton, NCheckbox, NCollapse, NCollapseItem, NConfigProvider, NForm, NFormItem,
    NDropdown, NInput, NInputNumber, NMessageProvider, NModal, NPopconfirm, NRadio, NRadioGroup, NSelect,
    NSpace, NSwitch, NTag
  ]
})

createApp(App).use(createPinia()).use(naive).mount('#app')
