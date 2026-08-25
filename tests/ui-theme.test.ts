import { describe, expect, it } from 'vitest'
import { uiTokens } from '../src/renderer/src/ui-theme'

function luminance(hex: string): number {
  const channels = hex.slice(1).match(/.{2}/g)!.map((value) => {
    const channel = Number.parseInt(value, 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
}

function contrast(first: string, second: string): number {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a)
  return (values[0]! + 0.05) / (values[1]! + 0.05)
}

describe('UI theme contrast', () => {
  it('keeps primary button text above WCAG AA', () => {
    expect(contrast(uiTokens.text, uiTokens.primary)).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps ordinary text readable on the main surface', () => {
    expect(contrast(uiTokens.textMuted, uiTokens.surface)).toBeGreaterThanOrEqual(4.5)
  })
})
