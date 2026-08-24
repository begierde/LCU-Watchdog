import type { WatchdogApi } from '@shared/types'

declare global {
  interface Window { watchdog: WatchdogApi }
}

export {}
