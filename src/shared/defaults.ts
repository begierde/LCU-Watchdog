import type { AppConfig, MonitorPolicy, PlayerRuntimeState, RuntimeState, WatchEventType } from './types'

export const MIN_INTERVAL_MS = 60_000
export const MAX_INTERVAL_MS = 86_400_000

export const DEFAULT_POLICY: MonitorPolicy = {
  intervalMs: 300_000,
  jitterMs: 60_000,
  ongoing: { mode: 'all', queueIds: [] },
  history: { mode: 'include', queueIds: [440] }
}

const defaultEvent = (type: WatchEventType) => ({
  webhookEnabled: false,
  webhookTemplate: '{{eventJson}}',
  notificationEnabled: true,
  notificationTitle: type === 'ongoing_game_detected' ? '{{playerRiotId}} 正在游戏' : '{{playerRiotId}} 有新对局',
  notificationBody:
    type === 'ongoing_game_detected'
      ? '队列 {{queueId}} · 对局 {{gameId}}'
      : '发现新的队列 {{queueId}} 对局 · {{gameId}}'
})

export const DEFAULT_CONFIG: AppConfig = {
  version: 1,
  globalPolicy: structuredClone(DEFAULT_POLICY),
  players: [],
  webhook: { enabled: false, url: '', headers: [], timeoutMs: 10_000 },
  events: {
    ongoing_game_detected: defaultEvent('ongoing_game_detected'),
    new_match_detected: defaultEvent('new_match_detected')
  },
  closeBehavior: 'ask',
  selectedConnectionPid: null
}

export const newPlayerRuntime = (): PlayerRuntimeState => ({
  seeded: false,
  seenHistoryGameIds: [],
  seenOngoingGameIds: [],
  running: false,
  lastRunAt: null,
  nextRunAt: null,
  lastError: null
})

export const DEFAULT_RUNTIME: RuntimeState = {
  version: 1,
  players: {},
  recentEvents: [],
  diagnostics: []
}

export const QUEUE_PRESETS = [
  { label: '单双排', value: 420 },
  { label: '灵活组排', value: 440 },
  { label: '匹配模式', value: 430 },
  { label: '极地大乱斗', value: 450 },
  { label: '快速匹配', value: 490 },
  { label: '斗魂竞技场', value: 1700 },
  { label: '无限火力', value: 900 },
  { label: '斗魂竞技场（双人）', value: 1750 },
  { label: '特殊模式 2400', value: 2400 }
]

