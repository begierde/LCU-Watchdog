import { describe, expect, it } from 'vitest'
import { assertServerChanSuccess, buildServerChanRequest } from '@main/serverchan'
import type { WatchEvent } from '@shared/types'

const event: WatchEvent = {
  schemaVersion: 1, eventId: 'event-1', type: 'new_match_detected', occurredAt: '2026-08-25T00:00:00.000Z',
  player: { id: 'player-1', gameName: 'Player', tagLine: 'JP1', puuid: 'puuid', serverId: 'JP' },
  game: { gameId: '99', queueId: 440, gameMode: 'CLASSIC', startedAt: null }, source: 'lcu-history'
}

describe('ServerChan webhook', () => {
  it('builds the Turbo endpoint and payload', () => {
    const request = buildServerChanRequest('SCT_test-key', '{"title":"{{playerRiotId}} 新对局","desp":"队列 {{queueId}}"}', event)
    expect(request.url).toBe('https://sctapi.ftqq.com/SCT_test-key.send')
    expect(JSON.parse(request.body)).toEqual({ title: 'Player#JP1 新对局', desp: '队列 440' })
  })

  it('enforces the 32-character title limit', () => {
    const request = buildServerChanRequest('SCT_key', `{"title":"${'x'.repeat(40)}","desp":""}`, event)
    expect(JSON.parse(request.body).title).toHaveLength(32)
  })

  it('requires a valid success response', () => {
    expect(() => assertServerChanSuccess('{"code":0}')).not.toThrow()
    expect(() => assertServerChanSuccess('{"code":1}')).toThrow('Server酱拒绝了推送请求')
    expect(() => assertServerChanSuccess('not-json')).toThrow('Server酱返回了无效 JSON')
  })
})
