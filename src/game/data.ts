// ─── 修仙桌宠 · 核心数值 ───────────────────────────────────────────

export type EquipSlot = 'weapon' | 'armor' | 'trinket'

export interface EquipItem {
  id: string
  name: string
  slot: EquipSlot
  icon: string
  desc: string
  atk?: number
  hp?: number
  speed?: number
  thunder?: number
}

export const EQUIP_POOL: EquipItem[] = [
  { id: 'xj-jian', name: '玄蛟剑', slot: 'weapon', icon: '🗡️', desc: '蛟筋淬剑，攻击 +15', atk: 15 },
  { id: 'wj-fu', name: '五雷符剑', slot: 'weapon', icon: '⚡', desc: '符蕴雷威，攻击 +8 · 雷法 +25', atk: 8, thunder: 25 },
  { id: 'cl-jia', name: '赤鳞软甲', slot: 'armor', icon: '🛡️', desc: '蛟鳞织就，气血 +70', hp: 70 },
  { id: 'xy-pao', name: '玄玉道袍', slot: 'armor', icon: '👘', desc: '轻若云烟，气血 +35 · 身法 +0.3', hp: 35, speed: 0.3 },
  { id: 'bc-zhu', name: '避尘珠', slot: 'trinket', icon: '📿', desc: '尘垢不侵，身法 +0.4', speed: 0.4 },
  { id: 'hy-pei', name: '涵养玉佩', slot: 'trinket', icon: '🧿', desc: '静心养气，气血 +25 · 雷法 +15', hp: 25, thunder: 15 },
  { id: 'xb-zhu', name: '玄冰珠', slot: 'trinket', icon: '🔮', desc: '玄冰鲛皇内丹所化，攻击 +6 · 雷法 +20 · 身法 +0.2', atk: 6, thunder: 20, speed: 0.2 },
]

export interface PetState {
  name: string
  realm: number // 境界索引
  cultivation: number // 当前修为
  satiety: number // 饱腹 0-100
  cleanliness: number // 洁净 0-100
  mood: number // 心情 0-100
  stamina: number // 体力 0-100（进副本消耗）
  stones: number // 灵石
  herbs: number // 灵草
  ore: number // 玄铁
  pills: number // 回灵丹
  swordLevel: number // 飞剑等级
  secluding: boolean
  secludeLeft: number // 闭关剩余秒数
  kills: number // 累计斩妖
  deaths: number
  victories: number
  equipped: Partial<Record<EquipSlot, EquipItem>> // 已装备法宝
  backpack: EquipItem[] // 法宝背包
  pendingTribulation: boolean // 天劫将至（需手动渡劫）
  breakthroughAt: number // 最近一次突破成功的时刻戳（ms），0 表示无；用于播放突破金光演出
  quality: 'smooth' | 'fine' | 'ultra' // 画质档：秘境分辨率与粒子密度
  gender: 'female' | 'male' // 小仙形象
  focus: {
    phase: 'idle' | 'focus' | 'break'
    endsAt: number // 当前阶段结束时间戳（ms）
    minutes: number // 本轮专注时长（分钟）
    todayCount: number // 今日完成轮数
    todayDay: string // 今日日期（YYYY-MM-DD，用于跨天清零）
    totalMinutes: number // 累计专注分钟
    distractions: number // 本轮心魔（分心）次数
  }
  /** 每日专注账（YYYY-MM-DD → 分钟/轮数），只保留最近 14 天，防存档无限膨胀 */
  focusLog: Record<string, { m: number; r: number }>
  guard: {
    enabled: boolean // 闭关守护（专注模式）开关
    strict: boolean // 严格模式：自动最小化违规窗口
    whitelist: string // 白名单进程名，逗号分隔
  }
  todos: TodoItem[] // 历练清单（待办）
  codex: {
    kills: Record<string, number> // 各类妖兽累计斩杀数
    equips: string[] // 图鉴已收录的法宝 id
  }
  neidan: Record<string, number> // 妖兽内丹库存（按妖兽种类）
  cosmetics: {
    owned: string[] // 已兑换的外观 id
    active: string | null // 当前佩戴的外观 id
  }
  skin: string | null // 皮肤包 id（形象阁；null = 本来面貌）
  look: string | null // 配色方案 id（换装；null = 本来面貌）
  companion: {
    name: string // 仙友名字
    bond: number // 好感度 0-100（影响助战战力）
  }
  diary: {
    day: string // 今日日期（YYYY-MM-DD）
    kills: number // 今日起点：累计斩妖快照
    victories: number // 今日起点：累计大捷快照
    focusCount: number // 今日起点：累计专注轮数快照
  }
  diaryLast: {
    day: string
    lines: string[]
  } | null // 昨日手账存档
}

export interface Cosmetic {
  id: string
  name: string
  icon: string
  kind: 'wings' | 'mount'
  desc: string
  cost: Record<string, number> // 所需内丹（妖兽种类 → 数量）
}

export const COSMETICS: Cosmetic[] = [
  { id: 'wings-qingyun', name: '青云灵翼', icon: '🪽', kind: 'wings', desc: '冰螭霜蛾内丹淬炼的灵翼，背生双翼、灵气缭绕', cost: { iceserpent: 3, frostmoth: 3 } },
  { id: 'mount-fox', name: '赤焰灵狐', icon: '🦊', kind: 'mount', desc: '以五枚狼丹为引驯服的九尾火狐坐骑', cost: { wolf: 5 } },
  { id: 'mount-turtle', name: '玄武灵龟', icon: '🐢', kind: 'mount', desc: '三枚石傀丹唤醒的玄龟坐骑，稳如山岳', cost: { golem: 3 } },
  { id: 'wings-wangu', name: '万蛊斗篷', icon: '🦋', kind: 'wings', desc: '蛊蜈与瘴蟾内丹织成的蛊翼斗篷，翼展之间蛊纹明灭', cost: { guworm: 3, plaguetoad: 3 } },
  { id: 'mount-silkworm', name: '金蚕宝辇', icon: '🐛', kind: 'mount', desc: '以金蚕蛊与蛊皇内丹驯养的金蚕坐骑，驮主而行、稳健生辉', cost: { silkworm: 3, guboss: 2 } },
]

export interface TodoItem {
  id: number
  text: string
  done: boolean
  createdAt: number
  doneAt?: number
}

export const REALMS = [
  '练气一层', '练气二层', '练气三层', '练气四层', '练气五层',
  '练气六层', '练气七层', '练气八层', '练气九层',
  '筑基初期', '筑基中期', '筑基后期', '筑基圆满',
  '金丹初期', '金丹中期', '金丹后期', '金丹圆满',
  '元婴初期', '元婴中期', '元婴后期',
]

export const cultivationNeed = (realm: number) => 60 + realm * 45

export const initialPet = (): PetState => ({
  name: '小豆',
  realm: 0,
  cultivation: 0,
  satiety: 80,
  cleanliness: 80,
  mood: 80,
  stamina: 100,
  stones: 20,
  herbs: 4,
  ore: 0,
  pills: 1,
  swordLevel: 0,
  secluding: false,
  secludeLeft: 0,
  kills: 0,
  deaths: 0,
  victories: 0,
  equipped: {},
  backpack: [],
  pendingTribulation: false,
  breakthroughAt: 0,
  quality: 'fine',
  gender: 'female',
  focus: { phase: 'idle', endsAt: 0, minutes: 0, todayCount: 0, todayDay: '', totalMinutes: 0, distractions: 0 },
  focusLog: {},
  guard: {
    enabled: false,
    strict: false,
    whitelist: 'explorer, 桌面小仙, electron, System, Idle, TextInputHost, ShellExperienceHost, StartMenuExperienceHost, SearchHost, LockApp, ApplicationFrameHost',
  },
  todos: [],
  codex: { kills: {}, equips: [] },
  neidan: {},
  cosmetics: { owned: [], active: null },
  skin: null,
  look: null,
  companion: { name: '小满', bond: 0 },
  diary: { day: '', kills: 0, victories: 0, focusCount: 0 },
  diaryLast: null,
})

// 妖兽图鉴
export const ENEMY_INFO: Record<string, { name: string; desc: string; habitat: string }> = {
  wolf: { name: '幽影狼', desc: '青竹林中的群居妖狼，獠牙淬有暗影之毒，性喜围攻落单修士。', habitat: '青竹林' },
  spider: { name: '腐沼毒蛛', desc: '毒沼深处的巨型蛛妖，喷吐的毒液可腐金烂石，遇之则避其远射。', habitat: '毒沼' },
  spirit: { name: '剑冢残灵', desc: '陨落剑修的残魂附于断剑之上，剑意未散，来去如电。', habitat: '剑冢' },
  golem: { name: '山岭石傀', desc: '石岭孕育的岩石化灵，拳落之处地动山摇，唯行动迟缓。', habitat: '石岭' },
  boss: { name: '赤炎蛟', desc: '盘踞炎窟的千年火蛟，吐息成焰、召落天火，斩杀必掉法宝。', habitat: '炎窟' },
  iceserpent: { name: '寒潭冰螭', desc: '寒潭孕育的冰螭幼龙，身形如电，扑击时带起刺骨霜风。', habitat: '寒潭' },
  frostmoth: { name: '霜翼寒蛾', desc: '栖于冰莲之畔的寒蛾，鳞粉凝霜，远远便吐冰棱袭人。', habitat: '寒潭' },
  iceboss: { name: '玄冰鲛皇', desc: '玄冰窟底的万古鲛皇，一怒则百里封冻，斩杀必掉法宝。', habitat: '玄冰窟' },
  guworm: { name: '九节蛊蜈', desc: '南疆蛊师豢养的九节毒蜈，节节藏蛊，缠斗之时毒雾蚀骨。', habitat: '南疆' },
  silkworm: { name: '金蚕蛊', desc: '万蛊之王候选，通体鎏金，吐出的金丝韧如法宝、远射伤人。', habitat: '南疆' },
  plaguetoad: { name: '瘴疠巨蟾', desc: '瘴疠林中吞食万毒的巨蟾，背生毒泡，落地一震便是漫天瘴气。', habitat: '瘴疠林' },
  guboss: { name: '万蛊蛊皇', desc: '万蛊窟中以千蛊相残养出的蛊皇，统御虫潮、蛊毒蚀魂，斩杀必掉法宝。', habitat: '万蛊窟' },
}

// 战斗派生属性（副本用）
export const combatStats = (p: PetState) => {
  const eq = Object.values(p.equipped ?? {})
  const sum = (k: 'atk' | 'hp' | 'speed' | 'thunder') =>
    eq.reduce((acc, it) => acc + (it?.[k] ?? 0), 0)
  return {
    maxHp: 90 + p.realm * 14 + sum('hp'),
    attack: 9 + p.realm * 3 + p.swordLevel * 5 + sum('atk'),
    speed: 3.1 + Math.min(p.realm * 0.04, 0.7) + sum('speed'),
    thunder: 30 + p.realm * 8 + sum('thunder'), // 雷法伤害
  }
}

export type ActionMsg = { id: number; text: string; kind: 'info' | 'good' | 'bad' }

let msgId = 0
export const msg = (text: string, kind: ActionMsg['kind'] = 'info'): ActionMsg => ({
  id: ++msgId,
  text,
  kind,
})

export type PetAction =
  | { type: 'tick'; dt: number }
  | { type: 'feed'; fruit: boolean }
  | { type: 'bathe' }
  | { type: 'meditate' }
  | { type: 'seclude' }
  | { type: 'brew' }
  | { type: 'forge' }
  | { type: 'enterDungeon' }
  | {
      type: 'dungeonResult'
      victory: boolean
      died: boolean
      loot: { stones: number; herbs: number; ore: number }
      kills: number
      killsByKind?: Partial<Record<string, number>>
      neidan?: Partial<Record<string, number>>
      equip?: EquipItem | null
      durationSec?: number // 战报用：历练时长
      maxCombo?: number // 战报用：本局最高连击
      region?: string // 战报用：结算区域
    }
  | { type: 'equip'; index: number }
  | { type: 'unequip'; slot: EquipSlot }
  | { type: 'tribulationResult'; success: boolean }
  | { type: 'rename'; name: string }
  | { type: 'setGender'; gender: 'female' | 'male' }
  | { type: 'setQuality'; quality: 'smooth' | 'fine' | 'ultra' }
  | { type: 'setSkin'; skin: string | null } // 形象阁换肤
  | { type: 'setLook'; look: string | null } // 换装配色
  | { type: 'study' } // 研读秘籍《无相剑典》
  | { type: 'startFocus'; minutes: number }
  | { type: 'cancelFocus' }
  | { type: 'setGuard'; enabled?: boolean; strict?: boolean; whitelist?: string }
  | { type: 'distraction'; app: string }
  | { type: 'addTodo'; text: string }
  | { type: 'toggleTodo'; id: number }
  | { type: 'removeTodo'; id: number }
  | { type: 'redeemCosmetic'; id: string }
  | { type: 'wearCosmetic'; id: string | null }
  | { type: 'feedCompanion' }
  | { type: 'renameCompanion'; name: string }
  | { type: 'reset' }

export interface ReduceResult {
  state: PetState
  messages: ActionMsg[]
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v))

export interface ActionContext { now: number; todoId: number; messageId?: number }

export function reducePet(prev: PetState, action: PetAction, context: ActionContext = { now: Date.now(), todoId: Date.now() }): ReduceResult {
  const now = context.now
  const s: PetState = {
    ...prev, focus: { ...prev.focus }, guard: { ...prev.guard },
    todos: prev.todos.map((todo) => ({ ...todo })),
    codex: { kills: { ...prev.codex.kills }, equips: [...prev.codex.equips] },
    neidan: { ...prev.neidan }, cosmetics: { ...prev.cosmetics, owned: [...prev.cosmetics.owned] },
    equipped: { ...prev.equipped }, backpack: [...prev.backpack],
    companion: { ...prev.companion }, diary: { ...prev.diary },
    diaryLast: prev.diaryLast ? { ...prev.diaryLast, lines: [...prev.diaryLast.lines] } : null,
  }
  const messages: ActionMsg[] = []
  const say = (t: string, k: ActionMsg['kind'] = 'info') => messages.push({ id: (context.messageId ?? now) + messages.length, text: t, kind: k })

  switch (action.type) {
    case 'tick': {
      const dt = Number.isFinite(action.dt) ? clamp(action.dt, 0, 60) : 0
      // 缓慢消耗
      s.satiety = clamp(s.satiety - 0.12 * dt)
      s.cleanliness = clamp(s.cleanliness - 0.06 * dt)
      s.stamina = clamp(s.stamina + 0.6 * dt)

      // 心情向（饱腹+洁净）均值漂移
      const target = (s.satiety + s.cleanliness) / 2
      s.mood = clamp(s.mood + (target - s.mood) * 0.02 * dt + (s.satiety <= 0 ? -0.6 * dt : 0))

      // 修为增长
      const hungry = s.satiety <= 10
      if (s.secluding) {
        s.secludeLeft -= dt
        const gain = (hungry ? 1.2 : 6) * dt
        s.cultivation += gain
        if (s.secludeLeft <= 0) {
          s.secluding = false
          s.secludeLeft = 0
          s.satiety = clamp(s.satiety - 12)
          say(`${s.name} 出关了！周身灵气内敛，修为大涨。`, 'good')
        }
      } else {
        s.cultivation += (hungry ? 0.15 : 0.7) * dt
      }

      // 番茄钟（闭关专注）阶段流转
      const date = new Date(now)
      const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      // 小仙日记：跨天先把昨日结算成手账（要在 focus 清零之前读 todayCount）
      if (!s.diary.day) {
        s.diary = { day: today, kills: s.kills, victories: s.victories, focusCount: 0 }
      } else if (s.diary.day !== today) {
        const dKills = Math.max(0, s.kills - s.diary.kills)
        const dWins = Math.max(0, s.victories - s.diary.victories)
        const dFocus = s.focus.todayDay === s.diary.day ? s.focus.todayCount : 0
        const lines: string[] = []
        lines.push(dKills > 0 ? `⚔️ 斩妖 ${dKills} 头${dWins > 0 ? `，大捷 ${dWins} 场` : ''}，道行渐长。` : '🌿 今日未动刀兵，静修了一天。')
        lines.push(dFocus > 0 ? `🍅 闭关专注 ${dFocus} 轮，道心愈发稳固。` : '💤 未曾闭关专注，略微懈怠。')
        lines.push(s.mood >= 70 ? '😊 心情极好，哼了一天小曲。' : s.mood >= 40 ? '😐 心情平平，无波无澜。' : '😞 心情低落，盼着主人多陪陪。')
        s.diaryLast = { day: s.diary.day, lines }
        s.diary = { day: today, kills: s.kills, victories: s.victories, focusCount: 0 }
        say(`📔 ${s.name} 写好了昨日手账，去洞府看看吧。`, 'good')
      }
      if (s.focus.todayDay !== today) {
        s.focus.todayDay = today
        s.focus.todayCount = 0
      }
      if (s.focus.phase !== 'idle' && now >= s.focus.endsAt) {
        if (s.focus.phase === 'focus') {
          s.focus.phase = 'break'
          s.focus.endsAt = now + 5 * 60 * 1000
          s.focus.todayCount += 1
          s.focus.totalMinutes += s.focus.minutes
          // 每日专注账：按日累加，顺便裁掉 14 天前的旧账
          const prev = s.focusLog[today] ?? { m: 0, r: 0 }
          const nextLog: Record<string, { m: number; r: number }> = { ...s.focusLog, [today]: { m: prev.m + s.focus.minutes, r: prev.r + 1 } }
          const days = Object.keys(nextLog).sort()
          if (days.length > 14) for (const d of days.slice(0, days.length - 14)) delete nextLog[d]
          s.focusLog = nextLog
          const clean = (s.focus.distractions ?? 0) === 0
          s.cultivation += clean ? 32 : 25
          s.stones += 3
          s.mood = clamp(s.mood + 10)
          say(
            clean
              ? `🍅 闭关功成！心无旁骛，修为+32 灵石+3。歇息 5 分钟吧。`
              : `🍅 闭关功成！虽有心魔 ${s.focus.distractions} 次，仍修为+25 灵石+3。歇息 5 分钟吧。`,
            'good',
          )
        } else {
          s.focus.phase = 'idle'
          say(`歇息完毕，可以开始下一轮闭关专注了。`)
        }
      }

      // 天劫：修为圆满 → 天劫将至，需主人护法渡劫方可突破
      const need = cultivationNeed(s.realm)
      if (s.realm < REALMS.length - 1 && s.cultivation >= need && !s.pendingTribulation) {
        s.pendingTribulation = true
        say(`⚡ 劫云压顶！${s.name} 修为圆满，天劫将至——速回洞府为它护法渡劫！`, 'bad')
      }
      if (s.cultivation > need) s.cultivation = need
      break
    }

    case 'feed': {
      if (s.secluding) { say('闭关之中，不食五谷。', 'bad'); break }
      if (action.fruit) {
        if (s.stones < 5) { say('灵石不足，买不起灵果。', 'bad'); break }
        s.stones -= 5
        s.satiety = clamp(s.satiety + 45)
        s.mood = clamp(s.mood + 12)
        s.cultivation += 10
        say(`${s.name} 抱着灵果啃得香甜，灵气+10！`, 'good')
      } else {
        if (s.stones < 1) { say('连买灵米的灵石都没有了……去秘境赚一点吧。', 'bad'); break }
        s.stones -= 1
        s.satiety = clamp(s.satiety + 25)
        s.mood = clamp(s.mood + 4)
        say(`${s.name} 吃了一碗灵米饭，满足地拍拍肚子。`)
      }
      break
    }

    case 'bathe': {
      if (s.secluding) { say('闭关之中，勿扰清修。', 'bad'); break }
      s.cleanliness = clamp(s.cleanliness + 45)
      s.mood = clamp(s.mood + 8)
      say(`你给${s.name} 施了个「净身涤尘术」，它舒服得眯起了眼。`, 'good')
      break
    }

    case 'meditate': {
      if (s.secluding) { say('已在闭关中。', 'bad'); break }
      if (s.satiety <= 10) { say('饿得心慌，无法入定。先喂点吃的吧。', 'bad'); break }
      s.cultivation += 12
      s.stamina = clamp(s.stamina - 3)
      say(`${s.name} 吐纳一周天，修为 +12。`)
      break
    }

    case 'seclude': {
      if (s.secluding) break
      if (s.satiety < 30) { say('饱腹不足 30，闭关恐有心魔之扰。先喂食！', 'bad'); break }
      s.secluding = true
      s.secludeLeft = 30
      say(`${s.name} 盘膝入定，开始闭关（30 息）……灵气正在汇聚。`)
      break
    }

    case 'brew': {
      if (s.herbs < 2) { say('灵草不足（需要 2 株），去秘境采一些吧。', 'bad'); break }
      s.herbs -= 2
      s.pills += 1
      say(`丹炉青烟袅袅，炼成「回灵丹」×1！副本中会自动服用续命。`, 'good')
      break
    }

    case 'study': {
      if (s.secluding) { say('闭关之中，无暇研读。', 'bad'); break }
      if (s.stamina < 10) { say('体力不足 10，头晕眼花读不进去……歇一会儿吧。', 'bad'); break }
      s.stamina = clamp(s.stamina - 10)
      s.cultivation += 25
      s.mood = clamp(s.mood + 6)
      say(`📜 ${s.name} 潜心研读《无相剑典》，剑意通透，修为 +25！`, 'good')
      break
    }

    case 'forge': {
      if (s.ore < 3 || s.stones < 10) { say(`炼器需要玄铁×3 + 灵石×10（现有玄铁×${s.ore}、灵石×${s.stones}）。`, 'bad'); break }
      s.ore -= 3
      s.stones -= 10
      s.swordLevel += 1
      say(`⚔️ 飞剑祭炼至 +${s.swordLevel}！剑光更盛，斩妖伤害提升。`, 'good')
      break
    }

    case 'enterDungeon': {
      if (s.secluding) { say('闭关未竟，不可远行。', 'bad'); break }
      if (s.stamina < 25) { say('体力不足 25，让它歇一会儿再去吧。', 'bad'); break }
      s.stamina -= 25
      break
    }

    case 'dungeonResult': {
      const { victory, died, loot, kills, killsByKind, neidan, equip } = action
      s.kills += kills
      s.stones += loot.stones
      s.herbs += loot.herbs
      s.ore += loot.ore
      // 历练领悟：斩妖折算修为。
      // 此前秘境只回材料、不回修为，等于"打怪"和"修炼"两条线各走各的——
      // 玩家会觉得喂饭洗澡才是正事、打架只是搬砖。给一点修为，闭环才合上。
      if (kills > 0) {
        const gain = Math.min(20, Math.round(kills * 0.6))
        if (gain > 0) {
          s.cultivation += gain
          say(`⚔️ 历练领悟：斩妖 ${kills} 头，修为+${gain}。`, 'good')
        }
      }
      // 妖兽图鉴：累计斩杀 + 首杀奖励
      if (killsByKind) {
        for (const [kind, n] of Object.entries(killsByKind)) {
          const prev = s.codex.kills[kind] ?? 0
          s.codex.kills[kind] = prev + (n ?? 0)
          if (prev === 0 && (n ?? 0) > 0) {
            s.cultivation += 5
            say(`📖 图鉴新录：「${ENEMY_INFO[kind]?.name ?? kind}」！首斩之赏，修为+5。`, 'good')
          }
        }
      }
      // 内丹入库
      if (neidan) {
        const parts: string[] = []
        for (const [kind, n] of Object.entries(neidan)) {
          if (!n) continue
          s.neidan[kind] = (s.neidan[kind] ?? 0) + n
          parts.push(`${ENEMY_INFO[kind]?.name ?? kind}内丹×${n}`)
        }
        if (parts.length) say(`🟣 拾取内丹：${parts.join('、')}（可在外观坊兑换灵翼坐骑）`, 'good')
      }
      if (equip) {
        s.backpack = [...(s.backpack ?? []), equip]
        say(`✨ 法宝现世！秘境深处寻得「${equip.name}」（${equip.desc}），已收入乾坤袋。`, 'good')
        if (!s.codex.equips.includes(equip.id)) {
          s.codex.equips = [...s.codex.equips, equip.id]
          s.cultivation += 8
          say(`📖 法宝图鉴收录「${equip.name}」（${s.codex.equips.length}/${EQUIP_POOL.length}），修为+8。`, 'good')
        }
      }
      // 仙友并肩作战，好感渐增
      s.companion = { name: s.companion?.name ?? '小满', bond: clamp((s.companion?.bond ?? 0) + (victory ? 3 : 1)) }
      if (victory) {
        s.victories += 1
        s.cultivation += 60
        s.mood = clamp(s.mood + 15)
        const bossKind = Object.keys(killsByKind ?? {}).find((k) => k === 'boss' || k === 'iceboss' || k === 'guboss')
        const bossName = bossKind ? ENEMY_INFO[bossKind]?.name ?? '大妖' : '大妖'
        say(`🏆 大捷！${s.name} 斩杀${bossName}，携宝而归：灵石×${loot.stones}、灵草×${loot.herbs}、玄铁×${loot.ore}，修为 +60！`, 'good')
      } else if (died) {
        s.deaths += 1
        s.mood = clamp(s.mood - 20)
        s.cultivation = Math.max(0, s.cultivation - 20)
        say(`💫 ${s.name} 重伤遁回洞府，修为略有损耗……好在带回了灵石×${loot.stones}、灵草×${loot.herbs}、玄铁×${loot.ore}。`, 'bad')
      } else {
        say(`${s.name} 全身而退：灵石×${loot.stones}、灵草×${loot.herbs}、玄铁×${loot.ore}。`)
      }
      break
    }

    case 'equip': {
      const item = (s.backpack ?? [])[action.index]
      if (!item) break
      const slot = item.slot
      const prev = (s.equipped ?? {})[slot]
      s.backpack = s.backpack.filter((_, i) => i !== action.index)
      if (prev) s.backpack = [...s.backpack, prev]
      s.equipped = { ...(s.equipped ?? {}), [slot]: item }
      say(`${s.name} 祭出「${item.name}」，${item.desc}。`, 'good')
      break
    }

    case 'unequip': {
      const cur = (s.equipped ?? {})[action.slot]
      if (!cur) break
      s.equipped = { ...(s.equipped ?? {}) }
      delete s.equipped[action.slot]
      s.backpack = [...(s.backpack ?? []), cur]
      say(`收起了「${cur.name}」。`)
      break
    }

    case 'tribulationResult': {
      s.pendingTribulation = false
      const need = cultivationNeed(s.realm)
      if (action.success) {
        s.realm = Math.min(s.realm + 1, REALMS.length - 1)
        s.cultivation = 0
        s.mood = clamp(s.mood + 25)
        s.breakthroughAt = Date.now() // 触发突破金光演出
        say(`🌈 渡劫功成！${s.name} 踏入「${REALMS[s.realm]}」，气血灵力愈发浑厚。`, 'good')
      } else {
        s.cultivation = need * 0.5
        s.mood = clamp(s.mood - 20)
        say(`🌩️ 渡劫失败，${s.name} 道基受损，修为折半……养好心境，卷土重来。`, 'bad')
      }
      break
    }

    case 'rename':
      s.name = action.name.slice(0, 8) || s.name
      break

    case 'setGender':
      if (s.gender !== action.gender) {
        s.gender = action.gender
        say(action.gender === 'male' ? '✨ 化身男相小仙，焕然一新！' : '✨ 化身女相小仙，焕然一新！', 'good')
      }
      break

    case 'setQuality':
      if (s.quality !== action.quality) {
        s.quality = action.quality
        say(
          action.quality === 'ultra'
            ? '🎨 画质调至「极致」：秘境纤毫毕现，灵尘漫天。'
            : action.quality === 'smooth'
              ? '🎨 画质调至「流畅」：轻装上阵，老机器也能健步如飞。'
              : '🎨 画质调至「精致」：清晰度与流畅兼得。',
        )
      }
      break

    case 'setSkin':
      if (s.skin !== action.skin) {
        s.skin = action.skin
        say(action.skin ? '✨ 易容术施展完毕，焕然一新！' : '✨ 洗尽铅华，恢复本来面貌。', 'good')
      }
      break

    case 'setLook':
      if (s.look !== action.look) {
        s.look = action.look
        say(action.look ? '🎨 换了一身气韵，镜中人已不同。' : '🎨 褪去妆彩，仍是旧时模样。', 'good')
      }
      break

    case 'startFocus': {
      if (s.focus.phase === 'focus') {
        say('正在闭关专注中，请勿分心。')
        break
      }
      s.focus.phase = 'focus'
      s.focus.minutes = Number.isFinite(action.minutes) ? clamp(action.minutes, 1, 180) : 25
      s.focus.endsAt = now + s.focus.minutes * 60 * 1000
      s.focus.distractions = 0
      say(
        s.guard.enabled
          ? `🍅 ${s.name} 陪你闭关专注 ${action.minutes} 分钟，护法大阵已开，心魔勿近！`
          : `🍅 ${s.name} 陪你闭关专注 ${action.minutes} 分钟，心无二念，开始！`,
        'good',
      )
      break
    }

    case 'setGuard':
      if (action.enabled !== undefined) s.guard.enabled = action.enabled
      if (action.strict !== undefined) s.guard.strict = action.strict
      if (action.whitelist !== undefined) s.guard.whitelist = action.whitelist
      break

    case 'distraction': {
      if (s.focus.phase !== 'focus') break
      s.focus.distractions = (s.focus.distractions ?? 0) + 1
      if (s.focus.distractions >= 3) {
        s.focus.phase = 'idle'
        s.focus.endsAt = 0
        s.mood = clamp(s.mood - 10)
        say(`👿 心魔三侵（${action.app}）！闭关破功，修为无获……${s.name} 元气大伤。`, 'bad')
      } else {
        say(`👿 心魔入侵：你打开了「${action.app}」（${s.focus.distractions}/3）！速速回头！`, 'bad')
      }
      break
    }

    case 'cancelFocus':
      if (s.focus.phase === 'focus') {
        s.focus.phase = 'idle'
        s.focus.endsAt = 0
        say(`闭关中断……${s.name} 叹了口气：「心魔扰人，下次一定。」`, 'bad')
      } else if (s.focus.phase === 'break') {
        s.focus.phase = 'idle'
        s.focus.endsAt = 0
      }
      break

    case 'addTodo': {
      const text = action.text.trim().slice(0, 40)
      if (!text) break
      if (s.todos.filter((t) => !t.done).length >= 20) {
        say('历练清单太长了（最多 20 件未完事项），先清几件吧。')
        break
      }
      s.todos.push({ id: context.todoId, text, done: false, createdAt: now })
      say(`📜 新的历练：「${text}」`)
      break
    }

    case 'toggleTodo': {
      const t = s.todos.find((t) => t.id === action.id)
      if (!t) break
      if (!t.done) {
        t.done = true
        t.doneAt = now
        s.cultivation += 10
        s.stones += 2
        s.mood = clamp(s.mood + 5)
        say(`✅ 历练达成：「${t.text}」！修为+10 灵石+2，${s.name} 与有荣焉。`, 'good')
      } else {
        t.done = false
        t.doneAt = undefined
        s.cultivation = Math.max(0, s.cultivation - 10)
        say(`「${t.text}」被重新挂回了清单（修为-10）。`)
      }
      break
    }

    case 'removeTodo':
      s.todos = s.todos.filter((t) => t.id !== action.id)
      break

    case 'redeemCosmetic': {
      const cos = COSMETICS.find((c) => c.id === action.id)
      if (!cos) break
      if (s.cosmetics.owned.includes(cos.id)) {
        say(`「${cos.name}」已经在你的外观坊里了。`)
        break
      }
      const short = Object.entries(cos.cost).filter(([k, n]) => (s.neidan[k] ?? 0) < n)
      if (short.length) {
        say(`内丹不足：还差 ${short.map(([k, n]) => `${ENEMY_INFO[k]?.name ?? k}内丹×${n - (s.neidan[k] ?? 0)}`).join('、')}。`, 'bad')
        break
      }
      for (const [k, n] of Object.entries(cos.cost)) s.neidan[k] = (s.neidan[k] ?? 0) - n
      s.cosmetics.owned = [...s.cosmetics.owned, cos.id]
      s.cosmetics.active = cos.id
      s.mood = clamp(s.mood + 10)
      say(`🎀 外观兑换成功：「${cos.name}」！${s.name} 爱不释手，已自动佩戴（心情+10）。`, 'good')
      break
    }

    case 'wearCosmetic': {
      if (action.id && !s.cosmetics.owned.includes(action.id)) break
      s.cosmetics.active = action.id
      const cos = COSMETICS.find((c) => c.id === action.id)
      say(cos ? `🎀 ${s.name} 佩戴上了「${cos.name}」。` : `${s.name} 卸下了外观，返璞归真。`)
      break
    }

    case 'feedCompanion': {
      s.companion = { name: s.companion?.name ?? '小满', bond: s.companion?.bond ?? 0 }
      if (s.herbs < 1) {
        say(`灵草不足，没法给 ${s.companion.name} 开小灶了。去秘境采些吧。`, 'bad')
        break
      }
      if (s.companion.bond >= 100) {
        say(`${s.companion.name} 的好感已至化境，无需再喂啦。`)
        break
      }
      s.herbs -= 1
      s.companion.bond = clamp(s.companion.bond + 8)
      s.mood = clamp(s.mood + 3)
      say(`💞 你分了一颗灵果给 ${s.companion.name}，好感+8（${s.companion.bond}/100），助战更卖力了！`, 'good')
      break
    }

    case 'renameCompanion': {
      const name = action.name.trim().slice(0, 8)
      if (!name) break
      s.companion = { name, bond: s.companion?.bond ?? 0 }
      say(`仙友从此唤作「${name}」。`, 'good')
      break
    }

    case 'reset':
      return { state: initialPet(), messages: [{ id: context.messageId ?? now, text: '已重新踏上仙途。', kind: 'info' }] }
  }

  return { state: s, messages }
}
