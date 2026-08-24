<template>
  <n-config-provider :theme="darkTheme" :theme-overrides="themeOverrides">
    <n-message-provider>
      <AppContent />
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { darkTheme, NMessageProvider, NConfigProvider } from 'naive-ui'
import AppContent from './components/AppContent.vue'

const themeOverrides = {
  common: {
    primaryColor: '#8b73d8', primaryColorHover: '#9a82e5', primaryColorPressed: '#7560be',
    primaryColorSuppl: '#8b73d8',
    bodyColor: '#201e2a', cardColor: '#2b2838', modalColor: '#2b2838', popoverColor: '#302d3e',
    inputColor: '#242230', actionColor: '#353142', hoverColor: '#ffffff0a',
    textColorBase: '#e8e3ed', textColor1: '#eeeaf2', textColor2: '#c8c2d0', textColor3: '#9a94a7',
    borderColor: '#403b4f', dividerColor: '#3b3749',
    borderRadius: '10px', fontFamily: 'Inter, "Microsoft YaHei UI", system-ui, sans-serif'
  }
}

</script>
