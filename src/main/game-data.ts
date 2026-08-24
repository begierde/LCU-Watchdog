import { getServer, regionPath } from '@shared/servers'
import type { MatchInfo, PlayerDraft, PrivateLcuConnection } from '@shared/types'
import { HttpStatusError, requestLocalJson } from './lcu/http'

interface SessionTokens { pid: number; entitlement: string; leagueSession: string }
interface AliasResult { puuid: string; alias?: { game_name?: string; tag_line?: string } }

export class GameDataClient {
  private tokens: SessionTokens | null = null
  private readonly spectator: SpectatorBatcher

  constructor(private readonly getConnection: () => PrivateLcuConnection | null) {
    this.spectator = new SpectatorBatcher(getConnection)
  }

  async resolvePlayer(draft: PlayerDraft): Promise<{ puuid: string; gameName: string; tagLine: string }> {
    const connection = this.requireConnection()
    const currentServer = getServer(connection.serverId)
    const targetServer = getServer(draft.serverId)
    if (!targetServer) throw new Error(`不支持服务器 ${draft.serverId}`)
    if (targetServer.id !== currentServer?.id && !(targetServer.isTencent && currentServer?.isTencent)) {
      throw new Error('国际服只能添加当前客户端所在服务器的玩家')
    }

    let puuid = draft.puuid?.trim() ?? ''
    let gameName = draft.gameName.trim()
    let tagLine = draft.tagLine.trim()
    if (!puuid) {
      if (!gameName || !tagLine) throw new Error('请输入完整 Riot ID（名称和标签）')
      const params = new URLSearchParams({ gameName, tagLine })
      const aliases = await requestLocalJson<AliasResult[]>(connection, `/player-account/aliases/v1/lookup?${params}`, { riotClient: true })
      const alias = aliases[0]
      if (!alias?.puuid) throw new Error('没有找到这个 Riot ID')
      puuid = alias.puuid
      gameName = alias.alias?.game_name || gameName
      tagLine = alias.alias?.tag_line || tagLine
    }

    if (targetServer.id === currentServer?.id) {
      await requestLocalJson(connection, `/lol-summoner/v2/summoners/puuid/${encodeURIComponent(puuid)}`)
    } else {
      const summoners = await this.requestSgp<unknown[]>(targetServer.id, 'league-session', '/summoner-ledge/v1/regions/{region}/summoners/puuids', {
        method: 'POST', body: [puuid]
      })
      if (!summoners.length) throw new Error('该玩家不在所选腾讯大区')
    }
    return { puuid, gameName: gameName || 'PUUID', tagLine: tagLine || puuid.slice(0, 6) }
  }

  async getHistory(puuid: string, serverId: string): Promise<{ source: 'lcu-history' | 'sgp-history'; matches: MatchInfo[] }> {
    const connection = this.requireConnection()
    if (serverId === connection.serverId) {
      const params = new URLSearchParams({ begIndex: '0', endIndex: '19' })
      const data = await requestLocalJson<unknown>(connection, `/lol-match-history/v1/products/lol/${encodeURIComponent(puuid)}/matches?${params}`)
      return { source: 'lcu-history', matches: normalizeMatches(data).slice(0, 20) }
    }
    this.ensureCrossRegionAllowed(connection.serverId, serverId)
    const data = await this.requestSgp<unknown>(serverId, 'entitlement', `/match-history-query/v1/products/lol/player/${encodeURIComponent(puuid)}/SUMMARY?startIndex=0&count=20`)
    return { source: 'sgp-history', matches: normalizeMatches(data).slice(0, 20) }
  }

  async getOngoing(puuid: string, serverId: string): Promise<MatchInfo | null> {
    const connection = this.requireConnection()
    if (serverId !== connection.serverId) return null
    if (!(await this.spectator.isAvailable(puuid))) return null
    try {
      const data = await this.requestSgp<any>(serverId, 'league-session', `/gsm/v1/ledge/region/{region}/puuid/${encodeURIComponent(puuid)}`)
      const credentials = data?.playerCredentials ?? {}
      const game = data?.game ?? {}
      const gameId = String(credentials.gameId ?? game.id ?? '')
      if (!gameId) return null
      const created = Number(credentials.gameCreateDate ?? 0)
      return {
        gameId,
        queueId: Number(credentials.queueId ?? game.gameQueueConfigId ?? 0),
        gameMode: String(credentials.gameMode ?? game.gameMode ?? ''),
        startedAt: created > 0 ? new Date(created).toISOString() : null
      }
    } catch (error) {
      if (error instanceof HttpStatusError && error.status === 404) return null
      throw error
    }
  }

  invalidateTokens(): void { this.tokens = null }

  private requireConnection(): PrivateLcuConnection {
    const connection = this.getConnection()
    if (!connection) throw new Error('League Client 尚未连接')
    return connection
  }

  private ensureCrossRegionAllowed(currentId: string, targetId: string): void {
    const current = getServer(currentId)
    const target = getServer(targetId)
    if (!current?.isTencent || !target?.isTencent) throw new Error('仅腾讯服务器支持跨区历史查询')
  }

  private async refreshTokens(connection: PrivateLcuConnection): Promise<SessionTokens> {
    const [entitlement, leagueSession] = await Promise.all([
      requestLocalJson<{ accessToken: string }>(connection, '/entitlements/v1/token'),
      requestLocalJson<string>(connection, '/lol-league-session/v1/league-session-token')
    ])
    if (!entitlement.accessToken || !leagueSession) throw new Error('LCU 会话令牌尚未就绪')
    this.tokens = { pid: connection.pid, entitlement: entitlement.accessToken, leagueSession }
    return this.tokens
  }

  private async requestSgp<T>(
    serverId: string,
    tokenType: 'entitlement' | 'league-session',
    pathname: string,
    options: { method?: 'GET' | 'POST'; body?: unknown; retried?: boolean } = {}
  ): Promise<T> {
    const connection = this.requireConnection()
    const server = getServer(serverId)
    if (!server) throw new Error(`未知服务器 ${serverId}`)
    const tokens = this.tokens?.pid === connection.pid ? this.tokens : await this.refreshTokens(connection)
    const token = tokenType === 'entitlement' ? tokens.entitlement : tokens.leagueSession
    const baseUrl = tokenType === 'entitlement' ? server.matchHistoryUrl : server.commonUrl
    const url = `${baseUrl}${pathname.replace('{region}', regionPath(server))}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    try {
      const response = await fetch(url, {
        method: options.method ?? 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' })
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal
      })
      const text = await response.text()
      let data: unknown = null
      if (text) { try { data = JSON.parse(text) } catch { data = text } }
      if (response.ok) return data as T
      if (response.status === 401 && !options.retried) {
        this.tokens = null
        await this.refreshTokens(connection)
        return this.requestSgp<T>(serverId, tokenType, pathname, { ...options, retried: true })
      }
      throw new HttpStatusError(response.status, data)
    } finally { clearTimeout(timeout) }
  }
}

class SpectatorBatcher {
  private pending = new Map<string, Array<(available: boolean) => void>>()
  private timer: NodeJS.Timeout | null = null

  constructor(private readonly getConnection: () => PrivateLcuConnection | null) {}

  isAvailable(puuid: string): Promise<boolean> {
    return new Promise((resolve) => {
      const resolvers = this.pending.get(puuid) ?? []
      resolvers.push(resolve)
      this.pending.set(puuid, resolvers)
      if (!this.timer) this.timer = setTimeout(() => void this.flush(), 50)
    })
  }

  private async flush(): Promise<void> {
    this.timer = null
    const batch = this.pending
    this.pending = new Map()
    const puuids = [...batch.keys()]
    let available = new Set<string>()
    try {
      const connection = this.getConnection()
      if (connection) {
        const response = await requestLocalJson<{ availableForWatching?: string[] }>(connection, '/lol-spectator/v3/buddy/spectate', { method: 'POST', body: puuids })
        available = new Set(response.availableForWatching ?? [])
      }
    } catch { /* all callers receive false and the next cycle will retry */ }
    for (const [puuid, resolvers] of batch) for (const resolve of resolvers) resolve(available.has(puuid))
  }
}

export function normalizeMatches(input: unknown): MatchInfo[] {
  const root = input as any
  const games: any[] = Array.isArray(root?.games?.games) ? root.games.games : Array.isArray(root?.games) ? root.games : []
  return games.map((entry) => {
    const game = entry?.json ?? entry
    const matchId = entry?.metadata?.match_id ?? game?.gameId ?? game?.game_id ?? ''
    const gameId = String(matchId).includes('_') ? String(matchId).split('_').at(-1) ?? String(matchId) : String(matchId)
    const timestamp = Number(game?.gameStartTimestamp ?? game?.gameCreation ?? game?.game_datetime ?? 0)
    return {
      gameId,
      queueId: Number(game?.queueId ?? game?.queue_id ?? game?.queue ?? 0),
      gameMode: String(game?.gameMode ?? game?.game_mode ?? ''),
      startedAt: timestamp > 0 ? new Date(timestamp).toISOString() : null,
      ...(Number(game?.gameDuration) > 0 ? { durationSeconds: Number(game.gameDuration) } : {})
    }
  }).filter((game) => game.gameId)
}
