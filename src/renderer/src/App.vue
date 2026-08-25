<template>
  <n-config-provider :theme="darkTheme" :theme-overrides="naiveThemeOverrides">
    <n-message-provider>
      <AppContent />
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { darkTheme, NMessageProvider, NConfigProvider } from 'naive-ui'
import AppContent from './components/AppContent.vue'
import { naiveThemeOverrides } from './ui-theme'

</script>
