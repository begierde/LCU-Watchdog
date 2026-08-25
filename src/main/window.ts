import { app, BrowserWindow, dialog, Menu, shell, Tray } from 'electron'
import path from 'node:path'
import type { AppController } from './controller'
import { appWindowIconPath, trayIcon } from './icon'

let tray: Tray | null = null
let quitting = false

export function createMainWindow(controller: AppController): BrowserWindow {
  Menu.setApplicationMenu(null)
  const window = new BrowserWindow({
    width: 1180, height: 760, minWidth: 980, minHeight: 660, show: false,
    backgroundColor: '#171425', title: 'LCU Watchdog', icon: appWindowIconPath(), autoHideMenuBar: true,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  window.setMenuBarVisibility(false)
  const broadcastMaximized = () => window.webContents.send('watchdog:window-maximized', window.isMaximized())
  window.on('maximize', broadcastMaximized)
  window.on('unmaximize', broadcastMaximized)

  window.once('ready-to-show', () => window.show())
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.on('close', (event) => {
    if (quitting) return
    const behavior = controller.configStore.getPrivate().closeBehavior
    if (behavior === 'quit') { quitting = true; app.quit(); return }
    event.preventDefault()
    if (behavior === 'tray') { window.hide(); return }
    void dialog.showMessageBox(window, {
      type: 'question', title: '关闭 LCU Watchdog', message: '关闭窗口后要继续在后台监视吗？',
      detail: '选择会被记住，也可以稍后在应用设置中修改。',
      buttons: ['最小化到托盘并记住', '退出并记住', '取消'], defaultId: 0, cancelId: 2
    }).then(async ({ response }) => {
      if (response === 2) return
      const config = controller.configStore.get()
      config.closeBehavior = response === 0 ? 'tray' : 'quit'
      await controller.saveConfig(config)
      if (response === 0) window.hide()
      else { quitting = true; app.quit() }
    })
  })

  if (process.env.ELECTRON_RENDERER_URL) void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void window.loadFile(path.join(__dirname, '../renderer/index.html'))

  tray = new Tray(trayIcon())
  tray.setToolTip('LCU Watchdog')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开 LCU Watchdog', click: () => { window.show(); window.focus() } },
    { label: '立即查询', click: () => void controller.monitor.runNow() },
    { type: 'separator' },
    { label: '退出', click: () => { quitting = true; app.quit() } }
  ]))
  tray.on('double-click', () => { window.show(); window.focus() })
  return window
}

export function markQuitting(): void { quitting = true }
