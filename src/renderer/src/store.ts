import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { AppConfig, AppSnapshot, PlayerDraft, PlayerTarget, TestEventRequest } from '@shared/types'

export const useWatchdogStore = defineStore('watchdog', () => {
  const snapshot = ref<AppSnapshot | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const activeConnection = computed(() => snapshot.value?.connections.find((connection) => connection.selected) ?? null)

  async function run<T>(task: () => Promise<T>): Promise<T> {
    loading.value = true
    error.value = null
    try { return await task() }
    catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause); throw cause }
    finally { loading.value = false }
  }

  async function init() {
    snapshot.value = await run(() => window.watchdog.getSnapshot())
    window.watchdog.onSnapshot((value) => { snapshot.value = value })
  }

  async function saveConfig(config: AppConfig) { snapshot.value = await run(() => window.watchdog.saveConfig(config)) }
  async function addPlayer(draft: PlayerDraft) { snapshot.value = await run(() => window.watchdog.addPlayer(draft)) }
  async function updatePlayer(player: PlayerTarget) { snapshot.value = await run(() => window.watchdog.updatePlayer(player)) }
  async function removePlayer(id: string) { snapshot.value = await run(() => window.watchdog.removePlayer(id)) }
  async function runNow(id?: string) { await run(() => window.watchdog.runNow(id)) }
  async function selectConnection(pid: number | null) { snapshot.value = await run(() => window.watchdog.selectConnection(pid)) }
  async function testEvent(request: TestEventRequest) { return run(() => window.watchdog.testEvent(request)) }

  return { snapshot, loading, error, activeConnection, init, saveConfig, addPlayer, updatePlayer, removePlayer, runNow, selectConnection, testEvent }
})

