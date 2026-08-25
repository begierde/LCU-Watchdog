import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { AppConfig, AppSnapshot, PlayerDraft, PlayerTarget, TestEventRequest } from '@shared/types'

export const useWatchdogStore = defineStore('watchdog', () => {
  const snapshot = ref<AppSnapshot | null>(null)
  const pending = ref<Record<string, boolean>>({})
  const loading = computed(() => Object.values(pending.value).some(Boolean))
  const error = ref<string | null>(null)
  const activeConnection = computed(() => snapshot.value?.connections.find((connection) => connection.selected) ?? null)

  async function run<T>(key: string, task: () => Promise<T>): Promise<T> {
    pending.value[key] = true
    error.value = null
    try { return await task() }
    catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause); throw cause }
    finally { pending.value[key] = false }
  }

  async function init() {
    snapshot.value = await run('init', () => window.watchdog.getSnapshot())
    window.watchdog.onSnapshot((value) => { snapshot.value = value })
  }

  async function saveConfig(config: AppConfig) { snapshot.value = await run('save-config', () => window.watchdog.saveConfig(config)) }
  async function addPlayer(draft: PlayerDraft) { snapshot.value = await run('add-player', () => window.watchdog.addPlayer(draft)) }
  async function updatePlayer(player: PlayerTarget) { snapshot.value = await run(`update-player:${player.id}`, () => window.watchdog.updatePlayer(player)) }
  async function removePlayer(id: string) { snapshot.value = await run(`remove-player:${id}`, () => window.watchdog.removePlayer(id)) }
  async function runNow(id?: string) { await run(id ? `run-player:${id}` : 'run-all', () => window.watchdog.runNow(id)) }
  async function selectConnection(pid: number | null) { snapshot.value = await run('select-connection', () => window.watchdog.selectConnection(pid)) }
  async function testEvent(request: TestEventRequest) { return run(`test-event:${request.type}:${request.channel}`, () => window.watchdog.testEvent(request)) }

  function isPending(key: string) { return pending.value[key] === true }

  return { snapshot, loading, pending, error, activeConnection, isPending, init, saveConfig, addPlayer, updatePlayer, removePlayer, runNow, selectConnection, testEvent }
})
