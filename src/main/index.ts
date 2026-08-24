import { app, BrowserWindow } from 'electron'
import { AppController } from './controller'
import { registerIpc } from './ipc'
import { createMainWindow, markQuitting } from './window'

app.setAppUserModelId('dev.lcuwatchdog.app')
const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) app.quit()

let controller: AppController | null = null

app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) return
  controller = new AppController(app.getPath('userData'))
  await controller.init()
  registerIpc(controller)
  const window = createMainWindow(controller)
  app.on('second-instance', () => {
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  })
})

app.on('before-quit', () => markQuitting())
app.on('will-quit', (event) => {
  if (!controller) return
  event.preventDefault()
  const current = controller
  controller = null
  void current.shutdown().finally(() => app.exit(0))
})
app.on('activate', () => BrowserWindow.getAllWindows()[0]?.show())
