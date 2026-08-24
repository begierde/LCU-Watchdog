import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import https from 'node:https'
import process from 'node:process'

const require = createRequire(import.meta.url)
const native = require('lcu-native')
const pids = native.getPidsByName('LeagueClientUx.exe')
if (!pids.length) throw new Error('未发现 LeagueClientUx.exe')

let selected
let observedFlags = []
for (const pid of pids) {
  try {
    const commandLine = native.getProcessCommandLine(pid)
    observedFlags = [...commandLine.matchAll(/--([\w-]+)=/g)].map((match) => match[1])
    const value = (name) => commandLine.match(new RegExp(`--${name}=([^\\s"]+)`, 'i'))?.[1] ?? ''
    const candidate = {
      pid, port: Number(value('app-port')), token: value('remoting-auth-token'),
      region: value('rso[_-]platform[_-]id') || value('region')
    }
    if (candidate.port && candidate.token) { selected = candidate; break }
  } catch { /* a process can exit between enumeration and inspection */ }
}
if (!selected) throw new Error(`原生模块在 ${pids.length} 个候选进程中未找到完整 LCU 认证参数；检测到参数：${observedFlags.join(', ') || '无'}`)
const { pid, port, token, region } = selected

const certificateSource = await readFile(new URL('../src/main/lcu/certificate.ts', import.meta.url), 'utf8')
const certificate = certificateSource.match(/`([\s\S]+)`/)?.[1]
if (!certificate) throw new Error('无法读取 Riot LCU 证书')

const result = await new Promise((resolve, reject) => {
  const request = https.request({
    hostname: '127.0.0.1', port, path: '/riotclient/region-locale', method: 'GET', auth: `riot:${token}`,
    ca: certificate, rejectUnauthorized: true, checkServerIdentity: () => undefined, timeout: 5_000
  }, (response) => {
    response.resume()
    response.on('end', () => resolve({ status: response.statusCode }))
  })
  request.on('timeout', () => request.destroy(new Error('LCU 请求超时')))
  request.on('error', reject)
  request.end()
})

console.log(JSON.stringify({ found: true, pid, serverId: region, strictTls: true, ...result }))
process.exitCode = result.status === 200 ? 0 : 1
