import { app, nativeImage } from 'electron'
import path from 'node:path'

export function appIconPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(process.cwd(), 'resources', 'icon.png')
}

export function appWindowIconPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'icon.ico')
    : path.join(process.cwd(), 'resources', 'icon.ico')
}

export function trayIcon() {
  return nativeImage.createFromPath(appIconPath()).resize({ width: 16, height: 16 })
}
