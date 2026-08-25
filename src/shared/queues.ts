const QUEUE_NAMES: Record<number, string> = {
  400: '普通征召',
  420: '单双排',
  430: '匹配模式',
  440: '灵活组排',
  450: '极地大乱斗',
  480: '迅捷模式',
  490: '快速匹配',
  700: '峡谷冠军杯赛',
  710: '特殊模式',
  720: '大乱斗冠军杯赛',
  870: '人机入门',
  880: '人机新手',
  890: '人机一般',
  900: '无限火力（随机）',
  1020: '克隆大作战',
  1300: '极限闪击',
  1400: '终极魔典',
  1700: '斗魂竞技场',
  1710: '斗魂竞技场（16 人）',
  1750: '斗魂竞技场（双人）',
  1810: '无尽狂潮（单人）',
  1820: '无尽狂潮（双人）',
  1830: '无尽狂潮（三人）',
  1840: '无尽狂潮（四人）',
  1900: '无限火力（自选）',
  2300: '班德尔大乱斗',
  2400: '极地大乱斗：混沌'
}

const GAME_MODE_NAMES: Record<string, string> = {
  ARAM: '极地大乱斗',
  CHERRY: '斗魂竞技场',
  CLASSIC: '召唤师峡谷',
  KINGPORO: '魄罗大乱斗',
  NEXUSBLITZ: '极限闪击',
  ODIN: '水晶之痕',
  ONEFORALL: '克隆大作战',
  PRACTICETOOL: '训练模式',
  TUTORIAL: '新手教程',
  ULTBOOK: '终极魔典',
  URF: '无限火力'
}

export function knownQueueName(queueId: number): string | null {
  return QUEUE_NAMES[queueId] ?? null
}

export function queueDisplayName(queueId: number): string {
  return knownQueueName(queueId) ?? `队列 ${queueId}`
}

export function gameModeDisplayName(queueId: number, rawGameMode: string): string {
  const queueName = knownQueueName(queueId)
  if (queueName) return queueName
  const normalized = rawGameMode.trim().toUpperCase()
  if (normalized && normalized !== 'CLASSIC') return GAME_MODE_NAMES[normalized] ?? rawGameMode
  return queueId > 0 ? `特殊模式（队列 ${queueId}）` : (GAME_MODE_NAMES[normalized] ?? '未知模式')
}
