import type { WatchEvent } from '@shared/types'

export function eventVariables(event: WatchEvent): Record<string, unknown> {
  return {
    schemaVersion: event.schemaVersion,
    eventId: event.eventId,
    eventType: event.type,
    occurredAt: event.occurredAt,
    playerId: event.player.id,
    playerGameName: event.player.gameName,
    playerTagLine: event.player.tagLine,
    playerRiotId: `${event.player.gameName}#${event.player.tagLine}`,
    playerPuuid: event.player.puuid,
    serverId: event.player.serverId,
    gameId: event.game.gameId,
    queueId: event.game.queueId,
    gameMode: event.game.gameMode,
    gameStartedAt: event.game.startedAt ?? '',
    eventJson: event
  }
}

export function renderTextTemplate(template: string, event: WatchEvent): string {
  const variables = eventVariables(event)
  return template.replace(/{{\s*([A-Za-z0-9_]+)\s*}}/g, (_token, name: string) => {
    const value = variables[name]
    return value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
  })
}

export function renderJsonTemplate(template: string, event: WatchEvent): unknown {
  const variables = eventVariables(event)
  const rendered = template.replace(/{{\s*([A-Za-z0-9_]+)\s*}}/g, (token, name: string, offset: number) => {
    if (!(name in variables)) throw new Error(`未知模板变量 ${token}`)
    const serialized = JSON.stringify(variables[name])
    const before = template[offset - 1]
    const after = template[offset + token.length]
    if (before === '"' && after === '"') return serialized.slice(1, -1)
    return serialized
  })
  return JSON.parse(rendered)
}

