# LCU Watchdog

![Version](https://img.shields.io/badge/version-0.2.2-7356C5)
![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-0078D4)
![Electron](https://img.shields.io/badge/Electron-43-47848F)
![License](https://img.shields.io/badge/license-MIT-59D1AD)

LCU Watchdog 是一个 Windows Electron 桌面应用。它自动发现本机已登录的 League Client，周期监视指定玩家的进行中游戏和历史对局，并通过 Server酱、通用 HTTP Webhook 或 Windows 应用通知发送事件。

> 项目不需要 Riot Developer API Key。LCU 和 Riot Client 认证令牌仅保存在 Electron 主进程内，不会发送到渲染页面。

## 主要功能

- 自动发现 `LeagueClientUx.exe` 的 PID、端口及认证参数。
- 支持 Riot ID（`游戏名#标签`）添加玩家，也可在高级模式直接填写 PUUID。
- 玩家服务器默认跟随当前 LCU / SGP 连接，无需手动选择或验证。
- 使用 LCU Spectator 接口预筛可观战玩家，再通过 SGP GSM 获取进行中对局详情。
- 对同区好友读取 LCU 在线状态，区分“在线”“离线”“游戏中”和真正的“查询受限”；离线不影响历史记录监视。
- 查询最近历史记录；首次查询只建立基线，之后仅通知新增对局。
- 支持全局策略和玩家级覆盖，可配置周期、正向随机延迟以及实时/历史队列过滤。
- 同一玩家不会并发查询，全局查询并发上限为 2。
- 历史和进行中对局均持久去重，应用重启后不会重复通知。
- Server酱与通用 JSON Webhook；每类事件可独立控制 Webhook 和 Windows 通知。
- Webhook 敏感字段通过 Electron `safeStorage` 加密。
- 支持多个 League Client 连接、托盘运行和自定义关闭行为。
- 深色无边框窗口、三项主导航、会话内多玩家页签及紧凑对局列表。

## 监视流程

每位已启用玩家按以下流程执行：

1. 当前服务器玩家通过 LCU Spectator 接口检查可观战状态。
2. 对可观战玩家调用 SGP GSM 获取进行中对局详情。
3. 查询最近 20 条历史记录，同区优先使用 LCU Match History，支持时使用 SGP。
4. 根据进行中/历史队列规则过滤并检查持久去重状态。
5. 生成 `ongoing_game_detected` 或 `new_match_detected` 事件。
6. 按事件设置发送 Webhook 和 Windows 通知。

调度周期从上一次查询完成后重新计算：

```text
下次执行时间 = 完成时间 + 基础周期 + [0, 最大随机延迟] 的随机值
```

默认基础周期为 5 分钟，随机延迟为 0–60 秒；默认历史记录只监视灵活组排队列 `440`。

## Server酱 Webhook

在“设置 → 事件通知”中：

1. 启用 Webhook。
2. 服务类型选择“Server酱”。
3. 展开“高级设置”，填写从 `https://sct.ftqq.com/sendkey` 获取的 SendKey。
4. 保存更改。
5. 分别为“进行中游戏”和“新增历史对局”启用 Webhook。
6. 保存后使用“测试此事件”验证配置。

默认 Server酱模板：

```json
{
  "title": "{{playerRiotId}} 有新对局",
  "desp": "**服务器**：{{serverId}}\n\n**模式**：{{gameMode}}（队列 {{queueId}}）\n\n**对局 ID**：{{gameId}}"
}
```

`gameMode` 会转换为可读队列名称，不会只显示 LCU 的原始 `CLASSIC`：

| 队列 ID | Webhook 显示 |
| ---: | --- |
| 400 | 普通征召 |
| 420 | 单双排 |
| 440 | 灵活组排 |
| 450 | 极地大乱斗 |
| 490 | 快速匹配 |
| 710 | 特殊模式 |
| 1700 | 斗魂竞技场 |
| 2400 | 极地大乱斗：混沌 |

未知的 `CLASSIC` 队列会显示为 `特殊模式（队列 ID）`。队列名称参考 [Riot 官方队列定义](https://static.developer.riotgames.com/docs/lol/queues.json)，并补充本地客户端可能返回的区域性队列。

## 事件与模板变量

事件类型：

- `ongoing_game_detected`：首次检测到符合过滤条件的进行中游戏。
- `new_match_detected`：历史基线建立后检测到的新对局。

Webhook 模板必须是合法 JSON。可使用 `{{eventJson}}` 发送完整事件，或使用以下变量：

| 变量 | 含义 |
| --- | --- |
| `eventId` | 本地生成的唯一事件 ID |
| `eventType` | 事件类型 |
| `occurredAt` | 事件发生时间 |
| `playerRiotId` | `游戏名#标签` |
| `playerPuuid` | 玩家 PUUID |
| `serverId` | 玩家服务器 ID |
| `gameId` | 对局 ID |
| `queueId` | 数字队列 ID |
| `queueName` | 中文可读队列名称 |
| `gameMode` | 优先按队列 ID 转换的可读游戏模式 |
| `rawGameMode` | LCU / SGP 返回的原始模式，如 `CLASSIC` |
| `gameStartedAt` | 对局开始时间 |
| `eventJson` | 完整事件对象，`game` 中同时包含可读和原始模式 |

测试事件仅使用 `测试#测试` 等合成值，不会把真实玩家、PUUID、SendKey 或认证令牌放入测试消息。

Webhook 超时为 10 秒。网络错误、HTTP 408、429 和 5xx 会按 1/5/15 秒重试；其他 4xx 不重试。

## 安装

仅支持 Windows 10/11 x64，并要求应用与 League Client 运行在同一 Windows 用户下。

使用构建产物：

```text
release/LCU Watchdog-<version>-x64-setup.exe
release/LCU Watchdog-<version>-x64-portable.zip
```

安装程序支持选择目录，并创建桌面及开始菜单快捷方式。便携 ZIP 解压后可直接运行 `LCU Watchdog.exe`。玩家、去重状态和 Webhook 密钥保存在 Electron `userData` 目录，不会写入程序目录或便携 ZIP。项目暂不包含自动更新、开机自启和代码签名证书。

## 开发环境

要求：

- Windows 10/11 x64
- Node.js 22 或更高版本
- Visual Studio 2022/2026
- MSVC x64 C++ 工具链
- Windows 10/11 SDK
- Python（供 `node-gyp` 使用）

安装依赖并启动开发环境：

```powershell
npm install
npm run dev
```

常用命令：

```powershell
npm run typecheck       # Vue/TypeScript 类型检查
npm run lint            # ESLint
npm test                # Vitest 单元与原生集成测试
npm run build           # Electron 生产构建
npm run rebuild:native  # 按 Electron ABI 重编译原生模块
npm run qa:electron     # Electron UI 冒烟测试
npm run qa:package      # win-unpacked 打包版冒烟测试
npm run qa:lcu          # 真实 LCU 脱敏连接检查
npm run package:win     # Windows x64 NSIS 安装包
```

输出目录：

- `out/`：Electron 主进程、preload 和 renderer 构建。
- `release/win-unpacked/`：免安装解包版本。
- `release/LCU Watchdog-<version>-x64-portable.zip`：不含本机用户数据的免安装 ZIP。
- `release/LCU Watchdog-<version>-x64-setup.exe`：NSIS 安装包。
- `output/playwright/`：Electron UI 测试截图。

## 技术结构

```text
src/
├─ main/       Electron 主进程、LCU/SGP、调度、通知与持久化
├─ preload/    白名单 IPC API
├─ renderer/   Vue 3、Pinia、Naive UI 桌面界面
└─ shared/     配置、事件、队列及共享类型

native/
└─ lcu-native/ C++17 Node-API Windows 进程发现模块
```

安全配置：

- `contextIsolation: true`
- renderer sandbox 已开启
- `nodeIntegration: false`
- 渲染进程只通过白名单 preload IPC 使用主进程能力

## 数据位置与安全

- 配置和去重状态保存在 Electron `userData` 目录。
- JSON 写入使用临时文件替换方式，读取时通过 Zod 校验。
- SendKey 和敏感请求头使用 Windows 支持的 Electron `safeStorage` 加密。
- LCU / Riot Client 令牌不会写入 renderer 配置或 IPC 快照。
- 诊断日志会对已知认证参数脱敏。
- 请勿在 Issue、截图或日志中提交真实 SendKey、PUUID、LCU 令牌或 Riot Client 令牌。

## 已知限制

- Spectator 接口只返回可观战玩家，因此无法保证检测到不可观战的进行中对局。
- 国际服只查询当前登录区域。
- 腾讯跨区只查询历史记录，跨区玩家不执行进行中游戏查询。
- 查询依赖本机已登录的 LCU 及其会话令牌；League Client 离线时应用会等待并自动重连。
- Riot、LCU 和 SGP 均不是稳定的公共应用接口，上游更新可能需要同步适配。

## 研究来源

LCU 发现、SGP 服务器映射与接口行为参考：

- [League Akari](https://github.com/LeagueAkari/LeagueAkari)
- [HextechDocs LCU API 文档](https://github.com/HextechDocs/lcu-api-docs)
- [Riot 队列定义](https://static.developer.riotgames.com/docs/lol/queues.json)

本项目独立实现相关逻辑，没有直接复制 League Akari 源文件。League of Legends、Riot Games 及相关标识归 Riot Games 所有，本项目与 Riot Games 无隶属或授权关系。

## License

[MIT](LICENSE)
