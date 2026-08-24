import { safeStorage } from 'electron'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { DEFAULT_CONFIG, DEFAULT_RUNTIME, MAX_INTERVAL_MS, MIN_INTERVAL_MS, newPlayerRuntime } from '@shared/defaults'
import type { AppConfig, RuntimeState, WebhookHeader } from '@shared/types'

const queueFilterSchema = z.object({
  mode: z.enum(['all', 'include']),
  queueIds: z.array(z.number().int().nonnegative()).max(100)
})
const policySchema = z.object({
  intervalMs: z.number().int().min(MIN_INTERVAL_MS).max(MAX_INTERVAL_MS),
  jitterMs: z.number().int().min(0).max(MAX_INTERVAL_MS),
  ongoing: queueFilterSchema,
  history: queueFilterSchema
})
const playerSchema = z.object({
  id: z.string().min(1), gameName: z.string().min(1).max(128), tagLine: z.string().min(1).max(32),
  puuid: z.string().min(8).max(128), serverId: z.string().min(1).max(32), enabled: z.boolean(),
  overridePolicy: policySchema.nullable(), createdAt: z.string()
})
const headerSchema = z.object({
  id: z.string().min(1), name: z.string().min(1).max(128), value: z.string().max(8_192),
  secret: z.boolean(), configured: z.boolean().optional()
})
const eventDeliverySchema = z.object({
  webhookEnabled: z.boolean(), webhookTemplate: z.string().min(1).max(64_000),
  notificationEnabled: z.boolean(), notificationTitle: z.string().max(256), notificationBody: z.string().max(1_024)
})
export const appConfigSchema = z.object({
  version: z.literal(1), globalPolicy: policySchema, players: z.array(playerSchema).max(500),
  webhook: z.object({ enabled: z.boolean(), url: z.string().max(2_048), headers: z.array(headerSchema).max(50), timeoutMs: z.number().int().min(1_000).max(60_000) }),
  events: z.object({ ongoing_game_detected: eventDeliverySchema, new_match_detected: eventDeliverySchema }),
  closeBehavior: z.enum(['ask', 'tray', 'quit']), selectedConnectionPid: z.number().int().positive().nullable()
})

const runtimePlayerSchema = z.object({
  seeded: z.boolean(), seenHistoryGameIds: z.array(z.string()).max(200), seenOngoingGameIds: z.array(z.string()).max(200),
  running: z.boolean(), lastRunAt: z.string().nullable(), nextRunAt: z.string().nullable(), lastError: z.string().nullable()
})
const watchEventSchema = z.object({
  schemaVersion: z.literal(1), eventId: z.string(), type: z.enum(['ongoing_game_detected', 'new_match_detected']), occurredAt: z.string(),
  player: z.object({ id: z.string(), gameName: z.string(), tagLine: z.string(), puuid: z.string(), serverId: z.string() }),
  game: z.object({ gameId: z.string(), queueId: z.number(), gameMode: z.string(), startedAt: z.string().nullable(), durationSeconds: z.number().optional() }),
  source: z.enum(['lcu-history', 'sgp-history', 'lcu-spectator+sgp-gsm', 'test']),
  deliveries: z.object({ webhook: z.enum(['sent', 'failed', 'disabled']).optional(), notification: z.enum(['sent', 'failed', 'disabled']).optional() }).optional()
})
const runtimeSchema = z.object({
  version: z.literal(1), players: z.record(z.string(), runtimePlayerSchema), recentEvents: z.array(watchEventSchema).max(100), diagnostics: z.array(z.string()).max(200)
})

interface StoredHeader extends Omit<WebhookHeader, 'value' | 'configured'> { value?: string; encryptedValue?: string }
interface StoredConfig extends Omit<AppConfig, 'webhook'> {
  webhook: Omit<AppConfig['webhook'], 'headers'> & { headers: StoredHeader[] }
}

async function readJson(file: string): Promise<unknown | null> {
  try { return JSON.parse(await readFile(file, 'utf8')) } catch { return null }
}

async function atomicJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true })
  const temp = `${file}.tmp`
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  try { await rename(temp, file) } catch {
    await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  }
}

export class ConfigStore {
  private readonly file: string
  private config: AppConfig = structuredClone(DEFAULT_CONFIG)

  constructor(userData: string) { this.file = path.join(userData, 'config.json') }

  async load(): Promise<void> {
    const raw = await readJson(this.file) as StoredConfig | null
    if (!raw) return
    const headers = (raw.webhook?.headers ?? []).map((header) => this.decodeHeader(header))
    const parsed = appConfigSchema.safeParse({ ...raw, webhook: { ...raw.webhook, headers } })
    if (parsed.success) this.config = parsed.data
  }

  get(): AppConfig {
    return {
      ...structuredClone(this.config),
      webhook: {
        ...this.config.webhook,
        headers: this.config.webhook.headers.map((header) => header.secret
          ? { ...header, value: '', configured: Boolean(header.value) }
          : { ...header, configured: Boolean(header.value) })
      }
    }
  }

  getPrivate(): AppConfig { return structuredClone(this.config) }

  async save(candidate: AppConfig): Promise<void> {
    const incoming = appConfigSchema.parse(candidate)
    const oldHeaders = new Map(this.config.webhook.headers.map((header) => [header.id, header]))
    incoming.webhook.headers = incoming.webhook.headers.map((header) => {
      if (header.secret && !header.value && header.configured) {
        const existing = oldHeaders.get(header.id)
        if (existing?.secret && existing.value) return { ...header, value: existing.value }
      }
      return header
    })
    this.config = incoming
    await this.persist()
  }

  private async persist(): Promise<void> {
    const stored: StoredConfig = {
      ...this.config,
      webhook: {
        ...this.config.webhook,
        headers: this.config.webhook.headers.map((header) => this.encodeHeader(header))
      }
    }
    await atomicJson(this.file, stored)
  }

  private encodeHeader(header: WebhookHeader): StoredHeader {
    const { value, ...base } = header
    delete base.configured
    if (!header.secret) return { ...base, value }
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows 安全存储当前不可用，无法保存敏感请求头')
    return { ...base, encryptedValue: safeStorage.encryptString(value).toString('base64') }
  }

  private decodeHeader(header: StoredHeader): WebhookHeader {
    if (!header.secret) return { ...header, value: header.value ?? '', configured: Boolean(header.value) }
    let value = ''
    if (header.encryptedValue && safeStorage.isEncryptionAvailable()) {
      try { value = safeStorage.decryptString(Buffer.from(header.encryptedValue, 'base64')) } catch { value = '' }
    }
    return { id: header.id, name: header.name, secret: true, value, configured: Boolean(value) }
  }
}

export class RuntimeStore {
  private readonly file: string
  private value: RuntimeState = structuredClone(DEFAULT_RUNTIME)
  private writeChain = Promise.resolve()

  constructor(userData: string) { this.file = path.join(userData, 'state.json') }

  async load(): Promise<void> {
    const parsed = runtimeSchema.safeParse(await readJson(this.file))
    if (parsed.success) {
      this.value = parsed.data
      for (const runtime of Object.values(this.value.players)) runtime.running = false
    }
  }

  get(): RuntimeState { return structuredClone(this.value) }

  player(id: string) {
    this.value.players[id] ??= newPlayerRuntime()
    return this.value.players[id]
  }

  removePlayer(id: string): void { delete this.value.players[id]; this.queueSave() }

  addDiagnostic(message: string): void {
    const sanitized = message.replace(/(--(?:remoting-auth-token|riotclient-auth-token)=)[^\s]+/gi, '$1[redacted]')
    this.value.diagnostics.unshift(`${new Date().toISOString()} ${sanitized}`)
    this.value.diagnostics = this.value.diagnostics.slice(0, 200)
    this.queueSave()
  }

  addEvent(event: RuntimeState['recentEvents'][number]): void {
    this.value.recentEvents.unshift(event)
    this.value.recentEvents = this.value.recentEvents.slice(0, 100)
    this.queueSave()
  }

  queueSave(): void {
    this.writeChain = this.writeChain.then(() => atomicJson(this.file, this.value)).catch(() => undefined)
  }

  async flush(): Promise<void> { this.queueSave(); await this.writeChain }
}
