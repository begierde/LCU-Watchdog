import { app, BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import type { AppConfig, AppSnapshot, PlayerDraft, PlayerTarget, TestEventRequest } from '@shared/types'
import { ConfigStore, RuntimeStore } from './persistence'
import { LcuDiscovery } from './lcu/discovery'
import { GameDataClient } from './game-data'
import { EventDispatcher } from './event-dispatcher'
import { MonitorService } from './monitor-service'

export class AppController {
  readonly configStore: ConfigStore
  readonly runtimeStore: RuntimeStore
  readonly discovery = new LcuDiscovery()
  readonly gameData: GameDataClient
  readonly eventDispatcher: EventDispatcher
  readonly monitor: MonitorService
  private lastActivePid: number | null = null
  private navigateToPlayer: (playerId: string) => void = () => undefined

  constructor(userData: string) {
    this.configStore = new ConfigStore(userData)
    this.runtimeStore = new RuntimeStore(userData)
    this.gameData = new GameDataClient(() => this.discovery.active)
    this.eventDispatcher = new EventDispatcher(
      this.configStore, this.runtimeStore, () => this.broadcast(),
      (playerId) => this.navigateToPlayer(playerId)
    )
    this.monitor = new MonitorService(
      this.configStore, this.runtimeStore, this.gameData, this.eventDispatcher, () => this.broadcast()
    )
  }

  async init(): Promise<void> {
    await Promise.all([this.configStore.load(), this.runtimeStore.load()])
    this.navigateToPlayer = (playerId) => {
      const window = BrowserWindow.getAllWindows()[0]
      if (!window) return
      if (window.isMinimized()) window.restore()
      window.show()
      window.focus()
      window.webContents.send('watchdog:navigate-player', playerId)
    }
    this.discovery.onChange(() => {
      const activePid = this.discovery.active?.pid ?? null
      if (activePid !== this.lastActivePid) {
        this.gameData.invalidateTokens()
        this.lastActivePid = activePid
        if (activePid) void this.monitor.runNow()
      }
      this.broadcast()
    })
    this.monitor.start()
    this.discovery.start(this.configStore.getPrivate().selectedConnectionPid)
  }

  async shutdown(): Promise<void> {
    this.discovery.stop()
    this.monitor.stop()
    await this.runtimeStore.flush()
  }

  snapshot(): AppSnapshot {
    return {
      config: this.configStore.get(), connections: this.discovery.publicConnections(), runtime: this.runtimeStore.get(),
      nativeAvailable: this.discovery.nativeAvailable, appVersion: app.getVersion()
    }
  }

  async saveConfig(config: AppConfig): Promise<AppSnapshot> {
    const knownPlayers = new Set(config.players.map((player) => player.id))
    for (const id of Object.keys(this.runtimeStore.get().players)) if (!knownPlayers.has(id)) this.runtimeStore.removePlayer(id)
    await this.configStore.save(config)
    this.discovery.select(config.selectedConnectionPid)
    this.monitor.rescheduleAll()
    return this.snapshot()
  }

  async addPlayer(draft: PlayerDraft): Promise<AppSnapshot> {
    const resolved = await this.gameData.resolvePlayer(draft)
    const config = this.configStore.get()
    if (config.players.some((player) => player.puuid === resolved.puuid && player.serverId === draft.serverId)) {
      throw new Error('该玩家已经在监视列表中')
    }
    config.players.push({
      id: randomUUID(), ...resolved, serverId: draft.serverId, enabled: draft.enabled ?? true,
      overridePolicy: null, createdAt: new Date().toISOString()
    })
    await this.configStore.save(config)
    this.monitor.rescheduleAll(true)
    return this.snapshot()
  }

  async updatePlayer(player: PlayerTarget): Promise<AppSnapshot> {
    const config = this.configStore.get()
    const index = config.players.findIndex((item) => item.id === player.id)
    if (index < 0) throw new Error('玩家不存在')
    config.players[index] = player
    await this.configStore.save(config)
    this.monitor.rescheduleAll()
    return this.snapshot()
  }

  async removePlayer(playerId: string): Promise<AppSnapshot> {
    const config = this.configStore.get()
    config.players = config.players.filter((player) => player.id !== playerId)
    await this.configStore.save(config)
    this.runtimeStore.removePlayer(playerId)
    this.monitor.rescheduleAll()
    return this.snapshot()
  }

  async selectConnection(pid: number | null): Promise<AppSnapshot> {
    const config = this.configStore.get()
    config.selectedConnectionPid = pid
    await this.configStore.save(config)
    this.discovery.select(pid)
    return this.snapshot()
  }

  async testEvent(request: TestEventRequest): Promise<{ ok: boolean; message: string }> {
    try {
      const event = await this.monitor.createTestEvent(request)
      if (request.channel !== 'notification' && event.deliveries?.webhook === 'failed') {
        return { ok: false, message: 'Webhook 测试发送失败，请查看诊断信息' }
      }
      if (request.channel !== 'webhook' && event.deliveries?.notification === 'failed') {
        return { ok: false, message: 'Windows 通知测试失败，请查看诊断信息' }
      }
      return { ok: true, message: '测试事件已发送' }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  }

  broadcast(): void {
    const snapshot = this.snapshot()
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send('watchdog:snapshot', snapshot)
    }
  }
}
