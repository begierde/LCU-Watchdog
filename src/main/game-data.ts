import { getServer, regionPath } from '@shared/servers'
import type { MatchInfo, PlayerDraft, PlayerPresence, PrivateLcuConnection } from '@shared/types'
import { HttpStatusError, requestLocalJson } from './lcu/http'

interface SessionTokens { pid: number; entitlement: string; leagueSession: string }
interface AliasResult { puuid: string; alias?: { game_name?: string; tag_line?: string } }
interface SummonerProfile { profileIconId?: number; summonerLevel?: number }
interface SpectatorAvailability { available: boolean; error?: unknown }

export interface OngoingMatchResult {
  match: MatchInfo | null
  source?: 'lcu-chat-presence' | 'lcu-spectator+sgp-gsm' | 'sgp-gsm'
  presence: PlayerPresence
}

export interface FriendPresenceResult { presence: PlayerPresence; match: MatchInfo | null }

export class OngoingQueryUnavailableError extends Error {}

export class GameDataClient {
  private tokens: SessionTokens | null = null
  private readonly spectator: SpectatorBatcher

  constructor(private readonly getConnection: () => PrivateLcuConnection | null) {
    this.spectator = new SpectatorBatcher(getConnection)
  }

  async resolvePlayer(draft: PlayerDraft): Promise<{
    puuid: string; gameName: string; tagLine: string; serverId: string; profileIconId?: number; summonerLevel?: number
  }> {
    const connection = this.requireConnection()

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

    const profile = await this.getPlayerProfile(puuid)

    return {
      puuid,
      gameName: gameName || 'PUUID',
      tagLine: tagLine || puuid.slice(0, 6),
      serverId: connection.serverId,
      ...(Number.isInteger(profile.profileIconId) ? { profileIconId: profile.profileIconId } : {}),
      ...(Number.isInteger(profile.summonerLevel) ? { summonerLevel: profile.summonerLevel } : {})
    }
  }

  async getPlayerProfile(puuid: string): Promise<SummonerProfile> {
    try {
      return await requestLocalJson<SummonerProfile>(
        this.requireConnection(), `/lol-summoner/v2/summoners/puuid/${encodeURIComponent(puuid)}`
      )
    } catch { return {} }
  }

  async getHistory(puuid: string, serverId: string): Promise<{ source: 'lcu-history' | 'sgp-history'; matches: MatchInfo[] }> {
    const connection = this.requireConnection()
    if (serverId === connection.serverId) {
      const params = new URLSearchParams({ begIndex: '0', endIndex: '19' })
      const data = await requestLocalJson<unknown>(connection, `/lol-match-history/v1/products/lol/${encodeURIComponent(puuid)}/matches?${params}`)
      return { source: 'lcu-history', matches: normalizeMatches(data, puuid).slice(0, 20) }
    }
    this.ensureCrossRegionAllowed(connection.serverId, serverId)
    const data = await this.requestSgp<unknown>(serverId, 'entitlement', `/match-history-query/v1/products/lol/player/${encodeURIComponent(puuid)}/SUMMARY?startIndex=0&count=20`)
    return { source: 'sgp-history', matches: normalizeMatches(data, puuid).slice(0, 20) }
  }

  async getOngoing(puuid: string, serverId: string): Promise<OngoingMatchResult> {
    const connection = this.requireConnection()
    if (serverId !== connection.serverId) return { match: null, presence: 'unknown' }

    let presenceError: unknown
    let knownPresence: PlayerPresence = 'unknown'
    try {
      const friends = await requestLocalJson<unknown>(connection, '/lol-chat/v1/friends')
      const friend = normalizeFriendPresence(friends, puuid)
      if (friend) {
        knownPresence = friend.presence
        if (friend.match) return { match: friend.match, source: 'lcu-chat-presence', presence: 'in_game' }
      }
    } catch (error) { presenceError = error }

    const spectator = await this.spectator.isAvailable(puuid)
    if (spectator.available) {
      try {
        const game = await this.getGsmOngoing(serverId, puuid)
        return game
          ? { match: game, source: 'lcu-spectator+sgp-gsm', presence: 'in_game' }
          : { match: null, presence: knownPresence }
      } catch (sgpError) {
        throw new OngoingQueryUnavailableError(
          `Spectator 已确认该玩家可查询，但无法取得对局详情：${describeOngoingError(sgpError)}`
        )
      }
    }

    try {
      const game = await this.getGsmOngoing(serverId, puuid)
      if (game) return { match: game, source: 'sgp-gsm', presence: 'in_game' }
      return { match: null, presence: knownPresence }
    } catch (sgpError) {
      if (knownPresence !== 'unknown') return { match: null, presence: knownPresence }
      const reasons = [spectator.error, sgpError, presenceError]
        .filter((error) => error !== undefined)
        .map(describeOngoingError)
        .filter((reason, index, list) => list.indexOf(reason) === index)
      throw new OngoingQueryUnavailableError(`无法确认实时对局：${reasons.join('；') || '当前会话没有该玩家的查询权限'}`)
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

  private async getGsmOngoing(serverId: string, puuid: string): Promise<MatchInfo | null> {
    try {
      const data = await this.requestSgp<unknown>(serverId, 'league-session', `/gsm/v1/ledge/region/{region}/puuid/${encodeURIComponent(puuid)}`)
      return normalizeGsmOngoing(data)
    } catch (error) {
      if (error instanceof HttpStatusError && error.status === 404) return null
      throw error
    }
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
  private pending = new Map<string, Array<(result: SpectatorAvailability) => void>>()
  private timer: NodeJS.Timeout | null = null

  constructor(private readonly getConnection: () => PrivateLcuConnection | null) {}

  isAvailable(puuid: string): Promise<SpectatorAvailability> {
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
    const results = new Map<string, SpectatorAvailability>()
    try {
      const available = await this.request(puuids)
      for (const puuid of puuids) results.set(puuid, { available: available.has(puuid) })
    } catch (batchError) {
      if (puuids.length === 1) results.set(puuids[0]!, { available: false, error: batchError })
      else await Promise.all(puuids.map(async (puuid) => {
        try { results.set(puuid, { available: (await this.request([puuid])).has(puuid) }) }
        catch (error) { results.set(puuid, { available: false, error }) }
      }))
    }
    for (const [puuid, resolvers] of batch) {
      const result = results.get(puuid) ?? { available: false, error: new Error('League Client 尚未连接') }
      for (const resolve of resolvers) resolve(result)
    }
  }

  private async request(puuids: string[]): Promise<Set<string>> {
    const connection = this.getConnection()
    if (!connection) throw new Error('League Client 尚未连接')
    const response = await requestLocalJson<{ availableForWatching?: string[] }>(
      connection, '/lol-spectator/v3/buddy/spectate', { method: 'POST', body: puuids }
    )
    return new Set(response.availableForWatching ?? [])
  }
}

export function normalizeChatPresence(input: unknown, puuid: string): MatchInfo | null {
  return normalizeFriendPresence(input, puuid)?.match ?? null
}

export function normalizeFriendPresence(input: unknown, puuid: string): FriendPresenceResult | null {
  if (!Array.isArray(input)) return null
  const friend = input.find((item: any) => item?.puuid === puuid) as any
  if (!friend) return null
  const lol = friend.lol ?? {}
  const status = String(lol.gameStatus ?? '').replace(/[-_\s]/g, '').toLowerCase()
  if (status === 'ingame') {
    const timestamp = Number(lol.timestamp ?? 0)
    const gameId = String(lol.gameId ?? lol.spectatorId ?? (timestamp > 0 ? `presence-${puuid}-${timestamp}` : ''))
    if (gameId) return { presence: 'in_game', match: {
      gameId,
      queueId: Number(lol.queueId ?? lol.queue ?? 0),
      gameMode: String(lol.gameMode ?? lol.gameQueueType ?? ''),
      startedAt: timestamp > 0 ? new Date(timestamp).toISOString() : null
    } }
  }
  const availability = String(friend.availability ?? friend.status ?? '').toLowerCase()
  if (availability === 'offline') return { presence: 'offline', match: null }
  if (['chat', 'away', 'dnd', 'mobile', 'online'].includes(availability)) return { presence: 'online', match: null }
  return { presence: 'unknown', match: null }
}

export function normalizeGsmOngoing(input: unknown): MatchInfo | null {
  const data = input as any
  const credentials = data?.playerCredentials ?? {}
  const game = data?.game ?? {}
  const gameId = String(credentials.gameId ?? game.id ?? '')
  if (!gameId) return null
  const created = Number(credentials.gameCreateDate ?? game.gameCreateDate ?? 0)
  return {
    gameId,
    queueId: Number(credentials.queueId ?? game.gameQueueConfigId ?? 0),
    gameMode: String(credentials.gameMode ?? game.gameMode ?? ''),
    startedAt: created > 0 ? new Date(created).toISOString() : null
  }
}

export function describeOngoingError(error: unknown): string {
  if (error instanceof HttpStatusError) {
    const body = error.body as any
    const detail = String(body?.message ?? '')
    if (error.status === 500 && /(?:410|GONE|filtered)/i.test(detail)) {
      return 'Riot Spectator 已过滤该玩家（通常仅允许好友或会话授权玩家）'
    }
    if (error.status === 401 || error.status === 403) return `SGP 拒绝访问该玩家（HTTP ${error.status}）`
    return `实时接口 HTTP ${error.status}`
  }
  return error instanceof Error ? error.message : String(error)
}

export function normalizeMatches(input: unknown, puuid?: string): MatchInfo[] {
  const root = input as any
  const games: any[] = Array.isArray(root?.games?.games) ? root.games.games : Array.isArray(root?.games) ? root.games : []
  return games.map((entry) => {
    const game = entry?.json ?? entry
    const matchId = entry?.metadata?.match_id ?? game?.gameId ?? game?.game_id ?? ''
    const gameId = String(matchId).includes('_') ? String(matchId).split('_').at(-1) ?? String(matchId) : String(matchId)
    const timestamp = Number(game?.gameStartTimestamp ?? game?.gameCreation ?? game?.game_datetime ?? 0)
    const identities: any[] = Array.isArray(game?.participantIdentities) ? game.participantIdentities : []
    const participants: any[] = Array.isArray(game?.participants) ? game.participants : []
    const identity = puuid ? identities.find((item) => item?.player?.puuid === puuid) : null
    const participant = puuid
      ? participants.find((item) => item?.puuid === puuid || (identity && item?.participantId === identity.participantId))
      : null
    const stats = participant?.stats ?? participant ?? {}
    const championId = Number(participant?.championId ?? 0)
    return {
      gameId,
      queueId: Number(game?.queueId ?? game?.queue_id ?? game?.queue ?? 0),
      gameMode: String(game?.gameMode ?? game?.game_mode ?? ''),
      startedAt: timestamp > 0 ? new Date(timestamp).toISOString() : null,
      ...(Number(game?.gameDuration) > 0 ? { durationSeconds: Number(game.gameDuration) } : {}),
      ...(championId > 0 ? { championId } : {}),
      ...(participant?.championName ? { championName: String(participant.championName) } : {}),
      ...(typeof stats.win === 'boolean' ? { win: stats.win } : {}),
      ...(Number.isFinite(Number(stats.kills)) ? { kills: Number(stats.kills) } : {}),
      ...(Number.isFinite(Number(stats.deaths)) ? { deaths: Number(stats.deaths) } : {}),
      ...(Number.isFinite(Number(stats.assists)) ? { assists: Number(stats.assists) } : {})
    }
  }).filter((game) => game.gameId)
}
