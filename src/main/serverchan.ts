import type { WatchEvent } from '@shared/types'
import { renderJsonTemplate } from './template'

export function buildServerChanRequest(sendKeyValue: string, template: string, event: WatchEvent) {
  const sendKey = sendKeyValue.trim()
  if (!sendKey) throw new Error('Server酱 SendKey 为空')
  if (!/^SCT[0-9A-Za-z_-]+$/.test(sendKey)) throw new Error('Server酱 SendKey 格式不正确')

  const rendered = renderJsonTemplate(template, event)
  if (!rendered || typeof rendered !== 'object' || Array.isArray(rendered)) throw new Error('Server酱模板必须是 JSON 对象')
  const payload = rendered as Record<string, unknown>
  const title = String(payload.title ?? '').trim()
  if (!title) throw new Error('Server酱模板缺少 title')

  return {
    url: `https://sctapi.ftqq.com/${encodeURIComponent(sendKey)}.send`,
    body: JSON.stringify({ ...payload, title: title.slice(0, 32), desp: String(payload.desp ?? '') })
  }
}

export function assertServerChanSuccess(responseText: string): void {
  let result: unknown = null
  try { result = responseText ? JSON.parse(responseText) : null } catch { throw new Error('Server酱返回了无效 JSON') }
  if ((result as { code?: unknown } | null)?.code !== 0) throw new Error('Server酱拒绝了推送请求')
}
