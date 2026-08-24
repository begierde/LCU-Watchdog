import { contextBridge, ipcRenderer } from 'electron'
import type { AppConfig, AppSnapshot, PlayerDraft, PlayerTarget, TestEventRequest, WatchdogApi, WindowAction } from '@shared/types'

const api: WatchdogApi = {
  getSnapshot: () => ipcRenderer.invoke('watchdog:get-snapshot'),
  saveConfig: (config: AppConfig) => ipcRenderer.invoke('watchdog:save-config', config),
  addPlayer: (draft: PlayerDraft) => ipcRenderer.invoke('watchdog:add-player', draft),
  updatePlayer: (player: PlayerTarget) => ipcRenderer.invoke('watchdog:update-player', player),
  removePlayer: (playerId: string) => ipcRenderer.invoke('watchdog:remove-player', playerId),
  runNow: (playerId?: string) => ipcRenderer.invoke('watchdog:run-now', playerId),
  selectConnection: (pid: number | null) => ipcRenderer.invoke('watchdog:select-connection', pid),
  testEvent: (request: TestEventRequest) => ipcRenderer.invoke('watchdog:test-event', request),
  windowControl: (action: WindowAction) => ipcRenderer.invoke('watchdog:window-control', action),
  onSnapshot: (listener: (snapshot: AppSnapshot) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: AppSnapshot) => listener(snapshot)
    ipcRenderer.on('watchdog:snapshot', handler)
    return () => ipcRenderer.removeListener('watchdog:snapshot', handler)
  },
  onNavigatePlayer: (listener: (playerId: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, playerId: string) => listener(playerId)
    ipcRenderer.on('watchdog:navigate-player', handler)
    return () => ipcRenderer.removeListener('watchdog:navigate-player', handler)
  },
  onWindowMaximized: (listener: (maximized: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, maximized: boolean) => listener(maximized)
    ipcRenderer.on('watchdog:window-maximized', handler)
    return () => ipcRenderer.removeListener('watchdog:window-maximized', handler)
  }
}

contextBridge.exposeInMainWorld('watchdog', api)
