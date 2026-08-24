import { app } from 'electron'
import { createRequire } from 'node:module'
import path from 'node:path'

export interface NativeLcuModule {
  getPidsByName(name: string): number[]
  getProcessCommandLine(pid: number): string
}

const require = createRequire(import.meta.url)

export function loadNativeModule(): NativeLcuModule | null {
  try {
    if (app.isPackaged) {
      return require(path.join(process.resourcesPath, 'native', 'lcu_native.node')) as NativeLcuModule
    }
    return require('lcu-native') as NativeLcuModule
  } catch {
    return null
  }
}

