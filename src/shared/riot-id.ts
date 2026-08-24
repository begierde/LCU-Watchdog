export interface ParsedRiotId {
  gameName: string
  tagLine: string
}

export function parseRiotId(value: string): ParsedRiotId | null {
  const normalized = value.trim()
  const separator = normalized.lastIndexOf('#')
  if (separator <= 0 || separator >= normalized.length - 1) return null

  const gameName = normalized.slice(0, separator).trim()
  const tagLine = normalized.slice(separator + 1).trim()
  return gameName && tagLine ? { gameName, tagLine } : null
}
