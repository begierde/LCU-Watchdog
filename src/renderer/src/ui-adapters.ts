import type { PlayerRuntimeState, PlayerTarget, WatchEvent } from '@shared/types'
export { queueDisplayName } from '@shared/queues'

export type PrimaryPage = 'overview' | 'players' | 'settings'
export type SettingsSection = 'monitoring' | 'events' | 'application'
export type PlayerUiStatus = 'running' | 'restricted' | 'in_game' | 'online' | 'offline' | 'watching' | 'paused' | 'waiting'

export interface PlayerTabState {
  openIds: string[]
  recentIds: string[]
  activeId: string | null
}

const sourceNames: Record<WatchEvent['source'], string> = {
  'lcu-history': 'LCU 历史',
  'sgp-history': 'SGP 历史',
  'lcu-chat-presence': '客户端好友状态',
  'lcu-spectator+sgp-gsm': 'LCU 观战 / SGP',
  'sgp-gsm': 'SGP 实时状态',
  test: '测试事件'
}

export function eventSourceDisplayName(source: WatchEvent['source']): string {
  return sourceNames[source]
}

export function playerUiStatus(player: PlayerTarget, runtime: PlayerRuntimeState): PlayerUiStatus {
  if (runtime.running) return 'running'
  if (!player.enabled) return 'paused'
  if (runtime.lastError) return 'restricted'
  if (runtime.presence === 'in_game') return 'in_game'
  if (runtime.presence === 'online') return 'online'
  if (runtime.presence === 'offline') return 'offline'
  if (runtime.seeded) return 'watching'
  return 'waiting'
}

export function recoverableErrorSummary(error: string | null): string | null {
  if (!error) return null
  if (/401|unauthor|forbidden|好友|spectat|观战/i.test(error)) return '实时状态受限，历史记录监视正常'
  if (/429|rate|限流/i.test(error)) return '查询频率受限，将自动重试'
  if (/offline|client|connection|连接|登录/i.test(error)) return '客户端暂不可用，将自动恢复'
  return '本次查询受限，将按计划重试'
}

export function openPlayerTab(state: PlayerTabState, playerId: string): PlayerTabState {
  return {
    openIds: state.openIds.includes(playerId) ? state.openIds : [...state.openIds, playerId],
    recentIds: [playerId, ...state.recentIds.filter((id) => id !== playerId)],
    activeId: playerId
  }
}

export function closePlayerTab(state: PlayerTabState, playerId: string): PlayerTabState {
  const openIds = state.openIds.filter((id) => id !== playerId)
  const recentIds = state.recentIds.filter((id) => id !== playerId)
  const activeId = state.activeId === playerId
    ? (recentIds.find((id) => openIds.includes(id)) ?? null)
    : state.activeId
  return { openIds, recentIds, activeId }
}
