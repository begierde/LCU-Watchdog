import { randomUUID } from 'node:crypto'
import { DEFAULT_POLICY } from '@shared/defaults'
import type { MatchInfo, MonitorPolicy, PlayerRuntimeState, PlayerTarget, TestEventRequest, WatchEvent, WatchEventType } from '@shared/types'
import type { ConfigStore, RuntimeStore } from './persistence'
import type { GameDataClient } from './game-data'
import type { EventDispatcher } from './event-dispatcher'

export function queueMatches(queueId: number, filter: MonitorPolicy['history']): boolean {
  return filter.mode === 'all' || filter.queueIds.includes(queueId)
}

export function nextDelay(policy: MonitorPolicy, random = Math.random): number {
  return policy.intervalMs + Math.floor(random() * (policy.jitterMs + 1))
}

export function reconcileHistory(
  runtime: PlayerRuntimeState,
  matches: MatchInfo[],
  serverId: string,
  filter: MonitorPolicy['history']
): MatchInfo[] {
  if (!runtime.seeded) {
    runtime.seenHistoryGameIds = matches.map((match) => `${serverId}:${match.gameId}`).slice(0, 200)
    runtime.seeded = true
    return []
  }
  const seen = new Set(runtime.seenHistoryGameIds)
  const newMatches = matches.filter((match) => queueMatches(match.queueId, filter) && !seen.has(`${serverId}:${match.gameId}`))
  runtime.seenHistoryGameIds = [...matches.map((match) => `${serverId}:${match.gameId}`), ...runtime.seenHistoryGameIds]
    .filter((id, index, list) => list.indexOf(id) === index).slice(0, 200)
  return newMatches
}

class Semaphore {
  private active = 0
  private waiters: Array<() => void> = []
  constructor(private readonly limit: number) {}
  async use<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) await new Promise<void>((resolve) => this.waiters.push(resolve))
    this.active++
    try { return await task() } finally {
      this.active--
      this.waiters.shift()?.()
    }
  }
}

export class MonitorService {
  private timers = new Map<string, NodeJS.Timeout>()
  private inFlight = new Set<string>()
  private readonly semaphore = new Semaphore(2)

  constructor(
    private readonly configStore: ConfigStore,
    private readonly runtimeStore: RuntimeStore,
    private readonly gameData: GameDataClient,
    private readonly events: EventDispatcher,
    private readonly onChange: () => void
  ) {}

  start(): void { this.rescheduleAll(true) }

  stop(): void {
    for (const timer of this.timers.values()) clearTimeout(timer)
    this.timers.clear()
  }

  rescheduleAll(initial = false): void {
    this.stop()
    for (const player of this.configStore.getPrivate().players) {
      if (player.enabled) this.schedule(player, initial ? 5_000 : undefined)
      else this.runtimeStore.player(player.id).nextRunAt = null
    }
    this.runtimeStore.queueSave()
    this.onChange()
  }

  async runNow(playerId?: string): Promise<void> {
    const players = this.configStore.getPrivate().players.filter((player) => player.enabled && (!playerId || player.id === playerId))
    await Promise.all(players.map((player) => this.runPlayer(player)))
  }

  async createTestEvent(request: TestEventRequest): Promise<WatchEvent> {
    const player = this.configStore.getPrivate().players[0] ?? {
      id: 'test-player', gameName: '示例玩家', tagLine: 'TEST', puuid: 'test-puuid', serverId: 'JP', enabled: true,
      overridePolicy: null, createdAt: new Date().toISOString()
    }
    return this.events.dispatch(this.makeEvent(request.type, player, {
      gameId: '1234567890', queueId: request.type === 'new_match_detected' ? 440 : 420,
      gameMode: 'CLASSIC', startedAt: new Date().toISOString()
    }, 'test'), request.channel)
  }

  private schedule(player: PlayerTarget, fixedDelay?: number): void {
    const policy = player.overridePolicy ?? this.configStore.getPrivate().globalPolicy ?? DEFAULT_POLICY
    const wait = fixedDelay ?? nextDelay(policy)
    const runtime = this.runtimeStore.player(player.id)
    runtime.nextRunAt = new Date(Date.now() + wait).toISOString()
    this.timers.set(player.id, setTimeout(() => void this.runPlayer(player), wait))
  }

  private async runPlayer(player: PlayerTarget): Promise<void> {
    if (this.inFlight.has(player.id)) return
    const existing = this.timers.get(player.id)
    if (existing) clearTimeout(existing)
    this.timers.delete(player.id)
    this.inFlight.add(player.id)
    const runtime = this.runtimeStore.player(player.id)
    runtime.running = true
    runtime.nextRunAt = null
    runtime.lastError = null
    this.onChange()

    try {
      await this.semaphore.use(async () => {
        const policy = player.overridePolicy ?? this.configStore.getPrivate().globalPolicy
        const [history, ongoing] = await Promise.allSettled([
          this.gameData.getHistory(player.puuid, player.serverId),
          this.gameData.getOngoing(player.puuid, player.serverId)
        ])
        const errors: string[] = []
        if (history.status === 'fulfilled') await this.processHistory(player, history.value.matches, history.value.source, policy)
        else errors.push(`历史：${this.errorMessage(history.reason)}`)
        if (ongoing.status === 'fulfilled' && ongoing.value) await this.processOngoing(player, ongoing.value, policy)
        else if (ongoing.status === 'rejected') errors.push(`进行中：${this.errorMessage(ongoing.reason)}`)
        if (errors.length) runtime.lastError = errors.join('；')
      })
    } catch (error) {
      runtime.lastError = this.errorMessage(error)
    } finally {
      runtime.running = false
      runtime.lastRunAt = new Date().toISOString()
      this.inFlight.delete(player.id)
      this.runtimeStore.queueSave()
      const latest = this.configStore.getPrivate().players.find((item) => item.id === player.id)
      if (latest?.enabled) this.schedule(latest)
      this.onChange()
    }
  }

  private async processHistory(player: PlayerTarget, matches: MatchInfo[], source: 'lcu-history' | 'sgp-history', policy: MonitorPolicy): Promise<void> {
    const runtime = this.runtimeStore.player(player.id)
    const newMatches = reconcileHistory(runtime, matches, player.serverId, policy.history)
    for (const match of [...newMatches].reverse()) await this.events.dispatch(this.makeEvent('new_match_detected', player, match, source))
  }

  private async processOngoing(player: PlayerTarget, game: MatchInfo, policy: MonitorPolicy): Promise<void> {
    if (!queueMatches(game.queueId, policy.ongoing)) return
    const runtime = this.runtimeStore.player(player.id)
    const key = `${player.serverId}:${game.gameId}`
    if (runtime.seenOngoingGameIds.includes(key)) return
    runtime.seenOngoingGameIds = [key, ...runtime.seenOngoingGameIds].slice(0, 200)
    await this.events.dispatch(this.makeEvent('ongoing_game_detected', player, game, 'lcu-spectator+sgp-gsm'))
  }

  private makeEvent(type: WatchEventType, player: PlayerTarget, game: MatchInfo, source: WatchEvent['source']): WatchEvent {
    return {
      schemaVersion: 1, eventId: randomUUID(), type, occurredAt: new Date().toISOString(),
      player: { id: player.id, gameName: player.gameName, tagLine: player.tagLine, puuid: player.puuid, serverId: player.serverId },
      game, source
    }
  }

  private errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error) }
}
