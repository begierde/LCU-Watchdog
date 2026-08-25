import type { CSSProperties } from 'vue'
import type { GlobalThemeOverrides } from 'naive-ui'

export const uiTokens = {
  background: '#1D1A27',
  chrome: '#211E2D',
  surface: '#292534',
  surfaceElevated: '#302B3E',
  border: '#403A50',
  primary: '#7356C5',
  primaryHover: '#8467D5',
  primaryPressed: '#6247AE',
  accent: '#D13F73',
  success: '#59D1AD',
  warning: '#E0A15C',
  error: '#E36C75',
  text: '#F3EFF7',
  textMuted: '#B9B1C3',
  textSubtle: '#91899C'
} as const

export const cssThemeVariables: CSSProperties = {
  '--ui-background': uiTokens.background,
  '--ui-chrome': uiTokens.chrome,
  '--ui-surface': uiTokens.surface,
  '--ui-surface-elevated': uiTokens.surfaceElevated,
  '--ui-border': uiTokens.border,
  '--ui-primary': uiTokens.primary,
  '--ui-primary-hover': uiTokens.primaryHover,
  '--ui-primary-pressed': uiTokens.primaryPressed,
  '--ui-accent': uiTokens.accent,
  '--ui-success': uiTokens.success,
  '--ui-warning': uiTokens.warning,
  '--ui-error': uiTokens.error,
  '--ui-text': uiTokens.text,
  '--ui-text-muted': uiTokens.textMuted,
  '--ui-text-subtle': uiTokens.textSubtle
} as CSSProperties

export const naiveThemeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: uiTokens.primary,
    primaryColorHover: uiTokens.primaryHover,
    primaryColorPressed: uiTokens.primaryPressed,
    primaryColorSuppl: uiTokens.primary,
    bodyColor: uiTokens.background,
    cardColor: uiTokens.surface,
    modalColor: uiTokens.surfaceElevated,
    popoverColor: uiTokens.surfaceElevated,
    inputColor: uiTokens.chrome,
    actionColor: uiTokens.surfaceElevated,
    hoverColor: '#FFFFFF0A',
    textColorBase: uiTokens.text,
    textColor1: uiTokens.text,
    textColor2: uiTokens.textMuted,
    textColor3: uiTokens.textSubtle,
    borderColor: uiTokens.border,
    dividerColor: uiTokens.border,
    borderRadius: '6px',
    fontFamily: '"Segoe UI Variable", "Microsoft YaHei UI", "Segoe UI", sans-serif'
  },
  Button: { borderRadiusMedium: '6px', borderRadiusSmall: '6px', fontWeight: '600' },
  Card: { borderRadius: '12px' },
  Modal: { borderRadius: '12px' },
  Tag: { borderRadius: '5px' }
}
