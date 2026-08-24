import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { LcuConnection, PrivateLcuConnection } from '@shared/types'
import { parseLcuCommandLine } from './command-line'
import { requestLocalJson, HttpStatusError } from './http'
import { loadNativeModule, type NativeLcuModule } from './native-loader'

const execFileAsync = promisify(execFile)

type Listener = () => void

export class LcuDiscovery {
  private native: NativeLcuModule | null = null
  private timer: NodeJS.Timeout | null = null
  private scanning = false
  private failuresWithProcess = 0
  private listeners = new Set<Listener>()
  private connections: PrivateLcuConnection[] = []
  private selectedPid: number | null = null

  get nativeAvailable(): boolean { return this.native !== null }
  get active(): PrivateLcuConnection | null {
    return this.connections.find((item) => item.pid === this.selectedPid && item.health === 'connected')
      ?? this.connections.find((item) => item.health === 'connected')
      ?? null
  }

  start(selectedPid: number | null): void {
    this.native = loadNativeModule()
    this.selectedPid = selectedPid
    void this.scan()
    this.timer = setInterval(() => void this.scan(), 2_000)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  select(pid: number | null): void {
    this.selectedPid = pid
    this.applySelection()
    this.emit()
  }

  publicConnections(): LcuConnection[] {
    return this.connections.map(({ port: _port, authToken: _auth, riotClientPort: _rp, riotClientAuthToken: _ra, ...publicValue }) => publicValue)
  }

  private async scan(): Promise<void> {
    if (this.scanning) return
    this.scanning = true
    try {
      let found = this.readNative()
      if ((!this.native || (found.length === 0 && this.failuresWithProcess >= 5))) found = await this.readCim()
      const checked = await Promise.all(found.map((connection) => this.probe(connection)))
      this.connections = checked
      this.applySelection()
      this.emit()
    } finally {
      this.scanning = false
    }
  }

  private readNative(): PrivateLcuConnection[] {
    if (!this.native) return []
    const pids = this.native.getPidsByName('LeagueClientUx.exe')
    const connections: PrivateLcuConnection[] = []
    for (const pid of pids) {
      try {
        const parsed = parseLcuCommandLine(this.native.getProcessCommandLine(pid), 'native')
        if (parsed) connections.push(parsed)
      } catch { /* an individual process may disappear while scanning */ }
    }
    this.failuresWithProcess = pids.length > 0 && connections.length === 0 ? this.failuresWithProcess + 1 : 0
    return connections
  }

  private async readCim(): Promise<PrivateLcuConnection[]> {
    try {
      const script = "Get-CimInstance Win32_Process -Filter \"Name='LeagueClientUx.exe'\" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress"
      const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 8_000, windowsHide: true })
      if (!stdout.trim()) return []
      const value = JSON.parse(stdout) as { CommandLine?: string } | { CommandLine?: string }[]
      return (Array.isArray(value) ? value : [value])
        .map((item) => item.CommandLine ? parseLcuCommandLine(item.CommandLine, 'cim') : null)
        .filter((item): item is PrivateLcuConnection => item !== null)
    } catch { return [] }
  }

  private async probe(connection: PrivateLcuConnection): Promise<PrivateLcuConnection> {
    try {
      await requestLocalJson(connection, '/riotclient/region-locale', { timeoutMs: 3_000 })
      return { ...connection, health: 'connected', lastCheckedAt: new Date().toISOString() }
    } catch (error) {
      return {
        ...connection,
        health: error instanceof HttpStatusError && error.status === 401 ? 'unauthorized' : 'unavailable',
        lastCheckedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  private applySelection(): void {
    const healthy = this.connections.filter((item) => item.health === 'connected')
    if (!healthy.some((item) => item.pid === this.selectedPid)) this.selectedPid = healthy[0]?.pid ?? null
    this.connections = this.connections.map((item) => ({ ...item, selected: item.pid === this.selectedPid }))
  }

  private emit(): void { for (const listener of this.listeners) listener() }
}
