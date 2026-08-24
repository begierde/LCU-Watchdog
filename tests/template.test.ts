import { describe, expect, it } from 'vitest'
import { renderJsonTemplate, renderTextTemplate } from '@main/template'
import type { WatchEvent } from '@shared/types'

const event: WatchEvent = {
  schemaVersion: 1, eventId: 'event-1', type: 'new_match_detected', occurredAt: '2026-08-24T00:00:00.000Z',
  player: { id: 'player-1', gameName: 'Silver "Fox"', tagLine: 'JP1', puuid: 'puuid', serverId: 'JP' },
  game: { gameId: '99', queueId: 440, gameMode: 'CLASSIC', startedAt: null }, source: 'lcu-history'
}

const testEvent: WatchEvent = { ...event, source: 'test' }

describe('event templates', () => {
  it('renders text variables', () => expect(renderTextTemplate('{{playerRiotId}} / {{queueId}}', event)).toBe('Silver "Fox"#JP1 / 440'))
  it('renders the full event JSON', () => expect(renderJsonTemplate('{{eventJson}}', event)).toMatchObject({ eventId: 'event-1' }))
  it('escapes variables inside JSON strings', () => expect(renderJsonTemplate('{"player":"{{playerRiotId}}","queue":{{queueId}}}', event)).toEqual({ player: 'Silver "Fox"#JP1', queue: 440 }))
  it('supports variables mixed with text inside JSON strings', () => expect(renderJsonTemplate('{"title":"{{playerRiotId}} 有新对局"}', event)).toEqual({ title: 'Silver "Fox"#JP1 有新对局' }))
  it('uses only synthetic Chinese values for test events', () => {
    expect(renderTextTemplate('{{playerRiotId}} / {{queueId}} / {{serverId}}', testEvent)).toBe('测试#测试 / 测试 / 测试')
    expect(renderJsonTemplate('{{eventJson}}', testEvent)).toMatchObject({
      eventId: '测试',
      type: '测试',
      player: { gameName: '测试', tagLine: '测试', riotId: '测试#测试', puuid: '测试', serverId: '测试' },
      game: { gameId: '测试', queueId: '测试', gameMode: '测试', startedAt: '测试' },
      source: '测试'
    })
  })
  it('rejects unknown variables', () => expect(() => renderJsonTemplate('{"x":{{missing}}}', event)).toThrow('未知模板变量'))
})
