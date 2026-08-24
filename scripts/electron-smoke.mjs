import { _electron as electron } from 'playwright'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const artifacts = path.join(root, 'output', 'playwright')
const userData = await mkdtemp(path.join(os.tmpdir(), 'lcu-watchdog-qa-'))
await mkdir(artifacts, { recursive: true })
const errors = []
let electronApp

const assert = (condition, message) => { if (!condition) throw new Error(message) }

try {
  electronApp = await electron.launch({ cwd: root, args: ['.', `--user-data-dir=${userData}`] })
  const window = await electronApp.firstWindow()
  window.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  window.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`) })
  await window.waitForLoadState('domcontentloaded')
  await window.getByText('LCU Watchdog', { exact: true }).first().waitFor()

  const launched = await window.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    nav: [...document.querySelectorAll('nav button')].map((item) => item.textContent?.trim())
  }))
  assert(launched.width >= 980 && launched.height >= 600, `unexpected launch viewport ${launched.width}x${launched.height}`)
  assert(launched.scrollWidth <= launched.width, 'overview has horizontal overflow')
  assert(launched.nav.length === 5, 'expected five navigation pages')

  if (process.argv.includes('--require-lcu')) {
    await window.getByText('LCU 已连接', { exact: true }).waitFor({ timeout: 10_000 })
  }
  await window.screenshot({ path: path.join(artifacts, 'overview.png') })

  await window.getByRole('button', { name: '玩家' }).click()
  await window.getByRole('button', { name: '添加玩家' }).click()
  await window.getByText('添加监视玩家', { exact: true }).waitFor()
  await window.getByRole('button', { name: '取消' }).click()

  await window.getByRole('button', { name: '周期与模式' }).click()
  await window.getByText('全局查询周期', { exact: true }).waitFor()
  assert(await window.getByText('历史记录模式', { exact: true }).isVisible(), 'history mode panel missing')

  await window.getByRole('button', { name: '事件' }).click()
  await window.getByText('HTTP POST Webhook', { exact: true }).waitFor()
  await window.screenshot({ path: path.join(artifacts, 'events.png'), fullPage: true })

  await window.getByRole('button', { name: '应用设置' }).click()
  await window.getByText('关闭窗口行为', { exact: true }).waitFor()
  assert(await window.getByText(/原生模块/).isVisible(), 'native diagnostics status missing')

  await window.setViewportSize({ width: 980, height: 660 })
  const minimum = await window.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    sidebar: document.querySelector('.sidebar')?.getBoundingClientRect().toJSON(),
    topbar: document.querySelector('.topbar')?.getBoundingClientRect().toJSON()
  }))
  assert(minimum.scrollWidth <= minimum.width, 'minimum viewport has horizontal overflow')
  assert(minimum.sidebar?.bottom <= minimum.height, 'sidebar clipped at minimum viewport')
  assert(minimum.topbar?.right <= minimum.width, 'top bar clipped at minimum viewport')
  assert(errors.length === 0, errors.join('\n'))

  console.log(JSON.stringify({
    ok: true,
    launched,
    minimum,
    lcuConnected: await window.getByText('LCU 已连接', { exact: true }).count() > 0
  }))
} finally {
  if (electronApp) await electronApp.close().catch(() => undefined)
  await rm(userData, { recursive: true, force: true })
}
