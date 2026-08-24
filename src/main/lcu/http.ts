import https from 'node:https'
import type { PrivateLcuConnection } from '@shared/types'
import { RIOT_CERTIFICATE } from './certificate'

export class HttpStatusError extends Error {
  constructor(public readonly status: number, public readonly body: unknown) {
    super(`HTTP ${status}`)
  }
}

export interface LocalRequestOptions {
  method?: 'GET' | 'POST'
  body?: unknown
  riotClient?: boolean
  timeoutMs?: number
}

export function requestLocalJson<T>(connection: PrivateLcuConnection, pathname: string, options: LocalRequestOptions = {}): Promise<T> {
  const port = options.riotClient ? connection.riotClientPort : connection.port
  const token = options.riotClient ? connection.riotClientAuthToken : connection.authToken
  if (!port || !token) return Promise.reject(new Error('本地客户端端口或令牌不可用'))
  const body = options.body === undefined ? undefined : JSON.stringify(options.body)

  return new Promise<T>((resolve, reject) => {
    const request = https.request({
      hostname: '127.0.0.1',
      port,
      path: pathname,
      method: options.method ?? 'GET',
      auth: `riot:${token}`,
      timeout: options.timeoutMs ?? 8_000,
      ca: RIOT_CERTIFICATE,
      rejectUnauthorized: true,
      checkServerIdentity: () => undefined,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {})
      }
    }, (response) => {
      const chunks: Buffer[] = []
      response.on('data', (chunk: Buffer) => chunks.push(chunk))
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        let data: unknown = null
        if (text) {
          try { data = JSON.parse(text) } catch { data = text }
        }
        const status = response.statusCode ?? 0
        if (status >= 200 && status < 300) resolve(data as T)
        else reject(new HttpStatusError(status, data))
      })
    })
    request.once('timeout', () => request.destroy(new Error('本地客户端请求超时')))
    request.once('error', reject)
    if (body) request.write(body)
    request.end()
  })
}
