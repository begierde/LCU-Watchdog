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
  it('renders specific queue names instead of the raw CLASSIC mode', () => {
    expect(renderTextTemplate('{{playerRiotId}} / {{gameMode}} / {{queueName}} / {{queueId}}', event))
      .toBe('Silver "Fox"#JP1 / 灵活组排 / 灵活组排 / 440')
  })
  it.each([[420, '单双排'], [440, '灵活组排'], [2400, '极地大乱斗：混沌']])('maps queue %s to %s', (queueId, expected) => {
    expect(renderTextTemplate('{{gameMode}}', { ...event, game: { ...event.game, queueId } })).toBe(expected)
  })
  it('labels unknown CLASSIC queues as special modes', () => {
    expect(renderTextTemplate('{{gameMode}}', { ...event, game: { ...event.game, queueId: 9999 } })).toBe('特殊模式（队列 9999）')
  })
  it('enriches the full event JSON with readable and raw mode names', () => {
    expect(renderJsonTemplate('{{eventJson}}', event)).toMatchObject({
      eventId: 'event-1',
      game: { queueId: 440, queueName: '灵活组排', gameMode: '灵活组排', rawGameMode: 'CLASSIC' }
    })
  })
  it('escapes variables inside JSON strings', () => expect(renderJsonTemplate('{"player":"{{playerRiotId}}","queue":{{queueId}}}', event)).toEqual({ player: 'Silver "Fox"#JP1', queue: 440 }))
  it('supports variables mixed with text inside JSON strings', () => expect(renderJsonTemplate('{"title":"{{playerRiotId}} 有新对局"}', event)).toEqual({ title: 'Silver "Fox"#JP1 有新对局' }))
  it('uses only synthetic Chinese values for test events', () => {
    expect(renderTextTemplate('{{playerRiotId}} / {{queueId}} / {{queueName}} / {{gameMode}} / {{serverId}}', testEvent)).toBe('测试#测试 / 测试 / 测试 / 测试 / 测试')
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
