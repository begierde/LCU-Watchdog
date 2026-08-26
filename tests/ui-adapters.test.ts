import { describe, expect, it } from 'vitest'
import type { PlayerRuntimeState, PlayerTarget } from '../src/shared/types'
import {
  closePlayerTab,
  eventSourceDisplayName,
  openPlayerTab,
  playerUiStatus,
  queueDisplayName,
  recoverableErrorSummary,
  type PlayerTabState
} from '../src/renderer/src/ui-adapters'

const player = (enabled = true): PlayerTarget => ({
  id: 'p1', gameName: '测试', tagLine: 'JP1', puuid: 'puuid', serverId: 'JP', enabled,
  overridePolicy: null, createdAt: '2026-08-25T00:00:00.000Z'
})

const runtime = (patch: Partial<PlayerRuntimeState> = {}): PlayerRuntimeState => ({
  seeded: true, seenHistoryGameIds: [], seenOngoingGameIds: [], recentMatches: [], running: false,
  lastRunAt: null, nextRunAt: null, lastError: null, presence: 'unknown', presenceUpdatedAt: null, ...patch
})

describe('UI display adapters', () => {
  it('maps observed queues and falls back consistently', () => {
    expect(queueDisplayName(400)).toBe('普通征召')
    expect(queueDisplayName(440)).toBe('灵活组排')
    expect(queueDisplayName(710)).toBe('特殊模式')
    expect(queueDisplayName(2400)).toBe('极地大乱斗：混沌')
    expect(queueDisplayName(9999)).toBe('队列 9999')
  })

  it('localizes event sources', () => {
    expect(eventSourceDisplayName('lcu-chat-presence')).toBe('客户端好友状态')
    expect(eventSourceDisplayName('sgp-history')).toBe('SGP 历史')
  })

  it('prioritizes running, paused and recoverable restriction states', () => {
    expect(playerUiStatus(player(), runtime({ running: true }))).toBe('running')
    expect(playerUiStatus(player(false), runtime())).toBe('paused')
    expect(playerUiStatus(player(), runtime({ lastError: 'spectator forbidden' }))).toBe('restricted')
    expect(playerUiStatus(player(), runtime({ presence: 'offline' }))).toBe('offline')
    expect(playerUiStatus(player(), runtime({ presence: 'online' }))).toBe('online')
    expect(playerUiStatus(player(), runtime({ presence: 'in_game' }))).toBe('in_game')
    expect(playerUiStatus(player(), runtime({ seeded: false }))).toBe('waiting')
    expect(recoverableErrorSummary('HTTP 429')).toContain('频率受限')
  })
})

describe('session player tabs', () => {
  it('opens tabs once and tracks most recent use', () => {
    let state: PlayerTabState = { openIds: [], recentIds: [], activeId: null }
    state = openPlayerTab(state, 'p1')
    state = openPlayerTab(state, 'p2')
    state = openPlayerTab(state, 'p1')
    expect(state.openIds).toEqual(['p1', 'p2'])
    expect(state.recentIds).toEqual(['p1', 'p2'])
    expect(state.activeId).toBe('p1')
  })

  it('falls back to the most recently used remaining player', () => {
    const state = closePlayerTab({ openIds: ['p1', 'p2', 'p3'], recentIds: ['p2', 'p3', 'p1'], activeId: 'p2' }, 'p2')
    expect(state.activeId).toBe('p3')
    expect(state.openIds).toEqual(['p1', 'p3'])
  })
})
