import { _electron as electron } from 'playwright'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const artifacts = path.join(root, 'output', 'playwright')
const userData = await mkdtemp(path.join(os.tmpdir(), 'lcu-watchdog-qa-'))
await mkdir(artifacts, { recursive: true })
const errors = []
let electronApp
const playerDetailMode = process.argv.includes('--player-detail')
const packagedMode = process.argv.includes('--packaged')

const assert = (condition, message) => { if (!condition) throw new Error(message) }

try {
  if (playerDetailMode) {
    const now = new Date().toISOString()
    const player = {
      id: 'player-1', gameName: 'Visual Player', tagLine: 'JP1', puuid: 'visual-player-puuid', serverId: 'JP',
      profileIconId: 29, summonerLevel: 287, enabled: false, overridePolicy: null, createdAt: now
    }
    const policy = { intervalMs: 300_000, jitterMs: 60_000, ongoing: { mode: 'all', queueIds: [] }, history: { mode: 'include', queueIds: [440] } }
    await writeFile(path.join(userData, 'config.json'), JSON.stringify({
      version: 1, globalPolicy: policy, players: [player], webhook: { enabled: false, url: '', headers: [], timeoutMs: 10_000 },
      events: {
        ongoing_game_detected: { webhookEnabled: false, webhookTemplate: '{{eventJson}}', notificationEnabled: true, notificationTitle: '', notificationBody: '' },
        new_match_detected: { webhookEnabled: false, webhookTemplate: '{{eventJson}}', notificationEnabled: true, notificationTitle: '', notificationBody: '' }
      }, closeBehavior: 'quit', selectedConnectionPid: null
    }))
    await writeFile(path.join(userData, 'state.json'), JSON.stringify({
      version: 1, players: { 'player-1': {
        seeded: true, seenHistoryGameIds: [], seenOngoingGameIds: [], running: false, lastRunAt: now, nextRunAt: null, lastError: null,
        recentMatches: [
          { gameId: '7812345678', queueId: 440, gameMode: 'CLASSIC', startedAt: '2026-08-24T15:20:00.000Z', durationSeconds: 1924, championId: 22, championName: 'Ashe', win: true, kills: 8, deaths: 2, assists: 11 },
          { gameId: '7812345610', queueId: 420, gameMode: 'CLASSIC', startedAt: '2026-08-24T14:10:00.000Z', durationSeconds: 1682, championId: 103, championName: 'Ahri', win: false, kills: 4, deaths: 7, assists: 6 }
        ]
      } }, recentEvents: [], diagnostics: []
    }))
  }
  const packagedExecutable = path.join(root, 'release', 'win-unpacked', 'LCU Watchdog.exe')
  electronApp = await electron.launch({
    ...(packagedMode ? { executablePath: packagedExecutable } : {}),
    cwd: packagedMode ? path.dirname(packagedExecutable) : root,
    args: packagedMode ? [`--user-data-dir=${userData}`] : ['.', `--user-data-dir=${userData}`],
    env: { ...process.env, LCU_WATCHDOG_QA: '1' }
  })
  const window = await electronApp.firstWindow()
  window.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  window.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`) })
  await window.waitForLoadState('domcontentloaded')
  await window.getByText('LCU Watchdog', { exact: true }).first().waitFor()

  const menuVisible = await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isMenuBarVisible())
  assert(menuVisible === false, 'native menu bar should be hidden')

  const launched = await window.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    nav: [...document.querySelectorAll('nav button')].map((item) => item.textContent?.trim()),
    titlebar: document.querySelector('.window-titlebar')?.getBoundingClientRect().toJSON()
  }))
  assert(launched.width >= 980 && launched.height >= 600, `unexpected launch viewport ${launched.width}x${launched.height}`)
  assert(launched.scrollWidth <= launched.width, 'overview has horizontal overflow')
  assert(launched.nav.length === 3, 'expected three primary navigation pages')
  assert(launched.titlebar?.height === 44, 'custom title bar should be 44px high')
  assert(launched.titlebar?.left === 208, 'custom title bar should align after the sidebar')
  assert(await window.getByRole('button', { name: '最小化' }).count() === 1, 'minimize control missing')
  assert(await window.getByRole('button', { name: '最大化' }).count() === 1, 'maximize control missing')
  assert(await window.getByRole('button', { name: '关闭' }).count() === 1, 'close control missing')
  await window.getByRole('button', { name: '最大化' }).click()
  await window.getByRole('button', { name: '还原' }).waitFor()
  await window.getByRole('button', { name: '还原' }).click()
  await window.getByRole('button', { name: '最大化' }).waitFor()
  await window.waitForFunction((width) => innerWidth === width, launched.width)

  if (process.argv.includes('--require-lcu')) {
    await window.getByText('LCU 已连接', { exact: true }).waitFor({ timeout: 10_000 })
  }
  await window.screenshot({ path: path.join(artifacts, 'overview.png') })

  await window.getByRole('button', { name: '玩家' }).click()
  await window.getByRole('button', { name: '添加玩家' }).click()
  await window.getByText('添加监视玩家', { exact: true }).waitFor()
  assert(await window.getByPlaceholder('游戏名#标签').count() === 1, 'single Riot ID field missing')
  assert(await window.getByPlaceholder('游戏名#标签').evaluate((element) => element === document.activeElement), 'Riot ID input should receive initial focus')
  assert(await window.getByText('sweets#7すき', { exact: true }).count() === 0, 'legacy Riot ID example is still visible')
  await window.keyboard.press('Escape')
  await window.getByText('添加监视玩家', { exact: true }).waitFor({ state: 'hidden' })
  await window.screenshot({ path: path.join(artifacts, 'players.png') })

  if (playerDetailMode) {
    assert(await window.getByText(/等级 287/).isVisible(), 'summoner level missing from player row')
    assert(await window.locator('.profile-avatar img').count() === 1, 'profile icon missing from player card')
    await window.locator('.player-row-main').click()
    await window.getByRole('tab', { name: '对局记录' }).waitFor()
    assert(await window.locator('.match-row').count() === 2, 'match history rows missing')
    assert(await window.getByText('8 / 2 / 11', { exact: true }).isVisible(), 'KDA missing from match card')
    assert(await window.getByRole('tab', { name: /Visual Player/ }).count() === 1, 'player title tab missing')
    await window.waitForFunction(() => [...document.querySelectorAll('.player-profile-panel img,.match-row img')].every((image) => image.complete), undefined, { timeout: 5_000 })
    await window.screenshot({ path: path.join(artifacts, 'player-detail.png') })
  }

  await window.getByRole('button', { name: '设置' }).click()
  await window.getByText('查询周期', { exact: true }).waitFor()
  assert(await window.getByText('历史记录', { exact: true }).isVisible(), 'history mode panel missing')
  await window.screenshot({ path: path.join(artifacts, 'monitoring-settings.png') })
  await window.getByRole('tab', { name: '事件通知' }).click()
  await window.getByText('Webhook', { exact: true }).first().waitFor()
  await window.locator('.advanced-settings > summary').click()
  assert(await window.getByPlaceholder('SCT 开头的 SendKey').count() === 1, 'ServerChan SendKey field missing')
  assert(await window.locator('.template-editor').count() === 2, 'ServerChan event templates missing')
  const sendKeyInput = window.getByPlaceholder('SCT 开头的 SendKey')
  await sendKeyInput.fill('SCT_ui-draft')
  await window.getByLabel('启用 Webhook').click()
  await window.locator('.event-config').first().getByText('Webhook', { exact: true }).click()
  await window.waitForTimeout(2_500)
  assert(await sendKeyInput.inputValue() === 'SCT_ui-draft', 'periodic snapshot cleared the unsaved SendKey')
  assert(await window.getByLabel('启用 Webhook').getAttribute('aria-checked') === 'true', 'periodic snapshot reverted the Webhook switch')
  assert(await window.getByText('有未保存的更改', { exact: true }).isVisible(), 'sticky save bar missing')
  assert(await window.getByRole('button', { name: '测试此事件' }).first().isDisabled(), 'event test should be disabled for dirty settings')
  await window.getByRole('button', { name: '玩家' }).click()
  await window.getByText('设置尚未保存', { exact: true }).waitFor()
  await window.getByRole('button', { name: '继续编辑' }).click()
  await window.screenshot({ path: path.join(artifacts, 'events.png'), fullPage: true })
  await window.getByRole('button', { name: '放弃更改' }).click()
  await window.getByRole('tab', { name: '应用' }).click()
  await window.getByText('窗口', { exact: true }).waitFor()
  assert(await window.locator('.status-tags').getByText(/原生模块/).isVisible(), 'native module status missing')
  await window.screenshot({ path: path.join(artifacts, 'application-settings.png') })

  await window.setViewportSize({ width: 980, height: 660 })
  const minimum = await window.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    sidebar: document.querySelector('.sidebar')?.getBoundingClientRect().toJSON(),
    topbar: document.querySelector('.page-header')?.getBoundingClientRect().toJSON()
  }))
  assert(minimum.scrollWidth <= minimum.width, 'minimum viewport has horizontal overflow')
  assert(minimum.sidebar?.bottom <= minimum.height, 'sidebar clipped at minimum viewport')
  assert(minimum.topbar?.right <= minimum.width, 'top bar clipped at minimum viewport')
  await window.screenshot({ path: path.join(artifacts, 'minimum-980x660.png') })
  assert(errors.length === 0, errors.join('\n'))

  console.log(JSON.stringify({
    ok: true,
    menuVisible,
    packagedMode,
    playerDetailMode,
    launched,
    minimum,
    lcuConnected: await window.getByText('LCU 已连接', { exact: true }).count() > 0
  }))
} finally {
  if (electronApp) await electronApp.close().catch(() => undefined)
  await rm(userData, { recursive: true, force: true })
}
