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
})

