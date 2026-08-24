<template>
  <div v-if="store.snapshot && config" class="app-shell">
    <aside class="sidebar">
      <div class="brand"><span class="brand-mark">L</span><div><strong>LCU Watchdog</strong><small>PLAYER MONITOR</small></div></div>
      <nav>
        <button v-for="item in pages" :key="item.key" :class="{ active: page === item.key }" @click="page = item.key">
          <span>{{ item.icon }}</span>{{ item.label }}
        </button>
      </nav>
      <div class="connection-pill" :class="store.activeConnection?.health ?? 'unavailable'">
        <span class="status-dot"></span>
        <div><strong>{{ store.activeConnection ? 'LCU 已连接' : '等待客户端' }}</strong><small>{{ store.activeConnection?.serverId ?? '请启动 League Client' }}</small></div>
      </div>
    </aside>

    <main class="content">
      <header class="topbar">
        <div><h1>{{ currentPage.label }}</h1><p>{{ currentPage.description }}</p></div>
        <n-button type="primary" :loading="store.loading" @click="runAll">立即查询</n-button>
      </header>
      <n-alert v-if="store.error" type="error" closable class="error-banner">{{ store.error }}</n-alert>

      <section v-if="page === 'overview'" class="page-grid">
        <div class="metric-card"><span>LCU 连接</span><strong>{{ store.snapshot.connections.length }}</strong><small>{{ store.snapshot.nativeAvailable ? '原生发现模块正常' : '正在使用 CIM 回退' }}</small></div>
        <div class="metric-card"><span>监视玩家</span><strong>{{ enabledPlayers }}</strong><small>共 {{ config.players.length }} 位玩家</small></div>
        <div class="metric-card"><span>最近事件</span><strong>{{ store.snapshot.runtime.recentEvents.length }}</strong><small>保留最近 100 条</small></div>
        <div class="panel span-3">
          <div class="panel-title"><div><h2>客户端连接</h2><p>令牌仅保存在 Electron 主进程内</p></div></div>
          <div v-if="!store.snapshot.connections.length" class="empty-state">未发现 LeagueClientUx.exe。启动并登录 League Client 后会自动连接。</div>
          <div v-for="connection in store.snapshot.connections" :key="connection.pid" class="connection-row">
            <span class="status-dot" :class="connection.health"></span>
            <div><strong>{{ connection.serverId || connection.region || '未知服务器' }}</strong><small>PID {{ connection.pid }} · {{ connection.discoveryMethod === 'native' ? 'Native / NtQueryInformationProcess' : 'CIM 回退' }}</small></div>
            <n-tag :type="connection.health === 'connected' ? 'success' : 'warning'">{{ connection.health }}</n-tag>
            <n-button v-if="!connection.selected" size="small" @click="selectConnection(connection.pid)">使用</n-button>
            <n-tag v-else type="info">当前</n-tag>
          </div>
        </div>
        <div class="panel span-3">
          <div class="panel-title"><div><h2>最近触发事件</h2><p>进行中游戏与新增历史记录</p></div></div>
          <div v-if="!store.snapshot.runtime.recentEvents.length" class="empty-state">还没有事件。首次历史查询只会建立基线。</div>
          <div v-for="event in store.snapshot.runtime.recentEvents.slice(0, 12)" :key="event.eventId" class="event-row">
            <span class="event-icon">{{ event.type === 'ongoing_game_detected' ? 'LIVE' : 'NEW' }}</span>
            <div><strong>{{ event.player.gameName }}#{{ event.player.tagLine }}</strong><small>队列 {{ event.game.queueId }} · 对局 {{ event.game.gameId }} · {{ formatTime(event.occurredAt) }}</small></div>
            <n-tag size="small">{{ event.source }}</n-tag>
          </div>
        </div>
      </section>

      <section v-else-if="page === 'players'">
        <div class="toolbar"><span>Riot ID 会通过本机 Riot Client 解析为 PUUID</span><n-button type="primary" @click="openAddPlayer">添加玩家</n-button></div>
        <div v-if="!config.players.length" class="panel empty-state tall">尚未配置玩家。添加后会在 5 秒内进行首次查询。</div>
        <div class="player-grid">
          <article v-for="player in config.players" :key="player.id" class="player-card">
            <div class="player-head"><div class="avatar">{{ player.gameName.slice(0, 1).toUpperCase() }}</div><div><h3>{{ player.gameName }}<small>#{{ player.tagLine }}</small></h3><p>{{ serverName(player.serverId) }} · {{ shortPuuid(player.puuid) }}</p></div><n-switch :value="player.enabled" @update:value="togglePlayer(player, $event)" /></div>
            <div class="runtime-line"><span :class="{ running: runtime(player.id).running }"></span>{{ runtime(player.id).running ? '查询中' : runtime(player.id).lastError || `下次：${formatTime(runtime(player.id).nextRunAt)}` }}</div>
            <div class="player-actions"><n-button size="small" @click="runPlayer(player.id)">立即查询</n-button><n-button size="small" @click="editPolicy(player)">单独策略</n-button><n-popconfirm @positive-click="removePlayer(player.id)"><template #trigger><n-button size="small" type="error" ghost>移除</n-button></template>确认移除这个玩家？</n-popconfirm></div>
          </article>
        </div>
      </section>

      <section v-else-if="page === 'schedule'" class="settings-stack">
        <div class="panel form-panel">
          <div class="panel-title"><div><h2>全局查询周期</h2><p>下次延迟 = 基础周期 + 0 到随机延迟之间的正向随机值</p></div></div>
          <div class="form-row"><n-form-item label="基础周期（分钟）"><n-input-number :value="config.globalPolicy.intervalMs / 60000" :min="1" :max="1440" @update:value="setGlobalInterval" /></n-form-item><n-form-item label="最大随机延迟（秒）"><n-input-number :value="config.globalPolicy.jitterMs / 1000" :min="0" :max="86400" @update:value="setGlobalJitter" /></n-form-item></div>
        </div>
        <div class="panel form-panel">
          <div class="panel-title"><div><h2>进行中游戏模式</h2><p>Spectator 仅返回可观战玩家，随后由 SGP 获取详情</p></div></div>
          <n-radio-group v-model:value="config.globalPolicy.ongoing.mode"><n-space><n-radio value="all">所有模式</n-radio><n-radio value="include">只包含所选队列</n-radio></n-space></n-radio-group>
          <n-select v-if="config.globalPolicy.ongoing.mode === 'include'" v-model:value="config.globalPolicy.ongoing.queueIds" multiple filterable tag :options="queueOptions" placeholder="选择或输入队列 ID" class="queue-select" />
        </div>
        <div class="panel form-panel">
          <div class="panel-title"><div><h2>历史记录模式</h2><p>默认仅监视灵活组排（队列 440）</p></div></div>
          <n-radio-group v-model:value="config.globalPolicy.history.mode"><n-space><n-radio value="all">所有模式</n-radio><n-radio value="include">只包含所选队列</n-radio></n-space></n-radio-group>
          <n-select v-if="config.globalPolicy.history.mode === 'include'" v-model:value="config.globalPolicy.history.queueIds" multiple filterable tag :options="queueOptions" placeholder="选择或输入队列 ID" class="queue-select" />
        </div>
        <div class="save-row"><n-button type="primary" :loading="store.loading" @click="save">保存周期与模式</n-button></div>
      </section>

      <section v-else-if="page === 'events'" class="settings-stack">
        <div class="panel form-panel">
          <div class="panel-title"><div><h2>HTTP POST Webhook</h2><p>敏感请求头由 Windows safeStorage 加密，渲染进程不会读回明文</p></div><n-switch v-model:value="config.webhook.enabled" /></div>
          <n-form-item label="Webhook URL"><n-input v-model:value="config.webhook.url" placeholder="https://example.com/webhook" /></n-form-item>
          <div class="header-list"><div v-for="header in config.webhook.headers" :key="header.id" class="header-row"><n-input v-model:value="header.name" placeholder="Header 名称" /><n-input v-model:value="header.value" :type="header.secret ? 'password' : 'text'" :placeholder="header.configured && header.secret ? '已安全保存；留空保持不变' : '值'" /><n-checkbox v-model:checked="header.secret">敏感</n-checkbox><n-button quaternary type="error" @click="removeHeader(header.id)">删除</n-button></div></div>
          <n-button size="small" dashed @click="addHeader">添加请求头</n-button>
        </div>
        <div v-for="type in eventTypes" :key="type" class="panel form-panel">
          <div class="panel-title"><div><h2>{{ type === 'ongoing_game_detected' ? '进行中游戏事件' : '新增历史对局事件' }}</h2><p>{{ type }}</p></div><n-button size="small" @click="test(type, 'all')">测试全部通道</n-button></div>
          <div class="form-row switches"><n-checkbox v-model:checked="config.events[type].webhookEnabled">发送 Webhook</n-checkbox><n-checkbox v-model:checked="config.events[type].notificationEnabled">Windows 应用通知</n-checkbox></div>
          <n-form-item label="Webhook JSON 模板"><n-input v-model:value="config.events[type].webhookTemplate" type="textarea" :autosize="{ minRows: 3, maxRows: 10 }" /></n-form-item>
          <div class="form-row"><n-form-item label="通知标题"><n-input v-model:value="config.events[type].notificationTitle" /></n-form-item><n-form-item label="通知正文"><n-input v-model:value="config.events[type].notificationBody" /></n-form-item></div>
          <p class="template-help">变量：eventJson、eventType、playerRiotId、playerPuuid、serverId、gameId、queueId、gameMode、occurredAt</p>
        </div>
        <div class="save-row"><n-button type="primary" :loading="store.loading" @click="save">保存事件设置</n-button></div>
      </section>

      <section v-else class="settings-stack">
        <div class="panel form-panel">
          <div class="panel-title"><div><h2>活动客户端</h2><p>检测到多个 League Client 时选择监视所使用的连接</p></div></div>
          <n-select :value="config.selectedConnectionPid" clearable :options="connectionOptions" placeholder="自动选择第一个健康连接" @update:value="selectConnection" />
        </div>
        <div class="panel form-panel">
          <div class="panel-title"><div><h2>关闭窗口行为</h2><p>“每次询问”会在下次关闭窗口时再次保存选择</p></div></div>
          <n-radio-group v-model:value="config.closeBehavior"><n-space><n-radio value="ask">每次询问</n-radio><n-radio value="tray">最小化到托盘</n-radio><n-radio value="quit">直接退出</n-radio></n-space></n-radio-group>
          <div class="save-row left"><n-button type="primary" @click="save">保存应用设置</n-button></div>
        </div>
        <div class="panel form-panel">
          <div class="panel-title"><div><h2>诊断信息</h2><p>版本 {{ store.snapshot.appVersion }} · 原生模块 {{ store.snapshot.nativeAvailable ? '可用' : '不可用 / CIM 回退' }}</p></div></div>
          <pre class="diagnostics">{{ store.snapshot.runtime.diagnostics.length ? store.snapshot.runtime.diagnostics.join('\n') : '暂无错误。LCU 令牌会自动从诊断信息中脱敏。' }}</pre>
        </div>
      </section>
    </main>

    <n-modal v-model:show="showAdd" preset="card" title="添加监视玩家" class="modal-card">
      <n-form label-placement="top">
        <div class="form-row"><n-form-item label="Riot ID 名称"><n-input v-model:value="draft.gameName" placeholder="玩家名称" /></n-form-item><n-form-item label="标签"><n-input v-model:value="draft.tagLine" placeholder="例如 JP1" /></n-form-item></div>
        <n-form-item label="服务器"><n-select v-model:value="draft.serverId" filterable :options="serverOptions" /></n-form-item>
        <n-collapse><n-collapse-item title="高级：直接填写 PUUID"><n-input v-model:value="draft.puuid" placeholder="填写后跳过 Riot ID 到 PUUID 的解析，但仍会验证服务器" /></n-collapse-item></n-collapse>
      </n-form>
      <template #footer><div class="modal-actions"><n-button @click="showAdd = false">取消</n-button><n-button type="primary" :loading="store.loading" @click="addPlayer">解析并添加</n-button></div></template>
    </n-modal>

    <n-modal v-model:show="showPolicy" preset="card" title="玩家单独策略" class="modal-card" v-if="editingPlayer">
      <n-checkbox :checked="editingPlayer.overridePolicy !== null" @update:checked="toggleOverride">覆盖全局设置</n-checkbox>
      <div v-if="editingPlayer.overridePolicy" class="override-form">
        <div class="form-row"><n-form-item label="周期（分钟）"><n-input-number :value="editingPlayer.overridePolicy.intervalMs / 60000" :min="1" :max="1440" @update:value="setOverrideInterval" /></n-form-item><n-form-item label="随机延迟（秒）"><n-input-number :value="editingPlayer.overridePolicy.jitterMs / 1000" :min="0" :max="86400" @update:value="setOverrideJitter" /></n-form-item></div>
        <n-form-item label="进行中队列"><n-select v-model:value="editingPlayer.overridePolicy.ongoing.queueIds" multiple filterable tag :options="queueOptions" placeholder="空列表配合“全部”模式" /></n-form-item>
        <n-radio-group v-model:value="editingPlayer.overridePolicy.ongoing.mode"><n-radio value="all">全部</n-radio><n-radio value="include">仅所选</n-radio></n-radio-group>
        <n-form-item label="历史队列"><n-select v-model:value="editingPlayer.overridePolicy.history.queueIds" multiple filterable tag :options="queueOptions" /></n-form-item>
        <n-radio-group v-model:value="editingPlayer.overridePolicy.history.mode"><n-radio value="all">全部</n-radio><n-radio value="include">仅所选</n-radio></n-radio-group>
      </div>
      <template #footer><div class="modal-actions"><n-button @click="showPolicy = false">取消</n-button><n-button type="primary" @click="savePlayerPolicy">保存</n-button></div></template>
    </n-modal>
  </div>
  <div v-else class="loading-screen"><div class="brand-mark large">L</div><p>正在启动 LCU Watchdog…</p></div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useMessage } from 'naive-ui'
import { DEFAULT_POLICY, QUEUE_PRESETS, newPlayerRuntime } from '@shared/defaults'
import { LEAGUE_SERVERS } from '@shared/servers'
import type { AppConfig, PlayerDraft, PlayerTarget, WatchEventType } from '@shared/types'
import { useWatchdogStore } from '../store'

const store = useWatchdogStore()
const message = useMessage()
const page = ref('overview')
const config = ref<AppConfig | null>(null)
const showAdd = ref(false)
const showPolicy = ref(false)
const editingPlayer = ref<PlayerTarget | null>(null)
const draft = ref<PlayerDraft>({ gameName: '', tagLine: '', serverId: 'JP', puuid: '' })
const eventTypes: WatchEventType[] = ['ongoing_game_detected', 'new_match_detected']
const pages = [
  { key: 'overview', icon: '⌂', label: '总览', description: '连接状态、调度进度与最近事件' },
  { key: 'players', icon: '◎', label: '玩家', description: '配置需要周期监视的玩家信息' },
  { key: 'schedule', icon: '◷', label: '周期与模式', description: '控制查询周期、随机延迟与队列过滤' },
  { key: 'events', icon: '◇', label: '事件', description: '配置 Webhook 与 Windows 应用通知' },
  { key: 'settings', icon: '⚙', label: '应用设置', description: '活动客户端、关闭行为与诊断信息' }
]
const currentPage = computed(() => pages.find((item) => item.key === page.value) ?? pages[0]!)
const enabledPlayers = computed(() => config.value?.players.filter((player) => player.enabled).length ?? 0)
const serverOptions = LEAGUE_SERVERS.map((server) => ({ label: `${server.name} (${server.id})`, value: server.id }))
const queueOptions = QUEUE_PRESETS.map((queue) => ({ label: `${queue.label} (${queue.value})`, value: queue.value }))
const connectionOptions = computed(() => store.snapshot?.connections.map((item) => ({ label: `${item.serverId} · PID ${item.pid}`, value: item.pid })) ?? [])

const cloneJson = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

watch(() => store.snapshot?.config, (value) => { if (value) config.value = cloneJson(value) }, { deep: true, immediate: true })

let removeNavigation: (() => void) | null = null
onMounted(async () => {
  await store.init()
  removeNavigation = window.watchdog.onNavigatePlayer(() => { page.value = 'players' })
})
onBeforeUnmount(() => removeNavigation?.())

function runtime(id: string) { return store.snapshot?.runtime.players[id] ?? newPlayerRuntime() }
function serverName(id: string) { return LEAGUE_SERVERS.find((server) => server.id === id)?.name ?? id }
function shortPuuid(value: string) { return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value }
function formatTime(value: string | null | undefined) { return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '未计划' }

async function guard(task: () => Promise<unknown>, success?: string) {
  try { await task(); if (success) message.success(success) }
  catch (error) { message.error(error instanceof Error ? error.message : String(error)) }
}
async function save() { if (config.value) await guard(() => store.saveConfig(cloneJson(config.value!)), '设置已保存') }
async function runAll() { await guard(() => store.runNow(), '查询已完成') }
async function runPlayer(id: string) { await guard(() => store.runNow(id), '查询已完成') }
async function selectConnection(pid: number | null) { if (config.value) config.value.selectedConnectionPid = pid; await guard(() => store.selectConnection(pid), '活动客户端已更新') }
function openAddPlayer() { draft.value = { gameName: '', tagLine: '', serverId: store.activeConnection?.serverId ?? 'JP', puuid: '' }; showAdd.value = true }
async function addPlayer() { await guard(async () => { await store.addPlayer(cloneJson(draft.value)); showAdd.value = false }, '玩家已添加') }
async function removePlayer(id: string) { await guard(() => store.removePlayer(id), '玩家已移除') }
async function togglePlayer(player: PlayerTarget, enabled: boolean) { await guard(() => store.updatePlayer({ ...cloneJson(player), enabled }), enabled ? '已开始监视' : '已暂停监视') }
function editPolicy(player: PlayerTarget) { editingPlayer.value = cloneJson(player); showPolicy.value = true }
function toggleOverride(enabled: boolean) { if (editingPlayer.value) editingPlayer.value.overridePolicy = enabled ? cloneJson(config.value?.globalPolicy ?? DEFAULT_POLICY) : null }
function setOverrideInterval(value: number | null) { if (editingPlayer.value?.overridePolicy && value) editingPlayer.value.overridePolicy.intervalMs = value * 60_000 }
function setOverrideJitter(value: number | null) { if (editingPlayer.value?.overridePolicy && value !== null) editingPlayer.value.overridePolicy.jitterMs = value * 1_000 }
async function savePlayerPolicy() { if (!editingPlayer.value) return; await guard(async () => { await store.updatePlayer(editingPlayer.value!); showPolicy.value = false }, '玩家策略已保存') }
function setGlobalInterval(value: number | null) { if (config.value && value) config.value.globalPolicy.intervalMs = value * 60_000 }
function setGlobalJitter(value: number | null) { if (config.value && value !== null) config.value.globalPolicy.jitterMs = value * 1_000 }
function addHeader() { config.value?.webhook.headers.push({ id: crypto.randomUUID(), name: '', value: '', secret: true, configured: false }) }
function removeHeader(id: string) { if (config.value) config.value.webhook.headers = config.value.webhook.headers.filter((header) => header.id !== id) }
async function test(type: WatchEventType, channel: 'all' | 'webhook' | 'notification') { await save(); const result = await store.testEvent({ type, channel }); if (result.ok) message.success(result.message); else message.error(result.message) }
</script>
