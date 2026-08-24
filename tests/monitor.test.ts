import { describe, expect, it } from 'vitest'
import { DEFAULT_POLICY, newPlayerRuntime } from '@shared/defaults'
import { nextDelay, queueMatches, reconcileHistory } from '@main/monitor-service'
import type { MatchInfo } from '@shared/types'

const match = (gameId: string, queueId: number): MatchInfo => ({ gameId, queueId, gameMode: 'CLASSIC', startedAt: null })

describe('monitor policy', () => {
  it('uses only positive jitter', () => {
    expect(nextDelay(DEFAULT_POLICY, () => 0)).toBe(300_000)
    expect(nextDelay(DEFAULT_POLICY, () => 0.999999)).toBeGreaterThanOrEqual(359_999)
  })

  it('filters queues', () => {
    expect(queueMatches(440, { mode: 'include', queueIds: [440] })).toBe(true)
    expect(queueMatches(420, { mode: 'include', queueIds: [440] })).toBe(false)
    expect(queueMatches(420, { mode: 'all', queueIds: [] })).toBe(true)
  })

  it('seeds silently, then returns only unseen matching history', () => {
    const runtime = newPlayerRuntime()
    expect(reconcileHistory(runtime, [match('2', 440), match('1', 420)], 'JP', { mode: 'include', queueIds: [440] })).toEqual([])
    expect(reconcileHistory(runtime, [match('3', 440), match('2', 440)], 'JP', { mode: 'include', queueIds: [440] })).toEqual([match('3', 440)])
    expect(reconcileHistory(runtime, [match('3', 440), match('2', 440)], 'JP', { mode: 'include', queueIds: [440] })).toEqual([])
  })
})

