// 小仙聊天：离线话术引擎 + 大模型预留
// 接入真大模型：在 localStorage「xiuxian-pet-llm」写入
// { "endpoint": "https://api.openai.com/v1", "key": "sk-...", "model": "gpt-4o-mini" }
// 之后聊窗会优先调用该 OpenAI 兼容接口，失败时回退到离线话术。

import type { PetState } from './data'
import { ENEMY_INFO, REALMS } from './data'

export interface LlmConfig {
  endpoint: string
  key: string
  model: string
}

export function loadLlmConfig(): LlmConfig | null {
  try {
    const raw = localStorage.getItem('xiuxian-pet-llm')
    if (!raw) return null
    const c = JSON.parse(raw) as LlmConfig
    if (typeof c?.endpoint === 'string' && typeof c.key === 'string' &&
        c.endpoint.trim() && c.key.trim() && (c.model === undefined || typeof c.model === 'string')) {
      const url = new URL(c.endpoint)
      if (url.protocol === 'https:' || url.protocol === 'http:') return c
    }
  } catch { /* ignore */ }
  return null
}

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]

// ── 离线话术引擎：按关键词 / 语境生成回复 ──

const GENERIC = [
  '嗯？主人在叫我吗？',
  '今日灵气充裕，正适合修行呢。',
  '嘻嘻，和你一起最开心了。',
  '等我修成大道，就带主人御剑游遍四海！',
  '道可道，非常道……哎，我还没悟透。',
  '主人有心事吗？说给我听听。',
  '刚才在秘境里看到一朵好漂亮的灵花！',
]

const GREETING = ['主人好呀！', '嗨嗨，今天也要加油修行哦！', '你来啦，我正想着你呢。']

function contextLine(pet: PetState): string {
  const lines: string[] = []
  if (pet.satiety <= 25) lines.push('肚子咕咕叫……好想吃灵果呀。')
  if (pet.cleanliness <= 25) lines.push('身上黏糊糊的，想泡个花瓣澡……')
  if (pet.mood >= 80) lines.push('我今天心情特别好，看什么都顺眼！')
  if (pet.mood <= 25) lines.push('唔……有点闷闷的，主人陪我玩一会儿嘛。')
  if (pet.pendingTribulation) lines.push('天劫将至，我心里又紧张又期待！')
  if (pet.secluding) lines.push('我正在闭关呢，小声一点……')
  return pick(lines.length ? lines : GENERIC)
}

export function offlineReply(input: string, pet: PetState): string {
  const t = input.trim()
  const realmName = REALMS[Math.min(pet.realm, REALMS.length - 1)]
  const rules: [RegExp, () => string][] = [
    [/你好|在吗|嗨|hi|hello/i, () => pick(GREETING)],
    [/吃|饿|饭|喂/, () => (pet.satiety <= 40 ? '说到吃的我就饿！快喂我一颗灵果吧～' : '我刚吃饱，肚皮圆滚滚的。')],
    [/洗澡|脏|干净/, () => (pet.cleanliness <= 40 ? '我正想洗澡呢，花瓣澡、露水澡都可以！' : '我刚沐浴过，香喷喷的。')],
    [/修为|境界|修炼|闭关/, () => `我现在是「${realmName}」，修为 ${Math.floor(pet.cultivation)}。闭关修炼最快啦，就是有点闷。`],
    [/秘境|副本|冒险|妖/, () => {
      const killed = Object.keys(pet.codex.kills).length
      const total = Object.keys(ENEMY_INFO).length
      return `秘境里我已经收录 ${killed}/${total} 种妖兽图鉴了！${killed >= total ? '全都斩过一遍，厉害吧！' : '还有好多没见过的大妖呢。'}`
    }],
    [/天劫|渡劫|雷/, () => (pet.pendingTribulation ? '天雷已经压顶了！快带我去渡劫台！' : '等我境界到了，天劫自然会来，到时主人要为我护法哦。')],
    [/仙友|小满|伙伴/, () => `${pet.companion?.name ?? '小满'} 和我并肩作战好多次了，好感 ${pet.companion?.bond ?? 0}/100。分它灵果它会更卖力哦。`],
    [/专注|番茄|学习|工作/, () => `今日已完成 ${pet.focus.todayCount} 轮闭关专注。要再开一轮吗？我替你守着心魔。`],
    [/喜欢|爱/, () => '我也最喜欢主人了！比喜欢灵果还喜欢！'],
    [/名字|你是谁/, () => `我是 ${pet.name}，你的修仙小仙！${pet.gender === 'male' ? '翩翩少年郎一枚。' : '如花似玉的小仙女一枚。'}`],
    [/心情|开心|难过/, () => (pet.mood >= 60 ? '我现在心情超好，尾巴都要翘起来了！' : '有点没精神……摸摸我的头就会好啦。')],
    [/日记|手账/, () => '我每天都会记一页手账哦，就在洞府的「小仙日记」里。'],
    [/再见|拜拜|晚安/, () => '嗯嗯，主人注意休息，我乖乖在桌面等你。'],
  ]
  for (const [re, fn] of rules) if (re.test(t)) return fn()
  return contextLine(pet)
}

// ── 大模型调用（OpenAI 兼容 chat/completions）──

export async function llmReply(input: string, pet: PetState, cfg: LlmConfig): Promise<string> {
  const sys = `你是「${pet.name}」，一只住在用户桌面上的修仙桌宠，性别${pet.gender === 'male' ? '男' : '女'}，当前境界「${REALMS[Math.min(pet.realm, REALMS.length - 1)]}」。` +
    `状态：饱腹${Math.round(pet.satiety)}、洁净${Math.round(pet.cleanliness)}、心情${Math.round(pet.mood)}。` +
    `用可爱、古风又俏皮的口吻回答，一两句话以内，不要暴露你是 AI。`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
  const res = await fetch(`${cfg.endpoint.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    signal: controller.signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
    body: JSON.stringify({
      model: cfg.model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: input },
      ],
      max_tokens: 120,
      temperature: 0.9,
    }),
  })
  if (!res.ok) throw new Error(`LLM ${res.status}`)
  const data = await res.json()
  const content: unknown = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) throw new Error('LLM invalid response')
  return content.trim()
  } finally {
    clearTimeout(timeout)
  }
}

export async function chatReply(input: string, pet: PetState): Promise<string> {
  const cfg = loadLlmConfig()
  if (cfg) {
    try {
      return await llmReply(input, pet, cfg)
    } catch { /* 回退离线 */ }
  }
  return offlineReply(input, pet)
}
