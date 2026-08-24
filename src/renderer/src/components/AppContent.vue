<template>
  <div v-if="store.snapshot && config" class="app-shell">
    <div class="window-titlebar">
      <div class="window-tab">
        <span class="window-tab-mark">LCU</span>
        <strong>{{ currentPage.label }}</strong>
        <span v-if="selectedPlayer" class="window-tab-detail">{{ selectedPlayer.gameName }}#{{ selectedPlayer.tagLine }}</span>
      </div>
      <div class="window-drag-space"></div>
      <div class="window-connection" :class="store.activeConnection?.health ?? 'unavailable'">
        <span class="status-dot"></span>
        {{ store.activeConnection ? `${store.activeConnection.serverId} · 已连接` : '等待客户端' }}
      </div>
      <div class="window-controls">
        <button type="button" aria-label="最小化" title="最小化" @click="controlWindow('minimize')"><Subtract20Regular /></button>
        <button type="button" :aria-label="windowMaximized ? '还原' : '最大化'" :title="windowMaximized ? '还原' : '最大化'" @click="controlWindow('toggle-maximize')">
          <SquareMultiple20Regular v-if="windowMaximized" /><Maximize20Regular v-else />
        </button>
        <button type="button" class="window-close" aria-label="关闭" title="关闭" @click="controlWindow('close')"><Dismiss20Regular /></button>
      </div>
    </div>
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
        <template v-if="selectedPlayer">
          <div class="detail-toolbar"><n-button quaternary @click="selectedPlayerId = null">← 返回玩家列表</n-button><n-button type="primary" :loading="runtime(selectedPlayer.id).running" @click="runPlayer(selectedPlayer.id)">刷新战绩</n-button></div>
          <div class="player-profile-panel">
            <div class="profile-portrait">
              <span>{{ selectedPlayer.gameName.slice(0, 1).toUpperCase() }}</span>
              <img v-if="selectedPlayer.profileIconId !== undefined" :src="profileIconUrl(selectedPlayer.profileIconId)" :alt="`${selectedPlayer.gameName} 头像`" @error="hideBrokenImage" />
              <b v-if="selectedPlayer.summonerLevel !== undefined">{{ selectedPlayer.summonerLevel }}</b>
            </div>
            <div class="profile-copy"><span class="eyebrow">{{ serverName(selectedPlayer.serverId) }} · MONITORED PLAYER</span><h2>{{ selectedPlayer.gameName }}<small>#{{ selectedPlayer.tagLine }}</small></h2><p>{{ shortPuuid(selectedPlayer.puuid) }}</p></div>
            <div class="profile-status"><span :class="{ live: runtime(selectedPlayer.id).running }"></span>{{ runtime(selectedPlayer.id).running ? '正在更新' : selectedPlayer.enabled ? '监视中' : '已暂停' }}</div>
          </div>
          <div class="history-heading"><div><h2>最近对局</h2><p>来自当前 LCU / SGP 连接，最多保留最近 20 场</p></div><span>{{ runtime(selectedPlayer.id).recentMatches.length }} 场</span></div>
          <div v-if="runtime(selectedPlayer.id).lastError" class="history-error">{{ runtime(selectedPlayer.id).lastError }}</div>
          <div v-if="!runtime(selectedPlayer.id).recentMatches.length" class="panel empty-state tall">暂无历史数据。点击“刷新战绩”立即查询。</div>
          <div v-else class="history-list">
            <article v-for="match in runtime(selectedPlayer.id).recentMatches" :key="match.gameId" class="match-card" :class="{ win: match.win === true, loss: match.win === false }">
              <div class="result-mark"><strong>{{ match.win === true ? '胜利' : match.win === false ? '失败' : '对局' }}</strong><span>{{ formatTime(match.startedAt) }}</span></div>
              <div class="champion-portrait">
                <img v-if="match.championId" :src="championIconUrl(match.championId)" :alt="match.championName || '英雄'" />
                <span v-else>◆</span>
              </div>
              <div class="match-main"><strong>{{ match.championName || queueName(match.queueId) }}</strong><span>{{ queueName(match.queueId) }} · {{ match.gameMode || '未知模式' }}</span></div>
              <div class="match-kda" v-if="match.kills !== undefined"><strong>{{ match.kills }} / {{ match.deaths ?? 0 }} / {{ match.assists ?? 0 }}</strong><span>K / D / A</span></div>
              <div class="match-meta"><strong>{{ formatDuration(match.durationSeconds) }}</strong><span>#{{ match.gameId }}</span></div>
            </article>
          </div>
        </template>
        <template v-else>
          <div class="toolbar"><span>选择玩家可查看资料与最近对局</span><n-button type="primary" @click="openAddPlayer">添加玩家</n-button></div>
          <div v-if="!config.players.length" class="panel empty-state tall">尚未配置玩家。添加后会在 5 秒内进行首次查询。</div>
          <div class="player-grid">
            <article v-for="player in config.players" :key="player.id" class="player-card clickable" tabindex="0" @click="selectedPlayerId = player.id" @keydown.enter="selectedPlayerId = player.id">
              <div class="player-head">
                <div class="avatar profile-avatar"><span>{{ player.gameName.slice(0, 1).toUpperCase() }}</span><img v-if="player.profileIconId !== undefined" :src="profileIconUrl(player.profileIconId)" :alt="`${player.gameName} 头像`" @error="hideBrokenImage" /><b v-if="player.summonerLevel !== undefined">{{ player.summonerLevel }}</b></div>
                <div><h3>{{ player.gameName }}<small>#{{ player.tagLine }}</small></h3><p>{{ serverName(player.serverId) }} · 等级 {{ player.summonerLevel ?? '—' }}</p></div>
                <n-switch :value="player.enabled" @click.stop @update:value="togglePlayer(player, $event)" />
              </div>
              <div class="runtime-line"><span :class="{ running: runtime(player.id).running }"></span>{{ runtime(player.id).running ? '查询中' : runtime(player.id).lastError || `下次：${formatTime(runtime(player.id).nextRunAt)}` }}</div>
              <div class="player-actions" @click.stop><n-button size="small" @click="runPlayer(player.id)">立即查询</n-button><n-button size="small" @click="editPolicy(player)">单独策略</n-button><n-popconfirm @positive-click="removePlayer(player.id)"><template #trigger><n-button size="small" type="error" ghost>移除</n-button></template>确认移除这个玩家？</n-popconfirm></div>
            </article>
          </div>
        </template>
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
          <div class="panel-title"><div><h2>Webhook 推送</h2><p>默认适配 Server酱，也可切换为通用 JSON POST</p></div><n-switch v-model:value="config.webhook.enabled" /></div>
          <n-form-item label="服务类型"><n-select v-model:value="config.webhook.provider" :options="webhookProviderOptions" /></n-form-item>
          <template v-if="config.webhook.provider === 'serverchan'">
            <n-alert type="info" :show-icon="false" class="provider-note">使用 Server酱 Turbo：事件将以 title + Markdown desp 推送。<a href="https://sct.ftqq.com/sendkey/" target="_blank" rel="noreferrer">获取 SendKey</a></n-alert>
            <n-form-item label="SendKey"><n-input v-model:value="config.webhook.sendKey" type="password" show-password-on="click" :placeholder="config.webhook.sendKeyConfigured ? '已通过 Windows 安全存储保存；留空保持不变' : 'SCT 开头的 SendKey'" /></n-form-item>
            <p v-if="config.webhook.sendKeyConfigured && !config.webhook.sendKey" class="secret-status">✓ SendKey 已通过 Windows 安全存储加密保存</p>
          </template>
          <template v-else>
            <n-form-item label="Webhook URL"><n-input v-model:value="config.webhook.url" placeholder="https://example.com/webhook" /></n-form-item>
            <div class="header-list"><div v-for="header in config.webhook.headers" :key="header.id" class="header-row"><n-input v-model:value="header.name" placeholder="Header 名称" /><n-input v-model:value="header.value" :type="header.secret ? 'password' : 'text'" :placeholder="header.configured && header.secret ? '已安全保存；留空保持不变' : '值'" /><n-checkbox v-model:checked="header.secret">敏感</n-checkbox><n-button quaternary type="error" @click="removeHeader(header.id)">删除</n-button></div></div>
            <n-button size="small" dashed @click="addHeader">添加请求头</n-button>
          </template>
        </div>
        <div v-for="type in eventTypes" :key="type" class="panel form-panel">
          <div class="panel-title"><div><h2>{{ type === 'ongoing_game_detected' ? '进行中游戏事件' : '新增历史对局事件' }}</h2><p>{{ type }}</p></div><n-button size="small" @click="test(type, 'all')">测试全部通道</n-button></div>
          <div class="form-row switches"><n-checkbox v-model:checked="config.events[type].webhookEnabled">发送 Webhook</n-checkbox><n-checkbox v-model:checked="config.events[type].notificationEnabled">Windows 应用通知</n-checkbox></div>
          <n-form-item :label="config.webhook.provider === 'serverchan' ? 'Server酱消息模板（JSON）' : 'Webhook JSON 模板'"><n-input v-model:value="config.events[type].webhookTemplate" type="textarea" :autosize="{ minRows: 3, maxRows: 10 }" /></n-form-item>
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
        <n-form-item label="Riot ID">
          <n-input v-model:value="riotIdInput" placeholder="游戏名#标签" @keyup.enter="addPlayer" />
          <template #feedback>名称和标签使用 # 分隔，可直接从客户端或战绩网站复制。</template>
        </n-form-item>
        <n-alert type="info" :show-icon="false">服务器将自动使用当前活动的 LCU / SGP 连接。</n-alert>
        <n-collapse><n-collapse-item title="高级：直接填写 PUUID"><n-input v-model:value="draft.puuid" placeholder="填写后跳过 Riot ID 解析，并使用当前连接服务器" /></n-collapse-item></n-collapse>
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useMessage } from 'naive-ui'
import Dismiss20Regular from '@vicons/fluent/es/Dismiss20Regular'
import Maximize20Regular from '@vicons/fluent/es/Maximize20Regular'
import SquareMultiple20Regular from '@vicons/fluent/es/SquareMultiple20Regular'
import Subtract20Regular from '@vicons/fluent/es/Subtract20Regular'
import { DEFAULT_POLICY, QUEUE_PRESETS, newPlayerRuntime } from '@shared/defaults'
import { parseRiotId } from '@shared/riot-id'
import { LEAGUE_SERVERS } from '@shared/servers'
import type { AppConfig, PlayerDraft, PlayerTarget, WatchEventType } from '@shared/types'
import { useWatchdogStore } from '../store'

const store = useWatchdogStore()
const message = useMessage()
const page = ref('overview')
const config = ref<AppConfig | null>(null)
const configDirty = ref(false)
const showAdd = ref(false)
const showPolicy = ref(false)
const editingPlayer = ref<PlayerTarget | null>(null)
const selectedPlayerId = ref<string | null>(null)
const windowMaximized = ref(false)
const draft = ref<PlayerDraft>({ gameName: '', tagLine: '', serverId: 'JP', puuid: '' })
const riotIdInput = ref('')
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
const selectedPlayer = computed(() => config.value?.players.find((player) => player.id === selectedPlayerId.value) ?? null)
const queueOptions = QUEUE_PRESETS.map((queue) => ({ label: `${queue.label} (${queue.value})`, value: queue.value }))
const webhookProviderOptions = [{ label: 'Server酱（推荐）', value: 'serverchan' }, { label: '通用 JSON Webhook', value: 'generic' }]
const connectionOptions = computed(() => store.snapshot?.connections.map((item) => ({ label: `${item.serverId} · PID ${item.pid}`, value: item.pid })) ?? [])

const cloneJson = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

let syncingConfig = false
function replaceLocalConfig(value: AppConfig) {
  syncingConfig = true
  config.value = cloneJson(value)
  configDirty.value = false
  void nextTick(() => { syncingConfig = false })
}
watch(() => store.snapshot?.config, (value) => {
  if (value && (!config.value || !configDirty.value)) replaceLocalConfig(value)
}, { deep: true, immediate: true })
watch(config, () => { if (!syncingConfig) configDirty.value = true }, { deep: true })

let removeNavigation: (() => void) | null = null
let removeWindowMaximized: (() => void) | null = null
onMounted(async () => {
  await store.init()
  removeNavigation = window.watchdog.onNavigatePlayer((playerId) => { page.value = 'players'; selectedPlayerId.value = playerId })
  removeWindowMaximized = window.watchdog.onWindowMaximized((maximized) => { windowMaximized.value = maximized })
})
onBeforeUnmount(() => { removeNavigation?.(); removeWindowMaximized?.() })

function runtime(id: string) { return store.snapshot?.runtime.players[id] ?? newPlayerRuntime() }
function serverName(id: string) { return LEAGUE_SERVERS.find((server) => server.id === id)?.name ?? id }
function shortPuuid(value: string) { return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value }
function formatTime(value: string | null | undefined) { return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '未计划' }
function formatDuration(value: number | undefined) {
  if (!value || value < 0) return '时长未知'
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`
}
function queueName(queueId: number) { return QUEUE_PRESETS.find((queue) => queue.value === queueId)?.label ?? `队列 ${queueId}` }
function profileIconUrl(iconId: number) { return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${iconId}.jpg` }
function championIconUrl(championId: number) { return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${championId}.png` }
function hideBrokenImage(event: unknown) {
  const image = (event as { currentTarget?: { style: { display: string } } }).currentTarget
  if (image) image.style.display = 'none'
}

async function guard(task: () => Promise<unknown>, success?: string) {
  try { await task(); if (success) message.success(success) }
  catch (error) { message.error(error instanceof Error ? error.message : String(error)) }
}
async function save(): Promise<boolean> {
  if (!config.value) return false
  try {
    await store.saveConfig(cloneJson(config.value))
    if (store.snapshot?.config) replaceLocalConfig(store.snapshot.config)
    message.success('设置已保存')
    return true
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error))
    return false
  }
}
async function runAll() { await guard(() => store.runNow(), '查询已完成') }
async function runPlayer(id: string) { await guard(() => store.runNow(id), '查询已完成') }
async function selectConnection(pid: number | null) { if (config.value) config.value.selectedConnectionPid = pid; await guard(() => store.selectConnection(pid), '活动客户端已更新') }
function openAddPlayer() {
  draft.value = { gameName: '', tagLine: '', serverId: store.activeConnection?.serverId ?? 'JP', puuid: '' }
  riotIdInput.value = ''
  showAdd.value = true
}
async function addPlayer() {
  await guard(async () => {
    const parsed = parseRiotId(riotIdInput.value)
    if (!draft.value.puuid?.trim() && !parsed) throw new Error('请输入完整 Riot ID（游戏名#标签）')
    if (riotIdInput.value.trim() && !parsed) throw new Error('Riot ID 格式不正确，名称和标签之间需要一个 #')
    draft.value.gameName = parsed?.gameName ?? ''
    draft.value.tagLine = parsed?.tagLine ?? ''
    await store.addPlayer(cloneJson(draft.value))
    showAdd.value = false
  }, '玩家已添加')
}
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
async function test(type: WatchEventType, channel: 'all' | 'webhook' | 'notification') {
  if (!(await save())) return
  const result = await store.testEvent({ type, channel })
  if (result.ok) message.success(result.message); else message.error(result.message)
}
async function controlWindow(action: 'minimize' | 'toggle-maximize' | 'close') {
  windowMaximized.value = await window.watchdog.windowControl(action)
}
</script>
