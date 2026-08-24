export type WatchEventType = 'ongoing_game_detected' | 'new_match_detected'
export type CloseBehavior = 'ask' | 'tray' | 'quit'
export type ConnectionHealth = 'connecting' | 'connected' | 'unauthorized' | 'unavailable'

export interface QueueFilter {
  mode: 'all' | 'include'
  queueIds: number[]
}

export interface MonitorPolicy {
  intervalMs: number
  jitterMs: number
  ongoing: QueueFilter
  history: QueueFilter
}

export interface PlayerTarget {
  id: string
  gameName: string
  tagLine: string
  puuid: string
  serverId: string
  enabled: boolean
  overridePolicy: MonitorPolicy | null
  createdAt: string
}

export interface PlayerDraft {
  gameName: string
  tagLine: string
  puuid?: string
  serverId: string
  enabled?: boolean
}

export interface WebhookHeader {
  id: string
  name: string
  value: string
  secret: boolean
  configured?: boolean
}

export interface EventDeliveryConfig {
  webhookEnabled: boolean
  webhookTemplate: string
  notificationEnabled: boolean
  notificationTitle: string
  notificationBody: string
}

export interface AppConfig {
  version: 1
  globalPolicy: MonitorPolicy
  players: PlayerTarget[]
  webhook: {
    enabled: boolean
    url: string
    headers: WebhookHeader[]
    timeoutMs: number
  }
  events: Record<WatchEventType, EventDeliveryConfig>
  closeBehavior: CloseBehavior
  selectedConnectionPid: number | null
}

export interface LcuConnection {
  pid: number
  region: string
  serverId: string
  rsoPlatformId: string
  health: ConnectionHealth
  selected: boolean
  discoveryMethod: 'native' | 'cim'
  lastCheckedAt: string
  error?: string
}

export interface PrivateLcuConnection extends LcuConnection {
  port: number
  authToken: string
  riotClientPort: number
  riotClientAuthToken: string
}

export interface MatchInfo {
  gameId: string
  queueId: number
  gameMode: string
  startedAt: string | null
  durationSeconds?: number
}

export interface WatchEvent {
  schemaVersion: 1
  eventId: string
  type: WatchEventType
  occurredAt: string
  player: Pick<PlayerTarget, 'id' | 'gameName' | 'tagLine' | 'puuid' | 'serverId'>
  game: MatchInfo
  source: 'lcu-history' | 'sgp-history' | 'lcu-spectator+sgp-gsm' | 'test'
  deliveries?: {
    webhook?: 'sent' | 'failed' | 'disabled'
    notification?: 'sent' | 'failed' | 'disabled'
  }
}

export interface PlayerRuntimeState {
  seeded: boolean
  seenHistoryGameIds: string[]
  seenOngoingGameIds: string[]
  running: boolean
  lastRunAt: string | null
  nextRunAt: string | null
  lastError: string | null
}

export interface RuntimeState {
  version: 1
  players: Record<string, PlayerRuntimeState>
  recentEvents: WatchEvent[]
  diagnostics: string[]
}

export interface AppSnapshot {
  config: AppConfig
  connections: LcuConnection[]
  runtime: RuntimeState
  nativeAvailable: boolean
  appVersion: string
}

export interface TestEventRequest {
  type: WatchEventType
  channel: 'all' | 'webhook' | 'notification'
}

export interface WatchdogApi {
  getSnapshot(): Promise<AppSnapshot>
  saveConfig(config: AppConfig): Promise<AppSnapshot>
  addPlayer(draft: PlayerDraft): Promise<AppSnapshot>
  updatePlayer(player: PlayerTarget): Promise<AppSnapshot>
  removePlayer(playerId: string): Promise<AppSnapshot>
  runNow(playerId?: string): Promise<void>
  selectConnection(pid: number | null): Promise<AppSnapshot>
  testEvent(request: TestEventRequest): Promise<{ ok: boolean; message: string }>
  onSnapshot(listener: (snapshot: AppSnapshot) => void): () => void
  onNavigatePlayer(listener: (playerId: string) => void): () => void
}

