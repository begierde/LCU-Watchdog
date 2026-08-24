import type { WatchEvent } from '@shared/types'

export function eventVariables(event: WatchEvent): Record<string, unknown> {
  if (event.source === 'test') {
    const testEventJson = {
      schemaVersion: '测试',
      eventId: '测试',
      type: '测试',
      occurredAt: '测试',
      player: {
        id: '测试',
        gameName: '测试',
        tagLine: '测试',
        riotId: '测试#测试',
        puuid: '测试',
        serverId: '测试'
      },
      game: {
        gameId: '测试',
        queueId: '测试',
        gameMode: '测试',
        startedAt: '测试',
        durationSeconds: '测试'
      },
      source: '测试'
    }

    return {
      schemaVersion: '测试',
      eventId: '测试',
      eventType: '测试',
      occurredAt: '测试',
      playerId: '测试',
      playerGameName: '测试',
      playerTagLine: '测试',
      playerRiotId: '测试#测试',
      playerPuuid: '测试',
      serverId: '测试',
      gameId: '测试',
      queueId: '测试',
      gameMode: '测试',
      gameStartedAt: '测试',
      eventJson: testEventJson
    }
  }

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
    if (isInsideJsonString(template, offset)) return JSON.stringify(String(variables[name])).slice(1, -1)
    return serialized
  })
  return JSON.parse(rendered)
}

function isInsideJsonString(source: string, offset: number): boolean {
  let inside = false
  let escaped = false
  for (let index = 0; index < offset; index++) {
    const char = source[index]
    if (escaped) { escaped = false; continue }
    if (char === '\\') { escaped = true; continue }
    if (char === '"') inside = !inside
  }
  return inside
}
