import { describe, expect, it } from 'vitest'
import { describeOngoingError, normalizeChatPresence, normalizeGsmOngoing, normalizeMatches } from '@main/game-data'
import { HttpStatusError } from '@main/lcu/http'

describe('match history normalization', () => {
  it('normalizes LCU history', () => {
    expect(normalizeMatches({ games: { games: [{ gameId: 42, queueId: 440, gameMode: 'CLASSIC', gameCreation: 1_700_000_000_000 }] } })[0])
      .toMatchObject({ gameId: '42', queueId: 440, gameMode: 'CLASSIC' })
  })

  it('normalizes SGP summary history', () => {
    expect(normalizeMatches({ games: [{ metadata: { match_id: 'JP1_99' }, json: { gameId: 99, queueId: 420, gameMode: 'CLASSIC' } }] })[0])
      .toMatchObject({ gameId: '99', queueId: 420 })
  })

  it('adds the monitored player performance to match history', () => {
    const match = normalizeMatches({ games: { games: [{
      gameId: 100,
      queueId: 440,
      participantIdentities: [{ participantId: 2, player: { puuid: 'target-puuid' } }],
      participants: [{ participantId: 2, championId: 22, championName: 'Ashe', stats: { win: true, kills: 8, deaths: 2, assists: 11 } }]
    }] } }, 'target-puuid')[0]

    expect(match).toMatchObject({ championId: 22, championName: 'Ashe', win: true, kills: 8, deaths: 2, assists: 11 })
  })

  it('normalizes an in-game friend presence', () => {
    expect(normalizeChatPresence([{ puuid: 'target', lol: {
      gameStatus: 'inGame', gameId: '123', queueId: '440', gameMode: 'CLASSIC', timestamp: '1700000000000'
    } }], 'target')).toMatchObject({ gameId: '123', queueId: 440, gameMode: 'CLASSIC' })
    expect(normalizeChatPresence([{ puuid: 'target', lol: { gameStatus: 'outOfGame' } }], 'target')).toBeNull()
  })

  it('normalizes a GSM ongoing game', () => {
    expect(normalizeGsmOngoing({ playerCredentials: {
      gameId: 456, queueId: 440, gameMode: 'CLASSIC', gameCreateDate: 1_700_000_000_000
    } })).toMatchObject({ gameId: '456', queueId: 440, gameMode: 'CLASSIC' })
  })

  it('turns a filtered spectator response into an actionable message', () => {
    const error = new HttpStatusError(500, { message: 'failureCode 410 GONE implementationDetails filtered' })
    expect(describeOngoingError(error)).toContain('Spectator 已过滤')
  })
})
