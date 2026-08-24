<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <n-message-provider>
      <AppContent />
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { NMessageProvider, NConfigProvider } from 'naive-ui'
import AppContent from './components/AppContent.vue'

const themeOverrides = {
  common: {
    primaryColor: '#5b5bd6', primaryColorHover: '#6e6ee8', primaryColorPressed: '#4848bd',
    borderRadius: '10px', fontFamily: 'Inter, "Microsoft YaHei UI", system-ui, sans-serif'
  }
}

</script>
