# LCU Watchdog

LCU Watchdog 是一个仅面向 Windows 的 Electron 桌面应用。它从本机 League Client 自动发现 LCU/Riot Client 连接信息，周期监视指定玩家的进行中游戏和历史对局，并通过 HTTP Webhook 或 Windows 应用通知发送事件。

## 功能

- 使用 Windows 原生 Node-API 模块枚举 `LeagueClientUx.exe`，通过 `NtQueryInformationProcess(ProcessCommandLineInformation)` 读取 LCU 端口、PID 和认证参数。
- 原生读取连续失败时使用只读 CIM 查询回退；不会自动提权。
- 通过 Riot ID（`gameName#tagLine`）解析 PUUID，也允许高级用户直接填写 PUUID。
- 同区使用 LCU Match History，腾讯跨区使用 SGP；国际服只支持当前登录区域。
- 使用 LCU `POST /lol-spectator/v3/buddy/spectate` 预筛可观战玩家，再通过 SGP GSM 获取进行中对局详情。
- 全局监视策略和玩家级覆盖，支持队列过滤、基础周期及仅正向的随机延迟。
- 首次历史查询只建立基线；进行中游戏首次发现立即触发。事件 ID 持久化去重，重启后不会重复通知。
- 每类事件可分别配置 Webhook JSON 模板和 Windows 通知模板。敏感 Webhook 请求头使用 Electron `safeStorage` 加密。
- 多 LCU 连接选择、安全 preload IPC、托盘运行和可配置关闭行为。

## 开发

要求 Windows 10/11 x64、Node.js 22 或更高版本、Visual Studio 2022/2026 C++ x64 工具链及 Windows SDK。

```powershell
npm install
npm run dev
```

常用验证命令：

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run rebuild:native
npm run qa:electron
npm run package:win
```

生产构建位于 `out/`，NSIS 安装包和免安装解包目录位于 `release/`。

## 事件模板

Webhook 模板必须是合法 JSON，可使用 `{{eventJson}}` 发送完整事件，或使用以下变量组装对象：

`eventId`、`eventType`、`occurredAt`、`playerRiotId`、`playerPuuid`、`serverId`、`gameId`、`queueId`、`queueName`、`gameMode`、`rawGameMode`、`gameStartedAt`。其中 `gameMode` 和 `queueName` 为“单双排”“灵活组排”“极地大乱斗：混沌”等可读名称，`rawGameMode` 保留 LCU/SGP 原始值。

事件类型：

- `ongoing_game_detected`
- `new_match_detected`

Webhook 对网络错误、408、429 和 5xx 按 1/5/15 秒重试；其他 4xx 不重试。

## 数据与安全

- LCU 和 Riot Client 认证令牌仅存在于 Electron 主进程内，不会通过 IPC 发送到页面。
- 配置与去重状态保存在 Electron `userData` 目录；日志会对已知认证参数脱敏。
- 应用不需要 Riot Developer API Key，但必须有已登录的本机 League Client。
- Spectator 接口只返回可观战玩家，因此无法保证检测到不可观战的进行中对局。
- 腾讯跨区只查询历史记录；跨区进行中游戏不会查询。

## 研究来源

LCU 发现、SGP 服务器映射与接口行为参考了 [League Akari](https://github.com/LeagueAkari/LeagueAkari) 和 [HextechDocs LCU API 文档](https://github.com/HextechDocs/lcu-api-docs)。本项目独立实现相关逻辑，没有直接复制 League Akari 源文件。

## License

MIT
