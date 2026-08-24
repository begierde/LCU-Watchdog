import type { PrivateLcuConnection } from '@shared/types'
import { normalizeServerId } from '@shared/servers'

const flag = (commandLine: string, name: string): string => {
  const match = commandLine.match(new RegExp(`--${name}=(?:"([^"]*)"|'([^']*)'|([^\\s"]+))`, 'i'))
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? ''
}

export function parseLcuCommandLine(commandLine: string, discoveryMethod: 'native' | 'cim' = 'native'): PrivateLcuConnection | null {
  const port = Number(flag(commandLine, 'app-port'))
  const pid = Number(flag(commandLine, 'app-pid'))
  const authToken = flag(commandLine, 'remoting-auth-token')
  const rsoPlatformId = flag(commandLine, 'rso[_-]platform[_-]id')
  const region = flag(commandLine, 'region')
  const riotClientPort = Number(flag(commandLine, 'riotclient-app-port'))
  const riotClientAuthToken = flag(commandLine, 'riotclient-auth-token')
  if (!Number.isInteger(port) || port <= 0 || !Number.isInteger(pid) || pid <= 0 || !authToken) return null

  return {
    pid,
    port,
    authToken,
    riotClientPort: Number.isInteger(riotClientPort) ? riotClientPort : 0,
    riotClientAuthToken,
    region,
    rsoPlatformId,
    serverId: normalizeServerId(rsoPlatformId || region),
    health: 'connecting',
    selected: false,
    discoveryMethod,
    lastCheckedAt: new Date().toISOString()
  }
}
