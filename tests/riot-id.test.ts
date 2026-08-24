import { describe, expect, it } from 'vitest'
import { parseRiotId } from '../src/shared/riot-id'

describe('parseRiotId', () => {
  it('parses a complete Riot ID with a Unicode tag', () => {
    expect(parseRiotId('sweets#7すき')).toEqual({ gameName: 'sweets', tagLine: '7すき' })
  })

  it('trims whitespace around the Riot ID parts', () => {
    expect(parseRiotId('  Player Name # JP1  ')).toEqual({ gameName: 'Player Name', tagLine: 'JP1' })
  })

  it('uses the final separator', () => {
    expect(parseRiotId('name#part#TAG')).toEqual({ gameName: 'name#part', tagLine: 'TAG' })
  })

  it.each(['', 'sweets', '#JP1', 'sweets#', '  #  '])('rejects incomplete Riot ID %j', (value) => {
    expect(parseRiotId(value)).toBeNull()
  })
})
