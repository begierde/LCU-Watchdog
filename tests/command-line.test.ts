import { describe, expect, it } from 'vitest'
import { X509Certificate } from 'node:crypto'
import { parseLcuCommandLine } from '@main/lcu/command-line'
import { RIOT_CERTIFICATE } from '@main/lcu/certificate'

describe('LCU command-line parser', () => {
  it('extracts required LCU and Riot Client fields', () => {
    const parsed = parseLcuCommandLine('LeagueClientUx.exe --app-pid=1234 --app-port=54321 --remoting-auth-token=secret-token --region=JP --rso_platform_id=JP1 --riotclient-app-port=60123 --riotclient-auth-token=riot-secret')
    expect(parsed).toMatchObject({ pid: 1234, port: 54321, region: 'JP', rsoPlatformId: 'JP1', serverId: 'JP', riotClientPort: 60123 })
    expect(parsed?.authToken).toBe('secret-token')
  })

  it('rejects a command line without all required values', () => {
    expect(parseLcuCommandLine('LeagueClientUx.exe --app-pid=1234')).toBeNull()
  })

  it('accepts Riot command lines that quote the complete flag', () => {
    const parsed = parseLcuCommandLine('LeagueClientUx.exe "--app-pid=1234" "--app-port=54321" "--remoting-auth-token=quoted-secret" "--region=JP"')
    expect(parsed).toMatchObject({ pid: 1234, port: 54321, authToken: 'quoted-secret', serverId: 'JP' })
  })

  it('bundles a parseable Riot LCU root certificate', () => {
    expect(new X509Certificate(RIOT_CERTIFICATE).subject).toContain('Riot Games')
  })
})
