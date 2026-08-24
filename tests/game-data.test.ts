import { describe, expect, it } from 'vitest'
import { normalizeMatches } from '@main/game-data'

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
})
