import { ipcMain } from 'electron'
import type { AppConfig, PlayerDraft, PlayerTarget, TestEventRequest } from '@shared/types'
import type { AppController } from './controller'

export function registerIpc(controller: AppController): void {
  ipcMain.handle('watchdog:get-snapshot', () => controller.snapshot())
  ipcMain.handle('watchdog:save-config', (_event, config: AppConfig) => controller.saveConfig(config))
  ipcMain.handle('watchdog:add-player', (_event, draft: PlayerDraft) => controller.addPlayer(draft))
  ipcMain.handle('watchdog:update-player', (_event, player: PlayerTarget) => controller.updatePlayer(player))
  ipcMain.handle('watchdog:remove-player', (_event, playerId: string) => controller.removePlayer(playerId))
  ipcMain.handle('watchdog:run-now', (_event, playerId?: string) => controller.monitor.runNow(playerId))
  ipcMain.handle('watchdog:select-connection', (_event, pid: number | null) => controller.selectConnection(pid))
  ipcMain.handle('watchdog:test-event', (_event, request: TestEventRequest) => controller.testEvent(request))
}

