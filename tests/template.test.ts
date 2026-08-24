import { describe, expect, it } from 'vitest'
import { renderJsonTemplate, renderTextTemplate } from '@main/template'
import type { WatchEvent } from '@shared/types'

const event: WatchEvent = {
  schemaVersion: 1, eventId: 'event-1', type: 'new_match_detected', occurredAt: '2026-08-24T00:00:00.000Z',
  player: { id: 'player-1', gameName: 'Silver "Fox"', tagLine: 'JP1', puuid: 'puuid', serverId: 'JP' },
  game: { gameId: '99', queueId: 440, gameMode: 'CLASSIC', startedAt: null }, source: 'lcu-history'
}

describe('event templates', () => {
  it('renders text variables', () => expect(renderTextTemplate('{{playerRiotId}} / {{queueId}}', event)).toBe('Silver "Fox"#JP1 / 440'))
  it('renders the full event JSON', () => expect(renderJsonTemplate('{{eventJson}}', event)).toMatchObject({ eventId: 'event-1' }))
  it('escapes variables inside JSON strings', () => expect(renderJsonTemplate('{"player":"{{playerRiotId}}","queue":{{queueId}}}', event)).toEqual({ player: 'Silver "Fox"#JP1', queue: 440 }))
  it('rejects unknown variables', () => expect(() => renderJsonTemplate('{"x":{{missing}}}', event)).toThrow('未知模板变量'))
})

