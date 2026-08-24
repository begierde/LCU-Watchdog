export interface LeagueServer {
  id: string
  name: string
  commonUrl: string
  matchHistoryUrl: string
  regionPathParam?: string
  isTencent: boolean
}

export const LEAGUE_SERVERS: LeagueServer[] = [
  { id: 'TENCENT_HN1', name: '艾欧尼亚', commonUrl: 'https://hn1-k8s-sgp.lol.qq.com:21019', matchHistoryUrl: 'https://hn1-k8s-sgp.lol.qq.com:21019', isTencent: true },
  { id: 'TENCENT_HN10', name: '黑色玫瑰', commonUrl: 'https://hn10-k8s-sgp.lol.qq.com:21019', matchHistoryUrl: 'https://hn10-k8s-sgp.lol.qq.com:21019', isTencent: true },
  { id: 'TENCENT_TJ100', name: '联盟四区', commonUrl: 'https://tj100-sgp.lol.qq.com:21019', matchHistoryUrl: 'https://tj100-sgp.lol.qq.com:21019', isTencent: true },
  { id: 'TENCENT_TJ101', name: '联盟五区', commonUrl: 'https://tj101-sgp.lol.qq.com:21019', matchHistoryUrl: 'https://tj101-sgp.lol.qq.com:21019', isTencent: true },
  { id: 'TENCENT_NJ100', name: '联盟一区', commonUrl: 'https://nj100-sgp.lol.qq.com:21019', matchHistoryUrl: 'https://nj100-sgp.lol.qq.com:21019', isTencent: true },
  { id: 'TENCENT_GZ100', name: '联盟二区', commonUrl: 'https://gz100-sgp.lol.qq.com:21019', matchHistoryUrl: 'https://gz100-sgp.lol.qq.com:21019', isTencent: true },
  { id: 'TENCENT_CQ100', name: '联盟三区', commonUrl: 'https://cq100-sgp.lol.qq.com:21019', matchHistoryUrl: 'https://cq100-sgp.lol.qq.com:21019', isTencent: true },
  { id: 'TENCENT_BGP2', name: '峡谷之巅', commonUrl: 'https://bgp2-k8s-sgp.lol.qq.com:21019', matchHistoryUrl: 'https://bgp2-k8s-sgp.lol.qq.com:21019', isTencent: true },
  { id: 'TENCENT_PBE', name: 'PBE（腾讯）', commonUrl: 'https://pbe-sgp.lol.qq.com:21019', matchHistoryUrl: 'https://pbe-sgp.lol.qq.com:21019', isTencent: true },
  { id: 'TENCENT_PREPBE', name: 'PREPBE（腾讯）', commonUrl: 'https://prepbe-sgp.lol.qq.com:21019', matchHistoryUrl: 'https://prepbe-sgp.lol.qq.com:21019', isTencent: true },
  { id: 'TW2', name: '台湾', commonUrl: 'https://tw2-red.lol.sgp.pvp.net', matchHistoryUrl: 'https://apse1-red.pp.sgp.pvp.net', isTencent: false },
  { id: 'SG2', name: '新加坡', commonUrl: 'https://sg2-red.lol.sgp.pvp.net', matchHistoryUrl: 'https://apse1-red.pp.sgp.pvp.net', isTencent: false },
  { id: 'PH2', name: '菲律宾', commonUrl: 'https://ph2-red.lol.sgp.pvp.net', matchHistoryUrl: 'https://apse1-red.pp.sgp.pvp.net', isTencent: false },
  { id: 'VN2', name: '越南', commonUrl: 'https://vn2-red.lol.sgp.pvp.net', matchHistoryUrl: 'https://apse1-red.pp.sgp.pvp.net', isTencent: false },
  { id: 'PBE', name: 'PBE', commonUrl: 'https://pbe-red.lol.sgp.pvp.net', matchHistoryUrl: 'https://usw2-red.pp.sgp.pvp.net', regionPathParam: 'PBE1', isTencent: false },
  { id: 'EUW', name: '欧洲西部', commonUrl: 'https://euw-red.lol.sgp.pvp.net', matchHistoryUrl: 'https://euc1-red.pp.sgp.pvp.net', regionPathParam: 'EUW1', isTencent: false },
  { id: 'JP', name: '日本', commonUrl: 'https://jp-red.lol.sgp.pvp.net', matchHistoryUrl: 'https://apne1-red.pp.sgp.pvp.net', regionPathParam: 'JP1', isTencent: false },
  { id: 'RU', name: '俄罗斯', commonUrl: 'https://ru-red.lol.sgp.pvp.net', matchHistoryUrl: 'https://euc1-red.pp.sgp.pvp.net', isTencent: false },
  { id: 'BR1', name: '巴西', commonUrl: 'https://br-red.lol.sgp.pvp.net', matchHistoryUrl: 'https://usw2-red.pp.sgp.pvp.net', isTencent: false },
  { id: 'OC1', name: '大洋洲', commonUrl: 'https://oce-red.lol.sgp.pvp.net', matchHistoryUrl: 'https://apse1-red.pp.sgp.pvp.net', isTencent: false },
  { id: 'TR1', name: '土耳其', commonUrl: 'https://tr-red.lol.sgp.pvp.net', matchHistoryUrl: 'https://euc1-red.pp.sgp.pvp.net', isTencent: false },
  { id: 'LA1', name: '拉丁美洲北部', commonUrl: 'https://lan-red.lol.sgp.pvp.net', matchHistoryUrl: 'https://usw2-red.pp.sgp.pvp.net', isTencent: false },
  { id: 'LA2', name: '拉丁美洲南部', commonUrl: 'https://las-red.lol.sgp.pvp.net', matchHistoryUrl: 'https://usw2-red.pp.sgp.pvp.net', isTencent: false },
  { id: 'NA1', name: '北美', commonUrl: 'https://na-red.lol.sgp.pvp.net', matchHistoryUrl: 'https://usw2-red.pp.sgp.pvp.net', isTencent: false },
  { id: 'TH2', name: '泰国', commonUrl: 'https://th2-red.lol.sgp.pvp.net', matchHistoryUrl: 'https://apse1-red.pp.sgp.pvp.net', isTencent: false },
  { id: 'KR', name: '韩国', commonUrl: 'https://kr-red.lol.sgp.pvp.net', matchHistoryUrl: 'https://apne1-red.pp.sgp.pvp.net', isTencent: false }
]

export const getServer = (id: string): LeagueServer | undefined =>
  LEAGUE_SERVERS.find((server) => server.id === normalizeServerId(id))

export function normalizeServerId(value: string): string {
  const id = value.toUpperCase()
  const aliases: Record<string, string> = {
    HN1: 'TENCENT_HN1', HN10: 'TENCENT_HN10', TJ100: 'TENCENT_TJ100', TJ101: 'TENCENT_TJ101',
    NJ100: 'TENCENT_NJ100', GZ100: 'TENCENT_GZ100', CQ100: 'TENCENT_CQ100', BGP2: 'TENCENT_BGP2',
    NA: 'NA1', BR: 'BR1', OCE: 'OC1', LAN: 'LA1', LAS: 'LA2', JP1: 'JP', EUW1: 'EUW'
  }
  return aliases[id] ?? id
}

export function regionPath(server: LeagueServer): string {
  if (server.regionPathParam) return server.regionPathParam
  return server.id.startsWith('TENCENT_') ? server.id.slice('TENCENT_'.length) : server.id
}
