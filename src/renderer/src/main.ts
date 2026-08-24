import { createApp } from 'vue'
import { createPinia } from 'pinia'
import {
  create, NAlert, NButton, NCheckbox, NCollapse, NCollapseItem, NConfigProvider, NForm, NFormItem,
  NInput, NInputNumber, NMessageProvider, NModal, NPopconfirm, NRadio, NRadioGroup, NSelect,
  NSpace, NSwitch, NTag
} from 'naive-ui'
import App from './App.vue'
import './styles.css'

const naive = create({
  components: [
    NAlert, NButton, NCheckbox, NCollapse, NCollapseItem, NConfigProvider, NForm, NFormItem,
    NInput, NInputNumber, NMessageProvider, NModal, NPopconfirm, NRadio, NRadioGroup, NSelect,
    NSpace, NSwitch, NTag
  ]
})

createApp(App).use(createPinia()).use(naive).mount('#app')
