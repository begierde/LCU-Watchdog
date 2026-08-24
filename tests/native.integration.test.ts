import { afterEach, describe, expect, it } from 'vitest'
import { copyFile, mkdtemp, rm } from 'node:fs/promises'
import { spawn, type ChildProcess } from 'node:child_process'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'

const require = createRequire(import.meta.url)
const native = process.platform === 'win32' ? require('lcu-native') as { getPidsByName(name: string): number[]; getProcessCommandLine(pid: number): string } : null
let child: ChildProcess | null = null
let tempDir: string | null = null

afterEach(async () => {
  if (child && child.exitCode === null) {
    const exited = new Promise<void>((resolve) => child!.once('exit', () => resolve()))
    child.kill()
    await exited
  }
  child = null
  if (tempDir) await rm(tempDir, { recursive: true, force: true })
  tempDir = null
})

describe.skipIf(process.platform !== 'win32')('native LCU discovery', () => {
  it('enumerates a LeagueClientUx fixture and reads its command line', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'lcu-watchdog-native-'))
    const fixture = path.join(tempDir, 'LeagueClientUx.exe')
    await copyFile(process.execPath, fixture)
    child = spawn(fixture, ['-e', 'setInterval(() => {}, 1000)', '--', '--app-pid=9876', '--app-port=54321', '--remoting-auth-token=test-secret'], { windowsHide: true })
    const pid = child.pid!
    let discovered: number[] = []
    for (let attempt = 0; attempt < 20; attempt++) {
      discovered = native!.getPidsByName('LeagueClientUx.exe')
      if (discovered.includes(pid)) break
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    expect(discovered).toContain(pid)
    expect(native!.getProcessCommandLine(pid)).toContain('--app-port=54321')
  })
})
