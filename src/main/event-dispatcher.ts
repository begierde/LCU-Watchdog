import { Notification } from 'electron'
import type { AppConfig, TestEventRequest, WatchEvent } from '@shared/types'
import type { ConfigStore, RuntimeStore } from './persistence'
import { renderJsonTemplate, renderTextTemplate } from './template'

const RETRY_DELAYS = [1_000, 5_000, 15_000]
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
class NonRetryableWebhookError extends Error {}

export class EventDispatcher {
  constructor(
    private readonly configStore: ConfigStore,
    private readonly runtimeStore: RuntimeStore,
    private readonly onChange: () => void,
    private readonly onNotificationClick: (playerId: string) => void
  ) {}

  async dispatch(event: WatchEvent, only?: TestEventRequest['channel']): Promise<WatchEvent> {
    const config = this.configStore.getPrivate()
    const delivery = config.events[event.type]
    const result = structuredClone(event)
    result.deliveries = {}

    if (only !== 'notification' && config.webhook.enabled && delivery.webhookEnabled) {
      try {
        await this.sendWebhook(config, event)
        result.deliveries.webhook = 'sent'
      } catch (error) {
        result.deliveries.webhook = 'failed'
        this.runtimeStore.addDiagnostic(`Webhook 发送失败：${error instanceof Error ? error.message : String(error)}`)
      }
    } else result.deliveries.webhook = 'disabled'

    if (only !== 'webhook' && delivery.notificationEnabled) {
      try {
        this.sendNotification(delivery.notificationTitle, delivery.notificationBody, event)
        result.deliveries.notification = 'sent'
      } catch (error) {
        result.deliveries.notification = 'failed'
        this.runtimeStore.addDiagnostic(`Windows 通知失败：${error instanceof Error ? error.message : String(error)}`)
      }
    } else result.deliveries.notification = 'disabled'

    this.runtimeStore.addEvent(result)
    this.onChange()
    return result
  }

  private async sendWebhook(config: AppConfig, event: WatchEvent): Promise<void> {
    if (!config.webhook.url) throw new Error('Webhook URL 为空')
    const body = JSON.stringify(renderJsonTemplate(config.events[event.type].webhookTemplate, event))
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    for (const header of config.webhook.headers) if (header.name && header.value) headers[header.name] = header.value

    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), config.webhook.timeoutMs)
      try {
        const response = await fetch(config.webhook.url, { method: 'POST', headers, body, signal: controller.signal })
        if (response.ok) return
        const retryable = response.status === 408 || response.status === 429 || response.status >= 500
        if (!retryable) throw new NonRetryableWebhookError(`HTTP ${response.status}`)
        if (attempt >= RETRY_DELAYS.length) throw new Error(`HTTP ${response.status}`)
      } catch (error) {
        if (error instanceof NonRetryableWebhookError) throw error
        if (attempt >= RETRY_DELAYS.length) throw error
      } finally { clearTimeout(timeout) }
      await delay(RETRY_DELAYS[attempt]!)
    }
  }

  private sendNotification(titleTemplate: string, bodyTemplate: string, event: WatchEvent): void {
    if (!Notification.isSupported()) throw new Error('当前系统不支持应用通知')
    const notification = new Notification({
      title: renderTextTemplate(titleTemplate, event),
      body: renderTextTemplate(bodyTemplate, event),
      silent: false
    })
    notification.on('click', () => this.onNotificationClick(event.player.id))
    notification.show()
  }
}
