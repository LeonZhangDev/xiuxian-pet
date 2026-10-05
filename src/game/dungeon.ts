// ─── 秘境历练 · 修仙开放世界 ARPG（无缝大地图）─────────────────────
import type { PetState, EquipItem } from './data'
import { combatStats, EQUIP_POOL, ENEMY_INFO } from './data'
import petBattleUrl from '../assets/pet-battle.webp'
import petBattleMUrl from '../assets/pet-m-battle.webp'
import petBattleBlinkUrl from '../assets/pet-battle-blink.webp'
import petBattleBlinkMUrl from '../assets/pet-m-battle-blink.webp'
import enemyWolfUrl from '../assets/enemy-wolf.webp'
import enemySpiderUrl from '../assets/enemy-spider.webp'
import enemySpiritUrl from '../assets/enemy-spirit.webp'
import enemyGolemUrl from '../assets/enemy-golem.webp'
import enemyBossUrl from '../assets/enemy-boss.webp'
import enemyIceserpentUrl from '../assets/enemy-iceserpent.webp'
import enemyFrostmothUrl from '../assets/enemy-frostmoth.webp'
import enemyIcebossUrl from '../assets/enemy-iceboss.webp'
import enemyGuwormUrl from '../assets/enemy-guworm.webp'
import enemySilkwormUrl from '../assets/enemy-silkworm.webp'
import enemyPlaguetoadUrl from '../assets/enemy-plaguetoad.webp'
import enemyGubossUrl from '../assets/enemy-guboss.webp'
import tileForestUrl from '../assets/tile-forest.jpg'
import tileSwampUrl from '../assets/tile-swamp.jpg'
import tileBarrenUrl from '../assets/tile-barren.jpg'
import tileLavaUrl from '../assets/tile-lava.jpg'
import tileSnowUrl from '../assets/tile-snow.jpg'
import decoBambooUrl from '../assets/deco-bamboo.webp'
import decoDeadtreeUrl from '../assets/deco-deadtree.webp'
import decoSwordstoneUrl from '../assets/deco-swordstone.webp'
import decoCrystalUrl from '../assets/deco-crystal.webp'
import decoIcelotusUrl from '../assets/deco-icelotus.webp'
import propHerbUrl from '../assets/prop-herb.webp'
import propChestUrl from '../assets/prop-chest.webp'
import propSteleUrl from '../assets/prop-stele.webp'
import sfxBossUrl from '../assets/sfx-boss.mp3'
import cosWingsUrl from '../assets/cos-wings.webp'
import cosWingsGuUrl from '../assets/cos-wings-gu.webp'
import cosMountFoxUrl from '../assets/cos-mount-fox.webp'
import cosMountTurtleUrl from '../assets/cos-mount-turtle.webp'
import cosMountSilkwormUrl from '../assets/cos-mount-silkworm.webp'
import { skinPoseFile } from './packs'

export interface DungeonResult {
  victory: boolean
  died: boolean
  retreated?: boolean
  loot: { stones: number; herbs: number; ore: number }
  kills: number
  killsByKind?: Partial<Record<string, number>>
  neidan?: Partial<Record<string, number>>
  equip?: EquipItem | null
  durationSec?: number // 历练时长（战报用）
  maxCombo?: number // 本局最高连击（战报用）
  region?: string // 结算时所在区域（战报用）
}

export interface HudState {
  hp: number
  maxHp: number
  region: string
  enemiesNear: number
  pills: number
  dashCd: number
  thunderCd: number
  combo: number // 当前连击数
  comboMult: number // 连击掉落加成倍数（1 + min(combo,40) × 2.5%）
  unionCd: number // 合击技冷却（秒；<0 表示好感未满未解锁）
  loot: { stones: number; herbs: number; ore: number }
  bossAlive: boolean
  bossHp: number | null
  bossMax: number
  bossName: string | null // 当前交战 Boss 名（用于血条标题）
}

interface Vec { x: number; y: number }

type EnemyKind = 'wolf' | 'spider' | 'spirit' | 'golem' | 'boss' | 'iceserpent' | 'frostmoth' | 'iceboss' | 'guworm' | 'silkworm' | 'plaguetoad' | 'guboss'
const isBossKind = (k: EnemyKind) => k === 'boss' || k === 'iceboss' || k === 'guboss'

interface Enemy {
  kind: EnemyKind
  pos: Vec
  home: Vec
  region: RegionDef
  hp: number
  maxHp: number
  speed: number
  dmg: number
  r: number
  flash: number
  atkCd: number
  chargeT?: number
  spitCd?: number
  lungeT?: number
  lungeVx?: number
  lungeVy?: number
  slamCd?: number
  engaged?: boolean
  phase2?: boolean // Boss 二阶段（血量过半暴走）
  kb?: Vec // 击退速度（逐帧衰减）
  dead?: boolean
}

interface RegionDef {
  name: string
  cx: number
  cy: number
  r: number
  enemy: EnemyKind
  enemy2?: EnemyKind // 混合刷新：奇数顺位刷 enemy2
  count: number
  tier: number
  tile: 'forest' | 'swamp' | 'barren' | 'lava' | 'snow'
  deco: 'bamboo' | 'deadtree' | 'swordstone' | 'crystal' | 'icelotus'
  tint: string
  respawnT?: number
}

interface Projectile { pos: Vec; vel: Vec; r: number; dmg: number; friendly: boolean; life: number; trail?: Vec[] }
interface Pickup { pos: Vec; kind: 'stone' | 'herb' | 'ore'; t: number }
interface Particle { pos: Vec; vel: Vec; life: number; maxLife: number; color: string; size: number }
interface DmgNum { pos: Vec; text: string; life: number; crit: boolean }
interface Deco { pos: Vec; img: HTMLImageElement; h: number; ready: boolean }
interface EncounterProp {
  pos: Vec
  kind: 'herb' | 'chest' | 'stele'
  active: boolean
  respawnT: number // herb 采集后重生倒计时；chest/stele 单次
}

const WORLD_W = 4200
const WORLD_H = 2900
const AGGRO = 340
const LEASH = 750

const REGIONS: RegionDef[] = [
  { name: '青竹林', cx: 850, cy: 680, r: 540, enemy: 'wolf', count: 6, tier: 1, tile: 'forest', deco: 'bamboo', tint: 'rgba(130,220,165,0.30)' },
  { name: '毒沼', cx: 3250, cy: 720, r: 500, enemy: 'spider', count: 5, tier: 2, tile: 'swamp', deco: 'deadtree', tint: 'rgba(150,205,95,0.30)' },
  { name: '剑冢', cx: 780, cy: 2180, r: 500, enemy: 'spirit', count: 5, tier: 2, tile: 'barren', deco: 'swordstone', tint: 'rgba(155,200,240,0.30)' },
  { name: '石岭', cx: 2350, cy: 2150, r: 560, enemy: 'golem', count: 3, tier: 3, tile: 'barren', deco: 'swordstone', tint: 'rgba(205,185,140,0.30)' },
  { name: '炎窟', cx: 3560, cy: 2280, r: 480, enemy: 'boss', count: 1, tier: 4, tile: 'lava', deco: 'crystal', tint: 'rgba(255,140,80,0.35)' },
  { name: '寒潭', cx: 2300, cy: 480, r: 560, enemy: 'iceserpent', enemy2: 'frostmoth', count: 6, tier: 3, tile: 'snow', deco: 'icelotus', tint: 'rgba(140,200,255,0.32)' },
  { name: '玄冰窟', cx: 1600, cy: 300, r: 380, enemy: 'iceboss', count: 1, tier: 4, tile: 'snow', deco: 'icelotus', tint: 'rgba(120,170,255,0.38)' },
  { name: '瘴疠林', cx: 2500, cy: 1450, r: 420, enemy: 'plaguetoad', count: 3, tier: 3, tile: 'swamp', deco: 'deadtree', tint: 'rgba(170,120,220,0.30)' },
  { name: '南疆', cx: 3200, cy: 1450, r: 480, enemy: 'guworm', enemy2: 'silkworm', count: 6, tier: 3, tile: 'swamp', deco: 'deadtree', tint: 'rgba(120,220,170,0.30)' },
  { name: '万蛊窟', cx: 3850, cy: 1450, r: 340, enemy: 'guboss', count: 1, tier: 4, tile: 'swamp', deco: 'crystal', tint: 'rgba(190,80,160,0.36)' },
]

const ENEMY_SPRITE_H: Record<EnemyKind, number> = {
  wolf: 62, spider: 54, spirit: 64, golem: 100, boss: 150,
  iceserpent: 70, frostmoth: 58, iceboss: 160,
  guworm: 64, silkworm: 56, plaguetoad: 92, guboss: 165,
}

// 简易音效合成
export class Sfx {
  ctx: AudioContext | null = null
  ensure() {
    if (!this.ctx) {
      try { this.ctx = new AudioContext() } catch { /* ignore */ }
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume()
  }
  beep(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.08, slide = 0) {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const o = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur)
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(this.ctx.destination)
    o.start(t)
    o.stop(t + dur)
  }
  sword() { this.beep(880, 0.09, 'triangle', 0.06, 500) }
  hit() { this.beep(220, 0.08, 'square', 0.05, -120) }
  hurt() { this.beep(160, 0.2, 'sawtooth', 0.08, -80) }
  pickup() { this.beep(660, 0.12, 'sine', 0.06, 300) }
  thunder() { this.beep(90, 0.5, 'sawtooth', 0.12, -50); this.beep(1200, 0.2, 'square', 0.05, -800) }
  dash() { this.beep(500, 0.12, 'sine', 0.05, 400) }
  pill() { this.beep(520, 0.25, 'sine', 0.07, 260) }
  bossRoar() { this.beep(70, 0.8, 'sawtooth', 0.14, 30) }
  retreat() { this.beep(700, 0.3, 'sine', 0.07, -350) }
}

export class Dungeon {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private keys = new Set<string>()
  private mouse: Vec = { x: 0, y: 0 }
  private mouseDown = false
  private raf = 0
  private last = 0
  private running = false

  private player = {
    pos: { x: WORLD_W / 2, y: WORLD_H / 2 } as Vec,
    hp: 100, maxHp: 100,
    attack: 10, speed: 3.2, thunder: 30,
    vx: 0, vy: 0, // 移动惯性速度
    kb: { x: 0, y: 0 } as Vec, // 受击击退速度（逐帧衰减，与自主移动叠加）
    dashDir: null as Vec | null, // 闪避方向（按下瞬间锁定，避免中途改向）
    atkCd: 0, dashCd: 0, dashT: 0, invuln: 0, thunderCd: 0,
    pills: 0, flash: 0, facing: 0, walkT: 0,
    swingT: 0, // 挥剑动作计时（>0 表示正在挥剑）
    dustT: 0, // 脚步扬尘计时
  }

  private enemies: Enemy[] = []
  private projectiles: Projectile[] = []
  private pickups: Pickup[] = []
  private particles: Particle[] = []
  private dmgNums: DmgNum[] = []
  private rocks: { pos: Vec; r: number }[] = []
  private decos: Deco[] = []
  private props: EncounterProp[] = []
  private insightUsed = false
  private telegraphs: { pos: Vec; r: number; t: number; max: number; dmg: number }[] = []
  private regions: RegionDef[] = []
  private shake = 0
  private kills = 0
  private killsByKind: Partial<Record<EnemyKind, number>> = {}
  private loot = { stones: 0, herbs: 0, ore: 0 }
  private ended = false
  private bossDead = false
  private hitStopT = 0 // 命中停顿（打击感）
  private ghosts: { pos: Vec; life: number; maxLife: number; aimLeft: boolean }[] = [] // 闪避残影
  private dying: { kind: EnemyKind; pos: Vec; r: number; t: number; max: number }[] = [] // 敌人死亡消融动画
  private bolts: { pos: Vec; t: number; max: number }[] = [] // 落雷视觉
  private neidan: Partial<Record<EnemyKind, number>> = {} // 内丹掉落
  private startedAt = 0 // 进秘境时刻（战报时长用）
  private maxCombo = 0 // 本局最高连击（战报用）
  private lastRegion = '荒野灵台' // 结算时所在区域（战报用）
  private companion = { pos: { x: WORLD_W / 2 - 60, y: WORLD_H / 2 + 40 } as Vec, vx: 0, vy: 0, walkT: 0, atkCd: 1, sayT: 0, sayText: '' } // 仙友助战（弹簧跟随：vx/vy 速度 + walkT 步伐相位）
  private companionBond = 0 // 仙友好感度（0-100，影响助战战力）
  private companionName = '小满'
  private unionCd = 0 // 合击技冷却（好感满级解锁）
  private combo = 0 // 连击计数
  private comboT = 0 // 连击有效窗口（秒）
  private cam: Vec = { x: 0, y: 0 }
  private camReady = false // 首帧直接就位，避免开局从左上角滑进来
  private sfx = new Sfx()
  private bossAudio: HTMLAudioElement | null = null
  private bossIntroT = 0 // Boss 登场卷轴演出剩余秒数
  private bossIntroName = ''
  private particleMult = 1 // 画质档：粒子密度系数（流畅 0.5 / 精致 1 / 极致 1.7）
  private wingImg: HTMLImageElement | null = null
  private wingReady = false
  private mountImg: HTMLImageElement | null = null
  private mountReady = false

  private playerImg = new Image()
  private playerImgReady = false
  private playerBlinkImg = new Image()
  private playerBlinkReady = false
  private blinkNextAt = 0
  private blinkUntil = 0
  private companionImg = new Image()
  private companionImgReady = false
  private enemyImgs: Partial<Record<EnemyKind, HTMLImageElement>> = {}
  private enemyImgReady: Partial<Record<EnemyKind, boolean>> = {}
  private tileImgs: Partial<Record<string, HTMLImageElement>> = {}
  private tileReady: Partial<Record<string, boolean>> = {}
  private tilePatterns: Partial<Record<string, CanvasPattern>> = {}
  private decoImgs: Record<string, HTMLImageElement> = {}
  private decoReady: Record<string, boolean> = {}
  private propImgs: Record<string, HTMLImageElement> = {}
  private propReady: Record<string, boolean> = {}
  private ownedEquip: string[] = []
  private equipDrop: EquipItem | null = null
  private onHud: (h: HudState) => void
  private onEnd: (r: DungeonResult) => void

  constructor(
    canvas: HTMLCanvasElement,
    pet: PetState,
    onHud: (h: HudState) => void,
    onEnd: (r: DungeonResult) => void,
  ) {
    this.onHud = onHud
    this.onEnd = onEnd
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    const cs = combatStats(pet)
    this.player.hp = cs.maxHp
    this.player.maxHp = cs.maxHp
    this.player.attack = cs.attack
    this.player.speed = cs.speed
    this.player.thunder = cs.thunder
    this.player.pills = pet.pills

    this.playerImg.onload = () => { this.playerImgReady = true }
    this.playerBlinkImg.onload = () => { this.playerBlinkReady = true }
    // 皮肤包接管战斗立绘：battle/battleBlink 优先，缺姿态回退 idleOpen/idle，再回退默认立绘
    const skinId = typeof pet.skin === 'string' ? pet.skin : null
    const skinUrl = (key: string) => {
      if (!skinId) return null
      const hit = skinPoseFile(skinId, key)
      return hit ? hit.pack.resolve(hit.file) : null
    }
    this.playerImg.src =
      skinUrl('battle') ?? skinUrl('idleOpen') ??
      (pet.gender === 'male' ? petBattleMUrl : petBattleUrl)
    // 战斗待机也会眨眼（闭眼帧），挥剑瞬间不眨
    this.playerBlinkImg.src =
      skinUrl('battleBlink') ?? skinUrl('idle') ??
      (pet.gender === 'male' ? petBattleBlinkMUrl : petBattleBlinkUrl)
    // 仙友用另一性别的立绘，一眼区分
    this.companionImg.onload = () => { this.companionImgReady = true }
    this.companionImg.src = pet.gender === 'male' ? petBattleUrl : petBattleMUrl
    this.companionBond = Math.max(0, Math.min(100, pet.companion?.bond ?? 0))
    this.companionName = pet.companion?.name ?? '小满'

    // 画质档：流畅 0.5x 粒子 / 精致 1x / 极致 1.7x
    this.particleMult = pet.quality === 'smooth' ? 0.5 : pet.quality === 'ultra' ? 1.7 : 1
    // Boss 登场战鼓（AI 生成音频资产）
    try {
      this.bossAudio = new Audio(sfxBossUrl)
      this.bossAudio.volume = 0.7
    } catch { this.bossAudio = null }
    // 翅膀/坐骑外观带进副本（与桌宠佩戴同步）
    const cos = pet.cosmetics?.active
    const wingSrc = cos === 'wings-qingyun' ? cosWingsUrl : cos === 'wings-wangu' ? cosWingsGuUrl : null
    if (wingSrc) {
      this.wingImg = new Image()
      this.wingImg.onload = () => { this.wingReady = true }
      this.wingImg.src = wingSrc
    }
    const mountSrc = cos === 'mount-fox' ? cosMountFoxUrl : cos === 'mount-turtle' ? cosMountTurtleUrl : cos === 'mount-silkworm' ? cosMountSilkwormUrl : null
    if (mountSrc) {
      this.mountImg = new Image()
      this.mountImg.onload = () => { this.mountReady = true }
      this.mountImg.src = mountSrc
    }

    const enemyUrls: Record<EnemyKind, string> = {
      wolf: enemyWolfUrl, spider: enemySpiderUrl, spirit: enemySpiritUrl, golem: enemyGolemUrl, boss: enemyBossUrl,
      iceserpent: enemyIceserpentUrl, frostmoth: enemyFrostmothUrl, iceboss: enemyIcebossUrl,
      guworm: enemyGuwormUrl, silkworm: enemySilkwormUrl, plaguetoad: enemyPlaguetoadUrl, guboss: enemyGubossUrl,
    }
    for (const k of Object.keys(enemyUrls) as EnemyKind[]) {
      const im = new Image()
      im.onload = () => { this.enemyImgReady[k] = true }
      im.src = enemyUrls[k]
      this.enemyImgs[k] = im
    }

    const tileUrls: Record<string, string> = {
      forest: tileForestUrl, swamp: tileSwampUrl, barren: tileBarrenUrl, lava: tileLavaUrl, snow: tileSnowUrl,
    }
    for (const [k, url] of Object.entries(tileUrls)) {
      const im = new Image()
      im.onload = () => {
        this.tileReady[k] = true
        this.tilePatterns[k] = this.ctx.createPattern(im, 'repeat') ?? undefined
      }
      im.src = url
      this.tileImgs[k] = im
    }

    const decoUrls: Record<string, string> = {
      bamboo: decoBambooUrl, deadtree: decoDeadtreeUrl, swordstone: decoSwordstoneUrl, crystal: decoCrystalUrl, icelotus: decoIcelotusUrl,
    }
    for (const [k, url] of Object.entries(decoUrls)) {
      const im = new Image()
      im.onload = () => { this.decoReady[k] = true }
      im.src = url
      this.decoImgs[k] = im
    }

    const propUrls: Record<string, string> = {
      herb: propHerbUrl, chest: propChestUrl, stele: propSteleUrl,
    }
    for (const [k, url] of Object.entries(propUrls)) {
      const im = new Image()
      im.onload = () => { this.propReady[k] = true }
      im.src = url
      this.propImgs[k] = im
    }

    this.ownedEquip = [
      ...Object.values(pet.equipped ?? {}).map((e) => e?.id ?? ''),
      ...(pet.backpack ?? []).map((e) => e.id),
    ]

    // 区域初始化 + 装饰 + 山石
    this.regions = REGIONS.map((r) => ({ ...r }))
    for (const reg of this.regions) {
      for (let i = 0; i < reg.count; i++) this.spawnInRegion(reg, i)
      // 装饰 5-7 个
      const decoCount = 5 + Math.floor(Math.random() * 3)
      for (let i = 0; i < decoCount; i++) {
        const a = Math.random() * Math.PI * 2
        const d = Math.sqrt(Math.random()) * reg.r * 0.75
        this.decos.push({
          pos: { x: reg.cx + Math.cos(a) * d, y: reg.cy + Math.sin(a) * d },
          img: this.decoImgs[reg.deco],
          h: 60 + Math.random() * 55,
          ready: true,
        })
      }
    }
    // 山石障碍物散布全图
    for (let i = 0; i < 40; i++) {
      this.rocks.push({
        pos: { x: 100 + Math.random() * (WORLD_W - 200), y: 100 + Math.random() * (WORLD_H - 200) },
        r: 20 + Math.random() * 28,
      })
    }

    // ── 奇遇点位 ──
    // 采药点：每区域 3 个（采后 40s 重生）
    for (const reg of this.regions) {
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * Math.PI * 2
        const d = Math.sqrt(Math.random()) * reg.r * 0.8
        this.props.push({
          pos: { x: reg.cx + Math.cos(a) * d, y: reg.cy + Math.sin(a) * d },
          kind: 'herb', active: true, respawnT: 0,
        })
      }
    }
    // 遗迹宝箱：全图 6 个（单次，灵石+玄铁）
    for (let i = 0; i < 6; i++) {
      this.props.push({
        pos: { x: 300 + Math.random() * (WORLD_W - 600), y: 300 + Math.random() * (WORLD_H - 600) },
        kind: 'chest', active: true, respawnT: 0,
      })
    }
    // 顿悟台：剑冢中心一座（单次，攻击提升 + 气血全满）
    const swordTomb = this.regions.find((r) => r.name === '剑冢')
    if (swordTomb) {
      this.props.push({
        pos: { x: swordTomb.cx + 60, y: swordTomb.cy + 40 },
        kind: 'stele', active: true, respawnT: 0,
      })
    }
  }

  private spawnInRegion(reg: RegionDef, seq = 0) {
    const kind: EnemyKind = reg.enemy2 && seq % 2 === 1 ? reg.enemy2 : reg.enemy
    const a = Math.random() * Math.PI * 2
    const d = Math.sqrt(Math.random()) * reg.r * 0.7
    const pos = isBossKind(kind)
      ? { x: reg.cx, y: reg.cy }
      : { x: reg.cx + Math.cos(a) * d, y: reg.cy + Math.sin(a) * d }
    const w = reg.tier
    const base: Enemy = {
      kind, pos, home: { ...pos }, region: reg,
      hp: 30, maxHp: 30, speed: 1.8, dmg: 8, r: 16,
      flash: 0, atkCd: 0, spitCd: 2,
    }
    if (kind === 'wolf') {
      base.hp = base.maxHp = 26 + w * 10
      base.speed = 2 + w * 0.12
      base.dmg = 7 + w * 2
    } else if (kind === 'spider') {
      base.hp = base.maxHp = 20 + w * 8
      base.speed = 1.4
      base.dmg = 6 + w * 2
      base.r = 14
    } else if (kind === 'frostmoth') {
      base.hp = base.maxHp = 24 + w * 8
      base.speed = 1.7
      base.dmg = 8 + w * 2
      base.r = 13
    } else if (kind === 'spirit') {
      base.hp = base.maxHp = 24 + w * 9
      base.speed = 2.6
      base.dmg = 9 + w * 2
      base.r = 13
      base.lungeT = 2 + Math.random() * 2
    } else if (kind === 'iceserpent') {
      base.hp = base.maxHp = 32 + w * 10
      base.speed = 2.9
      base.dmg = 11 + w * 2
      base.r = 15
      base.lungeT = 1.6 + Math.random() * 2
    } else if (kind === 'golem') {
      base.hp = base.maxHp = 90 + w * 25
      base.speed = 0.9
      base.dmg = 14 + w * 3
      base.r = 26
      base.slamCd = 4
    } else if (kind === 'iceboss') {
      base.hp = base.maxHp = 560
      base.speed = 1.7
      base.dmg = 19
      base.r = 36
      base.chargeT = 2.5
    } else if (kind === 'guworm') {
      base.hp = base.maxHp = 30 + w * 11
      base.speed = 2.2 + w * 0.12
      base.dmg = 9 + w * 2
      base.r = 15
    } else if (kind === 'silkworm') {
      base.hp = base.maxHp = 22 + w * 8
      base.speed = 1.5
      base.dmg = 7 + w * 2
      base.r = 13
    } else if (kind === 'plaguetoad') {
      base.hp = base.maxHp = 100 + w * 26
      base.speed = 0.85
      base.dmg = 15 + w * 3
      base.r = 27
      base.slamCd = 4.5
    } else if (kind === 'guboss') {
      base.hp = base.maxHp = 620
      base.speed = 1.6
      base.dmg = 21
      base.r = 38
      base.chargeT = 2.2
    } else {
      base.hp = base.maxHp = 460
      base.speed = 1.5
      base.dmg = 17
      base.r = 34
      base.chargeT = 3
    }
    this.enemies.push(base)
  }

  start() {
    this.running = true
    this.startedAt = performance.now()
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    this.canvas.addEventListener('mousemove', this.onMouseMove)
    this.canvas.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('mouseup', this.onMouseUp)
    this.canvas.addEventListener('contextmenu', this.onCtx)
    this.sfx.ensure()
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.loop)
  }

  destroy() {
    this.running = false
    cancelAnimationFrame(this.raf)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    this.canvas.removeEventListener('mousemove', this.onMouseMove)
    this.canvas.removeEventListener('mousedown', this.onMouseDown)
    window.removeEventListener('mouseup', this.onMouseUp)
    this.canvas.removeEventListener('contextmenu', this.onCtx)
  }

  private onCtx = (e: Event) => e.preventDefault()

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase()
    this.keys.add(k)
    if (k === ' ') { e.preventDefault(); this.tryDash() }
    if (k === 'q') this.tryThunder()
    if (k === 'e') this.usePill()
    if (k === 'f') this.tryUnion()
    if (k === 'j') this.tryAttack(this.aimDir())
    if (k === 'b') this.retreat()
  }
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase())

  private onMouseMove = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect()
    this.mouse = {
      x: ((e.clientX - rect.left) / rect.width) * this.canvas.width + this.cam.x,
      y: ((e.clientY - rect.top) / rect.height) * this.canvas.height + this.cam.y,
    }
  }
  private onMouseDown = (e: MouseEvent) => {
    this.sfx.ensure()
    if (e.button === 0) {
      this.mouseDown = true
      this.tryAttack(this.aimDir())
    }
  }
  private onMouseUp = () => { this.mouseDown = false }

  private aimDir(): Vec {
    const d = { x: this.mouse.x - this.player.pos.x, y: this.mouse.y - this.player.pos.y }
    const len = Math.hypot(d.x, d.y) || 1
    return { x: d.x / len, y: d.y / len }
  }

  private tryAttack(dir: Vec) {
    const p = this.player
    if (p.atkCd > 0 || this.ended) return
    p.atkCd = 0.32
    p.facing = Math.atan2(dir.y, dir.x)
    p.swingT = 0.22 // 挥剑动画：前倾 + 月牙剑光
    // 出剑前冲：给"出力"的身体感；后面 swingT 期间移速打折，形成"踏一步再收"的节奏
    p.vx += dir.x * 3.6
    p.vy += dir.y * 3.6
    this.projectiles.push({
      pos: { x: p.pos.x + dir.x * 24, y: p.pos.y + dir.y * 24 - 8 },
      vel: { x: dir.x * 11, y: dir.y * 11 },
      r: 8, dmg: p.attack, friendly: true, life: 1.4,
    })
    this.sfx.sword()
  }

  private tryDash() {
    const p = this.player
    if (p.dashCd > 0 || this.ended) return
    // 闪避方向在按下瞬间锁定：没按方向键时朝当前朝向冲，
    // 否则站着按空格只有无敌帧、人不动——这是原实现最明显的手感 bug。
    let dx = 0, dy = 0
    if (this.keys.has('w') || this.keys.has('arrowup')) dy -= 1
    if (this.keys.has('s') || this.keys.has('arrowdown')) dy += 1
    if (this.keys.has('a') || this.keys.has('arrowleft')) dx -= 1
    if (this.keys.has('d') || this.keys.has('arrowright')) dx += 1
    if (dx || dy) {
      const l = Math.hypot(dx, dy)
      p.dashDir = { x: dx / l, y: dy / l }
      p.facing = Math.atan2(dy, dx)
    } else {
      p.dashDir = { x: Math.cos(p.facing), y: Math.sin(p.facing) }
    }
    p.dashCd = 1.6
    p.dashT = 0.22
    p.invuln = 0.35
    this.sfx.dash()
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        pos: { ...p.pos },
        vel: { x: (Math.random() - 0.5) * 3, y: (Math.random() - 0.5) * 3 },
        life: 0.4, maxLife: 0.4, color: 'rgba(150,235,200,0.6)', size: 4,
      })
    }
  }

  private tryThunder() {
    const p = this.player
    if (p.thunderCd > 0 || this.ended) return
    p.thunderCd = 6
    const target = { x: this.mouse.x, y: this.mouse.y }
    this.sfx.thunder()
    this.shake = Math.max(this.shake, 8)
    this.bolts.push({ pos: { ...target }, t: 0.22, max: 0.22 }) // 落雷视觉：天火劈落 + 冲击环
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2
      this.particles.push({
        pos: { x: target.x + Math.cos(a) * 20, y: target.y + Math.sin(a) * 20 },
        vel: { x: Math.cos(a) * 5, y: Math.sin(a) * 5 },
        life: 0.5, maxLife: 0.5, color: 'rgba(200,220,255,0.9)', size: 5,
      })
    }
    for (const e of this.enemies) {
      if (e.dead) continue
      if (Math.hypot(e.pos.x - target.x, e.pos.y - target.y) < 110 + e.r) {
        const dx = e.pos.x - p.pos.x, dy = e.pos.y - p.pos.y
        const dl = Math.hypot(dx, dy) || 1
        this.hurtEnemy(e, p.thunder, true, { x: dx / dl, y: dy / dl })
      }
    }
  }

  private usePill() {
    const p = this.player
    if (p.pills <= 0 || p.hp >= p.maxHp || this.ended) return
    p.pills--
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.45)
    this.sfx.pill()
    for (let i = 0; i < 12; i++) {
      this.particles.push({
        pos: { x: p.pos.x + (Math.random() - 0.5) * 30, y: p.pos.y + (Math.random() - 0.5) * 30 },
        vel: { x: 0, y: -1.5 - Math.random() },
        life: 0.8, maxLife: 0.8, color: 'rgba(140,255,170,0.8)', size: 4,
      })
    }
  }

  private companionSay(text: string) {
    this.companion.sayText = text
    this.companion.sayT = 2.6
  }

  // 合击技：好感满 100 解锁，与仙友双剑合璧，大范围重创
  private tryUnion() {
    if (this.ended) return
    if (this.companionBond < 100) {
      if (this.companion.sayT <= 0) this.companionSay('好感未满，心意未通……')
      return
    }
    if (this.unionCd > 0) return
    this.unionCd = 20
    const p = this.player
    this.companionSay('合击 · 双剑合璧！')
    this.sfx.bossRoar()
    this.shake = Math.max(this.shake, 12)
    this.hitStopT = Math.max(this.hitStopT, 0.15)
    // 双环剑气冲击波
    for (let ring = 0; ring < 2; ring++) {
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2 + ring * 0.12
        this.particles.push({
          pos: { x: p.pos.x + Math.cos(a) * (50 + ring * 40), y: p.pos.y + Math.sin(a) * (50 + ring * 40) },
          vel: { x: Math.cos(a) * 7, y: Math.sin(a) * 7 },
          life: 0.55, maxLife: 0.55,
          color: ring === 0 ? 'rgba(255,170,220,0.9)' : 'rgba(150,230,255,0.9)',
          size: 6,
        })
      }
    }
    for (const e of this.enemies) {
      if (e.dead) continue
      const d = Math.hypot(e.pos.x - p.pos.x, e.pos.y - p.pos.y)
      if (d < 280 + e.r) {
        const dx = e.pos.x - p.pos.x, dy = e.pos.y - p.pos.y
        const dl = Math.hypot(dx, dy) || 1
        this.hurtEnemy(e, p.attack * 2.5, true, { x: dx / dl, y: dy / dl })
      }
    }
  }

  private retreat() {
    if (this.ended) return
    this.sfx.retreat()
    this.endDungeon(false, false, true)
  }

  private hurtEnemy(e: Enemy, dmg: number, crit = false, dir?: Vec) {
    e.hp -= dmg
    e.flash = 0.12
    e.engaged = true
    // 连击：命中即累计，3 秒无命中或受击则断
    this.combo++
    this.comboT = 3
    // 击退（重甲单位减免）
    if (dir) {
      const mass = isBossKind(e.kind) ? 0.15 : e.kind === 'golem' ? 0.35 : 1
      const force = (crit ? 7 : 4.5) * mass
      e.kb = { x: (e.kb?.x ?? 0) + dir.x * force, y: (e.kb?.y ?? 0) + dir.y * force }
    }
    // 命中停顿：击杀顿得更久
    // 顿帧时长分级：普通命中要"咬"得住（0.028 太短，几乎感觉不到），
    // 击杀与暴击加长，Boss 倒下最长——打击感的重音就靠这几档差。
    this.hitStopT = Math.max(this.hitStopT, e.hp <= 0 ? (isBossKind(e.kind) ? 0.24 : 0.1) : crit ? 0.075 : 0.042)
    this.dmgNums.push({
      pos: { x: e.pos.x + (Math.random() - 0.5) * 20, y: e.pos.y - e.r - 8 },
      text: String(Math.round(dmg)),
      life: 0.7,
      crit,
    })
    this.sfx.hit()
    if (e.hp <= 0 && !e.dead) {
      e.dead = true
      this.kills++
      this.killsByKind[e.kind] = (this.killsByKind[e.kind] ?? 0) + 1
      // 死亡消融：尸体旋转缩小淡入虚空，妖魂袅袅升天
      this.dying.push({ kind: e.kind, pos: { ...e.pos }, r: e.r, t: 0.38, max: 0.38 })
      this.particles.push({
        pos: { x: e.pos.x, y: e.pos.y - e.r },
        vel: { x: 0, y: -1.6 },
        life: 1.1, maxLife: 1.1, color: 'rgba(150,235,220,0.85)', size: 5,
      })
      // 仙友击杀喝彩
      if (this.companion.sayT <= 0 && Math.random() < 0.35) {
        this.companionSay(['好剑法！', '这一击漂亮！', '妖兽伏诛！', '配合无间！'][Math.floor(Math.random() * 4)])
      }
      // 内丹：Boss 必掉两枚，小妖三成概率一枚
      if (isBossKind(e.kind)) this.neidan[e.kind] = (this.neidan[e.kind] ?? 0) + 2
      else if (Math.random() < 0.3) this.neidan[e.kind] = (this.neidan[e.kind] ?? 0) + 1
      this.dmgNums.push({
        pos: { x: e.pos.x, y: e.pos.y - e.r - 26 },
        text: '斩',
        life: 0.9,
        crit: true,
      })
      this.shake = Math.max(this.shake, isBossKind(e.kind) ? 14 : 4)
      const burst = Math.max(4, Math.round((isBossKind(e.kind) ? 30 : 10) * this.particleMult))
      for (let i = 0; i < burst; i++) {
        const a = Math.random() * Math.PI * 2
        this.particles.push({
          pos: { ...e.pos },
          vel: { x: Math.cos(a) * (1 + Math.random() * 3), y: Math.sin(a) * (1 + Math.random() * 3) },
          life: 0.6, maxLife: 0.6,
          color: isBossKind(e.kind) ? 'rgba(255,140,90,0.8)' : 'rgba(200,90,90,0.7)',
          size: 4 + Math.random() * 3,
        })
      }
      this.dropLoot(e)
      if (isBossKind(e.kind)) {
        this.bossDead = true
        const candidates = EQUIP_POOL.filter((it) => !this.ownedEquip.includes(it.id))
        if (candidates.length) {
          this.equipDrop = candidates[Math.floor(Math.random() * candidates.length)]
          this.ownedEquip.push(this.equipDrop.id)
        }
        this.endDungeon(true)
      }
    }
  }

  private dropLoot(e: Enemy) {
    const drops = isBossKind(e.kind)
      ? [['stone'], ['stone'], ['stone'], ['ore'], ['ore'], ['ore'], ['herb'], ['herb']] as const
      : e.kind === 'golem'
        ? [['ore'], ['ore'], Math.random() < 0.5 ? ['stone'] : ['ore']] as const
        : e.kind === 'spirit'
          ? [['stone'], Math.random() < 0.5 ? ['herb'] : ['stone']] as const
          : e.kind === 'spider'
            ? [['herb'], Math.random() < 0.5 ? ['stone'] : ['ore']] as const
            : [Math.random() < 0.6 ? ['stone'] : Math.random() < 0.5 ? ['herb'] : ['ore']] as const
    for (const [kind] of drops) {
      this.pickups.push({
        pos: { x: e.pos.x + (Math.random() - 0.5) * 40, y: e.pos.y + (Math.random() - 0.5) * 40 },
        kind: kind as Pickup['kind'],
        t: Math.random() * Math.PI * 2,
      })
    }
  }

  private endDungeon(victory: boolean, died = false, retreated = false) {
    if (this.ended) return
    this.ended = true
    setTimeout(() => {
      this.onEnd({
        victory, died, retreated,
        loot: { ...this.loot },
        kills: this.kills,
        killsByKind: { ...this.killsByKind },
        neidan: { ...this.neidan },
        equip: this.equipDrop,
        durationSec: Math.max(1, Math.round((performance.now() - this.startedAt) / 1000)),
        maxCombo: this.maxCombo,
        region: this.lastRegion,
      })
    }, victory ? 1400 : 1000)
  }

  private loop = (now: number) => {
    if (!this.running) return
    const rawDt = Math.min((now - this.last) / 1000, 0.05)
    this.last = now
    // 命中停顿：短暂冻结世界，渲染照旧（打击感核心）
    if (this.hitStopT > 0) {
      this.hitStopT -= rawDt
      this.render()
      this.raf = requestAnimationFrame(this.loop)
      return
    }
    this.update(rawDt)
    this.render()
    this.raf = requestAnimationFrame(this.loop)
  }

  private update(dt: number) {
    const p = this.player
    if (this.ended) return

    // ── 区域刷新：清空 25 息后重新聚集（Boss 不刷新）──
    for (const reg of this.regions) {
      if (isBossKind(reg.enemy)) continue
      const alive = this.enemies.some((e) => !e.dead && e.region === reg)
      if (!alive) {
        reg.respawnT = (reg.respawnT ?? 25) - dt
        if (reg.respawnT <= 0) {
          reg.respawnT = 25
          for (let i = 0; i < reg.count; i++) this.spawnInRegion(reg, i)
        }
      } else {
        reg.respawnT = 25
      }
    }

    // ── 玩家移动（带惯性：加速起步、滑行停步）──
    let mx = 0, my = 0
    if (this.keys.has('w') || this.keys.has('arrowup')) my -= 1
    if (this.keys.has('s') || this.keys.has('arrowdown')) my += 1
    if (this.keys.has('a') || this.keys.has('arrowleft')) mx -= 1
    if (this.keys.has('d') || this.keys.has('arrowright')) mx += 1
    const mlen = Math.hypot(mx, my)
    if (mlen > 0) {
      mx /= mlen; my /= mlen
      p.walkT += dt * Math.min(1.6, Math.hypot(p.vx, p.vy) / Math.max(1, p.speed))
      if (!this.mouseDown) p.facing = Math.atan2(my, mx)
    }
    // 冲刺期间锁定方向（不被中途改向打断），出招时挪不快——给攻击一点代价
    if (p.dashT > 0 && p.dashDir) { mx = p.dashDir.x; my = p.dashDir.y }
    const swingMul = p.swingT > 0 ? 0.5 : 1
    const dashMul = p.dashT > 0 ? 3.2 : 1
    const accel = p.dashT > 0 ? 22 : 13 // 加速系数：闪避瞬间到位，平时柔和起步
    p.vx += (mx * p.speed * dashMul * swingMul - p.vx) * Math.min(1, accel * dt)
    p.vy += (my * p.speed * dashMul * swingMul - p.vy) * Math.min(1, accel * dt)
    // 受击击退：独立衰减，不污染自主移动（两者叠加，被打时明显被推开）
    p.pos.x += (p.vx + p.kb.x) * dt * 60
    p.pos.y += (p.vy + p.kb.y) * dt * 60
    p.kb.x *= Math.pow(0.0025, dt) // 约 0.15 秒衰减到 5%
    p.kb.y *= Math.pow(0.0025, dt)
    if (p.dashT > 0) {
      this.ghosts.push({
        pos: { ...p.pos },
        life: 0.28, maxLife: 0.28,
        aimLeft: this.mouse.x < p.pos.x,
      })
      if (this.ghosts.length > 14) this.ghosts.shift()
    }
    for (const g of this.ghosts) g.life -= dt
    this.ghosts = this.ghosts.filter((g) => g.life > 0)

    for (const r of this.rocks) {
      const d = Math.hypot(p.pos.x - r.pos.x, p.pos.y - r.pos.y)
      const min = r.r * 0.7 + 14
      if (d < min && d > 0) {
        p.pos.x = r.pos.x + ((p.pos.x - r.pos.x) / d) * min
        p.pos.y = r.pos.y + ((p.pos.y - r.pos.y) / d) * min
      }
    }
    p.pos.x = Math.max(24, Math.min(WORLD_W - 24, p.pos.x))
    p.pos.y = Math.max(24, Math.min(WORLD_H - 24, p.pos.y))

    p.atkCd = Math.max(0, p.atkCd - dt)
    p.dashCd = Math.max(0, p.dashCd - dt)
    p.dashT = Math.max(0, p.dashT - dt)
    p.invuln = Math.max(0, p.invuln - dt)
    p.thunderCd = Math.max(0, p.thunderCd - dt)
    p.flash = Math.max(0, p.flash - dt)
    p.swingT = Math.max(0, p.swingT - dt)
    // 脚步扬尘：跑动落地瞬间（步态相位低点）脚下扬起尘土
    const moving = Math.hypot(p.vx, p.vy) > 1.4
    if (moving && p.dashT <= 0) {
      p.dustT -= dt
      if (p.dustT <= 0 && Math.abs(Math.sin(p.walkT * 10)) < 0.4) {
        p.dustT = 0.17
        this.particles.push({
          pos: { x: p.pos.x - p.vx * 3 + (Math.random() - 0.5) * 6, y: p.pos.y + 12 },
          vel: { x: -p.vx * 0.4 + (Math.random() - 0.5) * 0.5, y: -0.4 - Math.random() * 0.4 },
          life: 0.45, maxLife: 0.45, color: 'rgba(190,180,160,0.35)', size: 2.5 + Math.random() * 1.5,
        })
      }
    }
    // 落雷 / 死亡消融计时
    for (const b of this.bolts) b.t -= dt
    this.bolts = this.bolts.filter((b) => b.t > 0)
    for (const d of this.dying) d.t -= dt
    this.dying = this.dying.filter((d) => d.t > 0)
    // 连击窗口 / 合击冷却 / 仙友喊话计时
    this.unionCd = Math.max(0, this.unionCd - dt)
    if (this.comboT > 0) {
      this.comboT -= dt
      if (this.comboT <= 0) this.combo = 0
    }
    if (this.companion.sayT > 0) this.companion.sayT -= dt

    if (p.hp < p.maxHp * 0.28 && p.pills > 0) this.usePill()
    if (this.mouseDown) this.tryAttack(this.aimDir())

    // ── 仙友助战：弹簧跟随（欠阻尼，略有滞后与回摆的拉扯感），自动御剑攻击最近的妖兽 ──
    const c = this.companion
    if (!this.ended) {
      const tx = p.pos.x - Math.cos(p.facing) * 56
      const ty = p.pos.y - Math.sin(p.facing) * 56 + 12
      // 欠阻尼弹簧：k=26、damp=8 → 起步略滞后、到位轻回摆
      c.vx += ((tx - c.pos.x) * 26 - c.vx * 8) * dt
      c.vy += ((ty - c.pos.y) * 26 - c.vy * 8) * dt
      const cSp = Math.hypot(c.vx, c.vy)
      if (cSp > 300) { c.vx *= 300 / cSp; c.vy *= 300 / cSp } // 限速，避免传送感
      c.pos.x += c.vx * dt
      c.pos.y += c.vy * dt
      c.walkT += dt * Math.min(1.6, cSp / 150) // 步伐相位随速度走
      // 跑动落地扬尘（与主角同一套步伐节奏）
      if (cSp > 90 && Math.abs(Math.sin(c.walkT * 10)) < 0.3 && Math.random() < dt * 14) {
        this.particles.push({
          pos: { x: c.pos.x - c.vx * 0.04 + (Math.random() - 0.5) * 5, y: c.pos.y + 10 },
          vel: { x: -c.vx * 0.01 + (Math.random() - 0.5) * 0.4, y: -0.3 - Math.random() * 0.3 },
          life: 0.4, maxLife: 0.4, color: 'rgba(190,180,160,0.3)', size: 2 + Math.random() * 1.2,
        })
      }
      c.atkCd -= dt
      if (c.atkCd <= 0) {
        let best: Enemy | null = null
        let bd = 460
        for (const e of this.enemies) {
          if (e.dead) continue
          const dd = Math.hypot(e.pos.x - c.pos.x, e.pos.y - c.pos.y)
          if (dd < bd) {
            bd = dd
            best = e
          }
        }
        if (best) {
          // 好感越高：出手越快、剑气越利（0.5x→1.0x 伤害，1.6s→1.1s 冷却）
          c.atkCd = 1.6 - (this.companionBond / 100) * 0.5
          const bondMul = 0.5 + this.companionBond / 200
          const ux = (best.pos.x - c.pos.x) / (bd || 1)
          const uy = (best.pos.y - c.pos.y) / (bd || 1)
          this.projectiles.push({
            pos: { ...c.pos }, vel: { x: ux * 8, y: uy * 8 },
            r: 5, dmg: p.attack * bondMul, friendly: true, life: 1.6, trail: [],
          })
          this.sfx.sword()
        } else {
          c.atkCd = 0.4
        }
      }
    }

    // ── 敌人 AI（仇恨 / 脱战回巢）──
    for (const e of this.enemies) {
      if (e.dead) continue
      e.flash = Math.max(0, e.flash - dt)
      e.atkCd = Math.max(0, e.atkCd - dt)
      // 击退位移（逐帧强衰减）
      if (e.kb) {
        e.pos.x += e.kb.x * dt * 60
        e.pos.y += e.kb.y * dt * 60
        const decay = Math.max(0, 1 - dt * 9)
        e.kb.x *= decay
        e.kb.y *= decay
        if (Math.hypot(e.kb.x, e.kb.y) < 0.2) e.kb = undefined
      }
      const dx = p.pos.x - e.pos.x
      const dy = p.pos.y - e.pos.y
      const d = Math.hypot(dx, dy) || 1
      const ux = dx / d, uy = dy / d
      const dHome = Math.hypot(e.pos.x - e.home.x, e.pos.y - e.home.y)
      const aggroR = isBossKind(e.kind) ? 520 : AGGRO

      // 仇恨判定
      if (!e.engaged && d < aggroR) {
        e.engaged = true
        if (isBossKind(e.kind)) {
          this.sfx.bossRoar()
          this.companionSay(`${this.companionName}：小心！是妖皇的气息！`)
          // Boss 登场演出：战鼓齐鸣 + 震屏 + 卷轴题名
          this.bossIntroT = 2.6
          this.bossIntroName = ENEMY_INFO[e.kind]?.name ?? '妖皇'
          this.shake = Math.max(this.shake, 15)
          if (this.bossAudio) {
            this.bossAudio.currentTime = 0
            void this.bossAudio.play().catch(() => {})
          }
        }
      }
      // 脱战：玩家跑太远 → 回巢回血
      if (e.engaged && (d > LEASH || dHome > LEASH)) {
        e.engaged = false
        e.lungeVx = e.lungeVy = undefined
      }

      if (!e.engaged) {
        // 回巢 / 巢边游荡
        if (dHome > 40) {
          const hx = (e.home.x - e.pos.x) / dHome
          const hy = (e.home.y - e.pos.y) / dHome
          e.pos.x += hx * e.speed * 1.1 * dt * 60
          e.pos.y += hy * e.speed * 1.1 * dt * 60
          e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.2 * dt)
        } else if (Math.random() < dt * 0.3) {
          // 偶尔小步走
          e.pos.x += (Math.random() - 0.5) * 20
          e.pos.y += (Math.random() - 0.5) * 20
        }
        continue
      }

      if (e.kind === 'wolf' || e.kind === 'guworm') {
        if (d > e.r + 18) {
          e.pos.x += ux * e.speed * dt * 60
          e.pos.y += uy * e.speed * dt * 60
        } else if (e.atkCd <= 0) {
          e.atkCd = 1
          this.hurtPlayer(e.dmg, e.pos)
        }
      } else if (e.kind === 'spider' || e.kind === 'frostmoth' || e.kind === 'silkworm') {
        if (d < 200) { e.pos.x -= ux * e.speed * dt * 60; e.pos.y -= uy * e.speed * dt * 60 }
        else if (d > 300) { e.pos.x += ux * e.speed * dt * 60; e.pos.y += uy * e.speed * dt * 60 }
        e.spitCd = (e.spitCd ?? 2) - dt
        if (e.spitCd <= 0 && d < 420) {
          e.spitCd = 2.2
          this.projectiles.push({
            pos: { ...e.pos }, vel: { x: ux * 5.5, y: uy * 5.5 },
            r: 6, dmg: e.dmg, friendly: false, life: 2.5,
          })
        }
      } else if (e.kind === 'spirit' || e.kind === 'iceserpent') {
        if (e.lungeVx != null && e.lungeVy != null) {
          e.pos.x += e.lungeVx * dt * 60
          e.pos.y += e.lungeVy * dt * 60
          e.lungeT = (e.lungeT ?? 0) - dt
          this.particles.push({
            pos: { ...e.pos }, vel: { x: 0, y: 0 },
            life: 0.25, maxLife: 0.25, color: 'rgba(200,230,255,0.5)', size: 6,
          })
          if (d < e.r + 16 && p.invuln <= 0) this.hurtPlayer(e.dmg, e.pos)
          if ((e.lungeT ?? 0) <= 0) {
            e.lungeVx = e.lungeVy = undefined
            e.lungeT = 2.2 + Math.random() * 1.6
          }
        } else {
          const orbit = 150
          if (d > orbit + 20) { e.pos.x += ux * e.speed * dt * 60; e.pos.y += uy * e.speed * dt * 60 }
          else if (d < orbit - 20) { e.pos.x -= ux * e.speed * dt * 60; e.pos.y -= uy * e.speed * dt * 60 }
          else {
            e.pos.x += -uy * e.speed * 0.8 * dt * 60
            e.pos.y += ux * e.speed * 0.8 * dt * 60
          }
          e.lungeT = (e.lungeT ?? 2) - dt
          if (e.lungeT <= 0 && d < 380) {
            e.lungeT = 0.5
            e.lungeVx = ux * 9
            e.lungeVy = uy * 9
            this.sfx.dash()
          }
        }
      } else if (e.kind === 'golem' || e.kind === 'plaguetoad') {
        if (d > e.r + 26) {
          e.pos.x += ux * e.speed * dt * 60
          e.pos.y += uy * e.speed * dt * 60
        } else if (e.atkCd <= 0) {
          e.atkCd = 1.4
          this.hurtPlayer(e.dmg, e.pos)
        }
        e.slamCd = (e.slamCd ?? 4) - dt
        if (e.slamCd <= 0 && d < 240) {
          e.slamCd = 5
          this.telegraphs.push({ pos: { ...e.pos }, r: 120, t: 0.9, max: 0.9, dmg: e.dmg })
          this.shake = Math.max(this.shake, 3)
        }
      } else {
        // Boss（赤炎蛟 / 玄冰鲛皇 / 万蛊蛊皇）
        // 二阶段：血量过半暴走——提速、天火更密，蛊皇还会召虫潮
        if (!e.phase2 && e.hp < e.maxHp * 0.5) {
          e.phase2 = true
          e.speed *= 1.25
          this.shake = Math.max(this.shake, 10)
          this.sfx.bossRoar()
          this.companionSay(`${this.companionName}：它暴走了！小心！`)
          this.dmgNums.push({ pos: { x: e.pos.x, y: e.pos.y - e.r - 30 }, text: '暴走', life: 1.2, crit: true })
          for (let i = 0; i < 24; i++) {
            const a = (i / 24) * Math.PI * 2
            this.particles.push({
              pos: { ...e.pos },
              vel: { x: Math.cos(a) * 4, y: Math.sin(a) * 4 },
              life: 0.7, maxLife: 0.7, color: 'rgba(255,80,140,0.85)', size: 5,
            })
          }
          if (e.kind === 'guboss') {
            // 蛊皇召来三只蛊蜈护卫
            for (let i = 0; i < 3; i++) {
              const a = (i / 3) * Math.PI * 2
              const m: Enemy = {
                kind: 'guworm',
                pos: { x: e.pos.x + Math.cos(a) * 90, y: e.pos.y + Math.sin(a) * 90 },
                home: { ...e.pos },
                region: e.region,
                hp: 60, maxHp: 60, speed: 2.4, dmg: 12, r: 15,
                flash: 0, atkCd: 0, spitCd: 2, engaged: true,
              }
              this.enemies.push(m)
            }
          }
        }
        e.chargeT = (e.chargeT ?? 3) - dt
        if (e.chargeT <= 0) {
          e.chargeT = (e.phase2 ? 2.6 : 4) + Math.random() * 2
          this.telegraphs.push({ pos: { ...p.pos }, r: 90, t: 1.1, max: 1.1, dmg: e.dmg * 1.5 })
          this.telegraphs.push({ pos: { x: p.pos.x + (Math.random() - 0.5) * 300, y: p.pos.y + (Math.random() - 0.5) * 300 }, r: 90, t: 1.3, max: 1.3, dmg: e.dmg * 1.5 })
          if (e.phase2) {
            this.telegraphs.push({ pos: { x: p.pos.x + (Math.random() - 0.5) * 400, y: p.pos.y + (Math.random() - 0.5) * 400 }, r: 80, t: 1.5, max: 1.5, dmg: e.dmg * 1.2 })
          }
          this.sfx.bossRoar()
        }
        const rush = e.chargeT < 0.6 ? 2.6 : 1
        if (d > e.r + 20) {
          e.pos.x += ux * e.speed * rush * dt * 60
          e.pos.y += uy * e.speed * rush * dt * 60
        } else if (e.atkCd <= 0) {
          e.atkCd = 0.9
          this.hurtPlayer(e.dmg, e.pos)
        }
      }

      // 敌人互相推开
      for (const o of this.enemies) {
        if (o === e || o.dead) continue
        const dd = Math.hypot(e.pos.x - o.pos.x, e.pos.y - o.pos.y)
        const min = e.r + o.r
        if (dd < min && dd > 0) {
          e.pos.x += ((e.pos.x - o.pos.x) / dd) * (min - dd) * 0.5
          e.pos.y += ((e.pos.y - o.pos.y) / dd) * (min - dd) * 0.5
        }
      }
      e.pos.x = Math.max(20, Math.min(WORLD_W - 20, e.pos.x))
      e.pos.y = Math.max(20, Math.min(WORLD_H - 20, e.pos.y))
    }

    // 天火落点结算
    for (const t of this.telegraphs) {
      t.t -= dt
      if (t.t <= 0) {
        this.shake = Math.max(this.shake, 6)
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * Math.PI * 2
          this.particles.push({
            pos: { x: t.pos.x + Math.cos(a) * t.r * 0.6, y: t.pos.y + Math.sin(a) * t.r * 0.6 },
            vel: { x: Math.cos(a) * 2, y: -2 - Math.random() * 2 },
            life: 0.5, maxLife: 0.5, color: 'rgba(255,120,60,0.85)', size: 6,
          })
        }
        if (Math.hypot(p.pos.x - t.pos.x, p.pos.y - t.pos.y) < t.r && p.invuln <= 0) {
          this.hurtPlayer(t.dmg, t.pos)
        }
      }
    }
    this.telegraphs = this.telegraphs.filter((t) => t.t > -0.3)

    // 飞剑 / 毒液
    for (const pr of this.projectiles) {
      if (pr.friendly) {
        pr.trail = pr.trail ?? []
        pr.trail.unshift({ x: pr.pos.x, y: pr.pos.y })
        if (pr.trail.length > 7) pr.trail.pop()
      }
      pr.pos.x += pr.vel.x * dt * 60
      pr.pos.y += pr.vel.y * dt * 60
      pr.life -= dt
      if (pr.friendly) {
        for (const e of this.enemies) {
          if (e.dead) continue
          if (Math.hypot(pr.pos.x - e.pos.x, pr.pos.y - e.pos.y) < pr.r + e.r) {
            const vl = Math.hypot(pr.vel.x, pr.vel.y) || 1
            this.hurtEnemy(e, pr.dmg, false, { x: pr.vel.x / vl, y: pr.vel.y / vl })
            pr.life = 0
            break
          }
        }
      } else if (p.invuln <= 0 && Math.hypot(pr.pos.x - p.pos.x, pr.pos.y - p.pos.y) < pr.r + 14) {
        this.hurtPlayer(pr.dmg, pr.pos)
        pr.life = 0
      }
    }
    this.projectiles = this.projectiles.filter((pr) => pr.life > 0)

    // 拾取
    for (const pk of this.pickups) {
      pk.t += dt * 3
      const d = Math.hypot(pk.pos.x - p.pos.x, pk.pos.y - p.pos.y)
      if (d < 90) {
        pk.pos.x += ((p.pos.x - pk.pos.x) / d) * 6 * dt * 60
        pk.pos.y += ((p.pos.y - pk.pos.y) / d) * 6 * dt * 60
      }
      if (d < 22) {
        // 连击奖励：灵气掉落随连击加成（至多 ×2）
        const cm = 1 + Math.min(this.combo, 40) * 0.025
        if (pk.kind === 'stone') this.loot.stones += Math.round((1 + Math.floor(Math.random() * 3)) * cm)
        if (pk.kind === 'herb') this.loot.herbs += Math.random() < cm - 1 ? 2 : 1
        if (pk.kind === 'ore') this.loot.ore += Math.random() < cm - 1 ? 2 : 1
        pk.t = -999
        this.sfx.pickup()
      }
    }
    this.pickups = this.pickups.filter((pk) => pk.t > -100)

    // ── 奇遇点位触发 ──
    for (const prop of this.props) {
      if (!prop.active) {
        if (prop.kind === 'herb' && prop.respawnT > 0) {
          prop.respawnT -= dt
          if (prop.respawnT <= 0) prop.active = true
        }
        continue
      }
      const d = Math.hypot(prop.pos.x - p.pos.x, prop.pos.y - p.pos.y)
      if (d > 52) continue
      if (prop.kind === 'herb') {
        prop.active = false
        prop.respawnT = 40
        this.loot.herbs += 1
        this.dmgNums.push({ pos: { ...prop.pos }, text: '+1 灵草', life: 1, crit: false })
        this.sfx.pickup()
      } else if (prop.kind === 'chest') {
        prop.active = false
        const stones = 8 + Math.floor(Math.random() * 8)
        const ore = 2 + Math.floor(Math.random() * 3)
        this.loot.stones += stones
        this.loot.ore += ore
        this.dmgNums.push({ pos: { ...prop.pos }, text: `宝箱 +${stones} 灵石 +${ore} 玄铁`, life: 1.4, crit: true })
        this.sfx.pickup()
      } else if (prop.kind === 'stele' && !this.insightUsed) {
        prop.active = false
        this.insightUsed = true
        this.player.attack = Math.round(this.player.attack * 1.25)
        this.player.hp = this.player.maxHp
        this.dmgNums.push({ pos: { ...prop.pos }, text: '顿悟！剑意+25% · 气血全满', life: 1.6, crit: true })
        this.sfx.pickup()
      }
    }

    for (const pt of this.particles) {
      pt.pos.x += pt.vel.x * dt * 60
      pt.pos.y += pt.vel.y * dt * 60
      pt.life -= dt
    }
    this.particles = this.particles.filter((pt) => pt.life > 0)
    for (const dn of this.dmgNums) { dn.pos.y -= 40 * dt; dn.life -= dt }
    this.dmgNums = this.dmgNums.filter((dn) => dn.life > 0)

    this.shake = Math.max(0, this.shake - dt * 30)
    this.bossIntroT = Math.max(0, this.bossIntroT - dt)

    // ── 相机：平滑跟随 + 朝准星前瞻 ──
    // 原先是硬跟随（每帧钉死在角色身上），背景贴脸滑、毫无速度感；
    // 指数逼近给一点跟随延迟（跑起来画面才"跟得上"），前瞻让人提前看到要去的方向。
    const vw = this.canvas.width, vh = this.canvas.height
    const lookX = Math.max(-1, Math.min(1, (this.mouse.x - p.pos.x) / (vw * 0.5)))
    const lookY = Math.max(-1, Math.min(1, (this.mouse.y - p.pos.y) / (vh * 0.5)))
    const lead = p.dashT > 0 ? 92 : 62 // 冲刺时看远一点，便于预判落点
    const tx = p.pos.x + lookX * lead - vw / 2
    const ty = p.pos.y + lookY * lead - vh / 2
    if (!this.camReady) {
      this.cam.x = tx; this.cam.y = ty; this.camReady = true
    } else {
      const k = Math.min(1, (p.dashT > 0 ? 9 : 6.5) * dt)
      this.cam.x += (tx - this.cam.x) * k
      this.cam.y += (ty - this.cam.y) * k
    }
    this.cam.x = Math.max(0, Math.min(WORLD_W - vw, this.cam.x))
    this.cam.y = Math.max(0, Math.min(WORLD_H - vh, this.cam.y))

    // 当前所在区域
    let regionName = '荒野灵台'
    for (const reg of this.regions) {
      if (Math.hypot(p.pos.x - reg.cx, p.pos.y - reg.cy) < reg.r) {
        regionName = reg.name
        break
      }
    }
    const boss = this.enemies.find((e) => isBossKind(e.kind) && !e.dead)
    this.lastRegion = regionName
    if (this.combo > this.maxCombo) this.maxCombo = this.combo
    this.onHud({
      hp: Math.max(0, Math.ceil(p.hp)),
      maxHp: p.maxHp,
      region: regionName,
      enemiesNear: this.enemies.filter((e) => !e.dead && e.engaged).length,
      pills: p.pills,
      dashCd: p.dashCd,
      thunderCd: p.thunderCd,
      combo: this.combo,
      comboMult: 1 + Math.min(this.combo, 40) * 0.025,
      unionCd: this.companionBond >= 100 ? this.unionCd : -1,
      loot: { ...this.loot },
      bossAlive: !this.bossDead,
      bossHp: boss && boss.engaged ? boss.hp : null,
      bossMax: boss ? boss.maxHp : 0,
      bossName: boss ? (ENEMY_INFO[boss.kind]?.name ?? null) : null,
    })
  }

  private hurtPlayer(dmg: number, from?: Vec) {
    const p = this.player
    if (p.invuln > 0 || this.ended) return
    p.hp -= dmg
    p.flash = 0.2
    p.invuln = 0.5
    this.combo = 0 // 受击断连击
    this.comboT = 0
    // 击退：被打退半步才有重量感，否则"贴脸挨打不掉血"显得很轻
    if (from) {
      const dx = p.pos.x - from.x, dy = p.pos.y - from.y
      const len = Math.hypot(dx, dy) || 1
      const push = 2.6 + Math.min(2.2, dmg * 0.06)
      p.kb.x = (dx / len) * push
      p.kb.y = (dy / len) * push
    }
    this.shake = Math.max(this.shake, 7)
    this.sfx.hurt()
    // 仙友护主喊话
    if (p.hp > 0 && p.hp < p.maxHp * 0.3 && this.companion.sayT <= 0) {
      this.companionSay(`${this.companionName}：主人撑住，我来掩护！`)
    }
    for (let i = 0; i < Math.max(3, Math.round(8 * this.particleMult)); i++) {
      this.particles.push({
        pos: { ...p.pos },
        vel: { x: (Math.random() - 0.5) * 4, y: (Math.random() - 0.5) * 4 },
        life: 0.4, maxLife: 0.4, color: 'rgba(255,90,90,0.8)', size: 4,
      })
    }
    if (p.hp <= 0) this.endDungeon(false, true)
  }

  // ─── 渲染 ───
  private render() {
    const ctx = this.ctx
    const vw = this.canvas.width, vh = this.canvas.height
    const sx = (Math.random() - 0.5) * this.shake
    const sy = (Math.random() - 0.5) * this.shake

    ctx.save()
    ctx.translate(-this.cam.x + sx, -this.cam.y + sy)

    // 基础地面（荒野：暗色石纹打底）
    ctx.fillStyle = '#141817'
    ctx.fillRect(this.cam.x - 20, this.cam.y - 20, vw + 40, vh + 40)
    const wildPattern = this.tilePatterns.barren
    if (wildPattern) {
      ctx.save()
      ctx.globalAlpha = 0.28
      ctx.fillStyle = wildPattern
      ctx.fillRect(this.cam.x - 20, this.cam.y - 20, vw + 40, vh + 40)
      ctx.restore()
    }

    // 区域地表（贴图平铺）
    for (const reg of this.regions) {
      const pattern = this.tilePatterns[reg.tile]
      ctx.save()
      ctx.beginPath()
      ctx.arc(reg.cx, reg.cy, reg.r, 0, Math.PI * 2)
      ctx.clip()
      if (pattern) {
        ctx.globalAlpha = 0.9
        ctx.fillStyle = pattern
        ctx.fillRect(reg.cx - reg.r, reg.cy - reg.r, reg.r * 2, reg.r * 2)
        ctx.globalAlpha = 1
      } else {
        ctx.fillStyle = '#1a201c'
        ctx.fillRect(reg.cx - reg.r, reg.cy - reg.r, reg.r * 2, reg.r * 2)
      }
      ctx.restore()
      // 区域边缘
      ctx.strokeStyle = reg.tint
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(reg.cx, reg.cy, reg.r, 0, Math.PI * 2)
      ctx.stroke()
      // 区域名
      ctx.font = '26px "Noto Serif SC", "SimSun", serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = 'rgba(255,255,255,0.14)'
      ctx.fillText(reg.name, reg.cx, reg.cy - reg.r + 46)
    }

    // 世界边界
    ctx.strokeStyle = 'rgba(150,235,200,0.15)'
    ctx.lineWidth = 4
    ctx.strokeRect(8, 8, WORLD_W - 16, WORLD_H - 16)

    // 天火预警圈
    for (const t of this.telegraphs) {
      const a = Math.max(0, t.t / t.max)
      ctx.fillStyle = `rgba(255,80,40,${0.12 + 0.1 * (1 - a)})`
      ctx.beginPath(); ctx.arc(t.pos.x, t.pos.y, t.r, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = `rgba(255,120,60,${0.7 * a + 0.2})`
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(t.pos.x, t.pos.y, t.r * (0.4 + 0.6 * a), 0, Math.PI * 2); ctx.stroke()
    }

    // 山石
    for (const r of this.rocks) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.beginPath(); ctx.ellipse(r.pos.x, r.pos.y + r.r * 0.45, r.r, r.r * 0.35, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#2a3230'
      ctx.beginPath(); ctx.arc(r.pos.x, r.pos.y, r.r * 0.8, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#37423e'
      ctx.beginPath(); ctx.arc(r.pos.x - r.r * 0.2, r.pos.y - r.r * 0.25, r.r * 0.5, 0, Math.PI * 2); ctx.fill()
    }

    // 拾取物
    for (const pk of this.pickups) {
      const bobY = Math.sin(pk.t) * 4
      const colors = { stone: '#8fd3f4', herb: '#7ee08a', ore: '#c9a0e8' }
      ctx.fillStyle = colors[pk.kind]
      ctx.save()
      ctx.shadowColor = colors[pk.kind]
      ctx.shadowBlur = 10
      ctx.beginPath()
      ctx.arc(pk.pos.x, pk.pos.y - 12 + bobY, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    // y 排序实体（装饰 + 敌人 + 玩家）
    const p = this.player
    type DrawItem = { y: number; draw: () => void }
    const items: DrawItem[] = []

    for (const dc of this.decos) {
      items.push({
        y: dc.pos.y,
        draw: () => {
          ctx.fillStyle = 'rgba(0,0,0,0.3)'
          ctx.beginPath(); ctx.ellipse(dc.pos.x, dc.pos.y + 4, dc.h * 0.28, dc.h * 0.09, 0, 0, Math.PI * 2); ctx.fill()
          ctx.drawImage(dc.img, dc.pos.x - dc.h / 2, dc.pos.y - dc.h + 8, dc.h, dc.h)
        },
      })
    }

    // 奇遇点位（灵草/宝箱/顿悟台）
    const propH: Record<EncounterProp['kind'], number> = { herb: 56, chest: 66, stele: 116 }
    const t = performance.now() / 1000
    for (const prop of this.props) {
      const img = this.propImgs[prop.kind]
      if (!img || !this.propReady[prop.kind]) continue
      const h = propH[prop.kind]
      items.push({
        y: prop.pos.y,
        draw: () => {
          ctx.save()
          if (prop.active) {
            // 呼吸光环
            const pulse = 0.5 + 0.3 * Math.sin(t * 2.4)
            const glow = prop.kind === 'herb' ? '126,224,138' : prop.kind === 'chest' ? '240,200,120' : '216,184,119'
            ctx.fillStyle = `rgba(${glow},${0.10 + 0.08 * pulse})`
            ctx.beginPath(); ctx.ellipse(prop.pos.x, prop.pos.y + 2, h * 0.42, h * 0.15, 0, 0, Math.PI * 2); ctx.fill()
            const bob = prop.kind === 'herb' ? Math.sin(t * 2 + prop.pos.x) * 3 : 0
            ctx.drawImage(img, prop.pos.x - h / 2, prop.pos.y - h + 8 + bob, h, h)
          } else {
            ctx.globalAlpha = prop.kind === 'herb' ? 0.22 : 0.35
            ctx.drawImage(img, prop.pos.x - h / 2, prop.pos.y - h + 8, h, h)
            ctx.globalAlpha = 1
          }
          ctx.restore()
        },
      })
    }

    for (const e of this.enemies) {
      if (e.dead) continue
      items.push({
        y: e.pos.y,
        draw: () => {
          ctx.fillStyle = 'rgba(0,0,0,0.4)'
          ctx.beginPath(); ctx.ellipse(e.pos.x, e.pos.y + e.r * 0.6, e.r * 0.9, e.r * 0.3, 0, 0, Math.PI * 2); ctx.fill()
          const flash = e.flash > 0 && Math.floor(performance.now() / 60) % 2 === 0
          const img = this.enemyImgs[e.kind]
          const drawH = ENEMY_SPRITE_H[e.kind]
          if (img && this.enemyImgReady[e.kind]) {
            ctx.save()
            ctx.translate(e.pos.x, e.pos.y - drawH * 0.12)
            // 行走蠕动：按各自节拍轻微缩放脉动，不再是静态贴图滑行
            const wob = 1 + Math.sin(performance.now() / 170 + e.home.x) * 0.045
            ctx.scale(wob, 2 - wob)
            // 攻击前摇：即将出手且逼近玩家时，泛红膨胀警示
            const pd = Math.hypot(this.player.pos.x - e.pos.x, this.player.pos.y - e.pos.y)
            if (e.engaged && e.atkCd > 0 && e.atkCd < 0.22 && pd < e.r + 90) {
              ctx.scale(1.1, 1.1)
              ctx.shadowColor = 'rgba(255,80,60,0.9)'
              ctx.shadowBlur = 16
            }
            if (flash) ctx.globalAlpha = 0.45
            if (this.player.pos.x < e.pos.x) ctx.scale(-1, 1)
            if (e.kind === 'spirit' && e.lungeVx != null) {
              ctx.rotate((this.player.pos.x < e.pos.x ? -1 : 1) * 0.5)
            }
            ctx.drawImage(img, -drawH / 2, -drawH / 2, drawH, drawH)
            ctx.restore()
            if (isBossKind(e.kind)) {
              const t = performance.now() / 400
              for (let i = 0; i < 5; i++) {
                const a = t * 0.7 + (i / 5) * Math.PI * 2
                ctx.fillStyle = `rgba(255,${120 + Math.floor(60 * Math.sin(t + i))},50,0.5)`
                ctx.beginPath()
                ctx.arc(e.pos.x + Math.cos(a) * e.r * 1.3, e.pos.y - 10 + Math.sin(a) * e.r, 4, 0, Math.PI * 2)
                ctx.fill()
              }
            }
          } else {
            ctx.fillStyle = flash ? '#ffffff' : isBossKind(e.kind) ? '#8a2f2a' : '#5a4a52'
            ctx.beginPath(); ctx.ellipse(e.pos.x, e.pos.y, e.r, e.r * 0.8, 0, 0, Math.PI * 2); ctx.fill()
          }
          // 血条（交战或受伤时）
          if (e.hp < e.maxHp) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)'
            ctx.fillRect(e.pos.x - e.r, e.pos.y - e.r - 14, e.r * 2, 5)
            ctx.fillStyle = '#e05545'
            ctx.fillRect(e.pos.x - e.r, e.pos.y - e.r - 14, (e.hp / e.maxHp) * e.r * 2, 5)
          }
        },
      })
    }

    // 死亡消融：尸体旋转缩小淡去（画在存活实体之前）
    for (const d of this.dying) {
      const img = this.enemyImgs[d.kind]
      const drawH = ENEMY_SPRITE_H[d.kind]
      const k = 1 - d.t / d.max // 0→1
      items.push({
        y: d.pos.y - 1,
        draw: () => {
          ctx.save()
          ctx.translate(d.pos.x, d.pos.y - drawH * 0.12)
          ctx.rotate(k * 0.9)
          const s = 1 + k * 0.25
          ctx.scale(s * (1 - k * 0.8), s * (1 - k * 0.8))
          ctx.globalAlpha = (1 - k) * 0.85
          if (img && this.enemyImgReady[d.kind]) ctx.drawImage(img, -drawH / 2, -drawH / 2, drawH, drawH)
          ctx.restore()
        },
      })
    }

    // 仙友（助战伙伴）
    const comp = this.companion
    items.push({
      y: comp.pos.y,
      draw: () => {
        ctx.fillStyle = 'rgba(0,0,0,0.35)'
        ctx.beginPath(); ctx.ellipse(comp.pos.x, comp.pos.y + 10, 13, 4.5, 0, 0, Math.PI * 2); ctx.fill()
        ctx.save()
        // 与主角同一套步伐：|sin| 双脚起落 + 落地压弹 + 速度前倾
        const cSp = Math.hypot(comp.vx, comp.vy)
        const cMoving = cSp > 20
        const cStep = Math.abs(Math.sin(comp.walkT * 10))
        ctx.translate(comp.pos.x, comp.pos.y + (cMoving ? -cStep * 1.8 : Math.sin(performance.now() / 350) * 1.2))
        if (this.companionImgReady) {
          const h = 56
          if (this.player.pos.x > comp.pos.x) ctx.scale(-1, 1)
          // 前倾：朝跑动方向压身；落地瞬间压扁
          const cLean = Math.max(-1, Math.min(1, comp.vx / 160)) * (this.player.pos.x > comp.pos.x ? -1 : 1)
          ctx.rotate(cLean * 0.08)
          const csq = cMoving ? (1 - cStep) * 0.05 : 0
          ctx.scale(1 - csq, 1 + csq)
          ctx.drawImage(this.companionImg, -h / 2, -h + 14, h, h)
        } else {
          ctx.fillStyle = '#7a9fc9'
          ctx.beginPath(); ctx.arc(0, -6, 10, 0, Math.PI * 2); ctx.fill()
        }
        ctx.restore()
        ctx.font = '9px "Noto Serif SC", serif'
        ctx.textAlign = 'center'
        ctx.fillStyle = 'rgba(255,190,220,0.75)'
        ctx.fillText(this.companionName, comp.pos.x, comp.pos.y - 44)
        // 仙友喊话气泡
        if (comp.sayT > 0 && comp.sayText) {
          ctx.font = '11px "Noto Serif SC", serif'
          const tw = ctx.measureText(comp.sayText).width
          const bw = tw + 16
          const bx = comp.pos.x
          const by = comp.pos.y - 54
          ctx.fillStyle = 'rgba(10,18,16,0.88)'
          ctx.strokeStyle = 'rgba(255,170,210,0.55)'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.roundRect(bx - bw / 2, by - 18, bw, 20, 8)
          ctx.fill()
          ctx.stroke()
          ctx.fillStyle = 'rgba(255,225,240,0.95)'
          ctx.fillText(comp.sayText, bx, by - 4)
        }
      },
    })

    // 玩家
    items.push({
      y: p.pos.y,
      draw: () => {
        ctx.fillStyle = 'rgba(0,0,0,0.4)'
        ctx.beginPath(); ctx.ellipse(p.pos.x, p.pos.y + 12, 16, 5.5, 0, 0, Math.PI * 2); ctx.fill()
        // 坐骑：戴在身上的灵兽驮主而行（垫在小仙脚下）
        const speed0 = Math.hypot(p.vx, p.vy)
        if (this.mountReady && this.mountImg) {
          const mh = 108
          const mbob = Math.abs(Math.sin(p.walkT * 10)) * (speed0 > 0.3 ? 3 : 1.2)
          ctx.save()
          ctx.translate(p.pos.x, p.pos.y + 8 + mbob)
          if (this.mouse.x < p.pos.x) ctx.scale(-1, 1)
          ctx.drawImage(this.mountImg, -mh * 0.62, -mh * 0.52, mh * 1.24, mh * 1.24)
          ctx.restore()
        }
        ctx.save()
        ctx.translate(p.pos.x, p.pos.y)
        const speed = Math.hypot(p.vx, p.vy)
        // 步伐：双脚交替起落（|sin| 每周期两个落点），身体随脚步一沉一抬，不再悬空飘移
        const stepPh = Math.abs(Math.sin(p.walkT * 10))
        ctx.translate(0, speed > 0.3 ? -stepPh * 2.2 : Math.sin(p.walkT * 3) * 0.8)
        const flash = p.flash > 0 && Math.floor(performance.now() / 60) % 2 === 0
        if (p.dashT > 0) ctx.globalAlpha = 0.6
        if (flash) ctx.globalAlpha *= 0.5
        // 受击无敌帧：半透明闪烁提示
        if (p.invuln > 0) ctx.globalAlpha *= Math.floor(performance.now() / 90) % 2 === 0 ? 0.35 : 0.8

        // 挥剑：身体向挥砍方向前倾冲刺
        const swingK = p.swingT > 0 ? 1 - p.swingT / 0.22 : 0
        if (p.swingT > 0) {
          const lunge = Math.sin(swingK * Math.PI) * 7
          ctx.translate(Math.cos(p.facing) * lunge, Math.sin(p.facing) * lunge)
        }

        const aimLeft = this.mouse.x < p.pos.x
        if (this.playerImgReady) {
          const h = 68
          // 眨眼调度：每 2.6~5.4 秒轻眨 150ms，挥剑时不眨
          const wallMs = performance.now()
          if (wallMs > this.blinkNextAt) {
            this.blinkUntil = wallMs + 150
            this.blinkNextAt = wallMs + 2600 + Math.random() * 2800
          }
          const blinking = wallMs < this.blinkUntil && this.playerBlinkReady && p.swingT <= 0
          ctx.save()
          if (aimLeft) ctx.scale(-1, 1)
          // 灵翼：背生双翼随呼吸扑扇（画在本体之后）
          if (this.wingReady && this.wingImg) {
            const flutter = 1 + Math.sin(performance.now() / 130) * 0.05
            ctx.save()
            ctx.translate(0, -30)
            ctx.scale(flutter, flutter)
            ctx.globalAlpha *= 0.92
            ctx.drawImage(this.wingImg, -62, -62, 124, 87)
            ctx.restore()
          }
          // 移动倾斜：朝速度方向压身；挥剑时再压 8°
          const lean = Math.max(-1, Math.min(1, p.vx / Math.max(1, p.speed))) * (aimLeft ? -1 : 1)
          ctx.rotate(lean * 0.09 + (p.swingT > 0 ? Math.sin(swingK * Math.PI) * 0.14 : 0))
          // 步伐压弹：落地瞬间（stepPh 低点）身体压缩，抬脚时舒展
          const sq = speed > 0.3 ? (1 - stepPh) * 0.05 : 0
          ctx.scale(1 - sq, 1 + sq)
          ctx.drawImage(blinking ? this.playerBlinkImg : this.playerImg, -h / 2, -h + 16, h, h)
          ctx.restore()
        } else {
          ctx.fillStyle = '#3e8f7a'
          ctx.beginPath()
          ctx.moveTo(-13, 14)
          ctx.quadraticCurveTo(-12, -8, -6, -14)
          ctx.lineTo(6, -14)
          ctx.quadraticCurveTo(12, -8, 13, 14)
          ctx.quadraticCurveTo(0, 19, -13, 14)
          ctx.fill()
          ctx.fillStyle = '#f6e0c4'
          ctx.beginPath(); ctx.arc(0, -22, 9, 0, Math.PI * 2); ctx.fill()
        }

        ctx.save()
        ctx.rotate(Math.atan2(this.mouse.y - p.pos.y, this.mouse.x - p.pos.x))
        ctx.fillStyle = '#cfe8ff'
        ctx.shadowColor = '#9fd0ff'
        ctx.shadowBlur = 8
        ctx.beginPath()
        ctx.moveTo(26, 0); ctx.lineTo(38, -2.5); ctx.lineTo(38, 2.5)
        ctx.fill()
        ctx.restore()
        ctx.restore()

        // 月牙剑光：挥剑瞬间沿挥砍方向扫出一弧
        if (p.swingT > 0) {
          const sweep = -1.25 + swingK * 2.2 // 剑光扫过的角度区间
          ctx.save()
          ctx.translate(p.pos.x, p.pos.y - 6)
          ctx.rotate(p.facing)
          for (let i = 0; i < 3; i++) {
            const a = sweep - i * 0.16
            ctx.strokeStyle = `rgba(190,225,255,${(1 - swingK) * (0.85 - i * 0.25)})`
            ctx.lineWidth = 5 - i * 1.4
            ctx.beginPath()
            ctx.arc(0, 0, 38 + i * 5, a - 0.35, a + 0.05)
            ctx.stroke()
          }
          ctx.restore()
        }
      },
    })

    // 闪避残影（画在实体之下）
    if (this.playerImgReady) {
      for (const g of this.ghosts) {
        ctx.save()
        ctx.globalAlpha = (g.life / g.maxLife) * 0.45
        ctx.translate(g.pos.x, g.pos.y)
        if (g.aimLeft) ctx.scale(-1, 1)
        ctx.drawImage(this.playerImg, -34, -52, 68, 68)
        ctx.restore()
      }
    }

    items.sort((a, b) => a.y - b.y)
    for (const it of items) it.draw()

    // 落雷：天火自穹顶劈落 + 地面冲击环
    for (const b of this.bolts) {
      const k = 1 - b.t / b.max // 0→1
      const fade = 1 - k
      // 锯齿闪电主干（每帧重排分叉，有闪烁感）
      ctx.save()
      ctx.strokeStyle = `rgba(210,230,255,${0.95 * fade})`
      ctx.lineWidth = 3.5
      ctx.shadowColor = '#bcd8ff'
      ctx.shadowBlur = 18
      ctx.beginPath()
      let bx = b.pos.x
      let by = b.pos.y - 300
      ctx.moveTo(bx, by)
      const segs = 7
      for (let i = 1; i <= segs; i++) {
        by = b.pos.y - 300 + (300 / segs) * i
        bx = b.pos.x + (i === segs ? 0 : (Math.random() - 0.5) * 34)
        ctx.lineTo(bx, by)
      }
      ctx.stroke()
      ctx.restore()
      // 落点冲击环
      ctx.save()
      ctx.strokeStyle = `rgba(190,220,255,${0.7 * fade})`
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.ellipse(b.pos.x, b.pos.y + 2, 14 + k * 70, (14 + k * 70) * 0.4, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = `rgba(220,235,255,${0.28 * fade})`
      ctx.beginPath()
      ctx.ellipse(b.pos.x, b.pos.y + 2, 16, 7, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    // 飞剑 / 毒液
    for (const pr of this.projectiles) {
      if (pr.friendly) {
        // 剑气拖尾
        if (pr.trail && pr.trail.length > 1) {
          for (let i = 1; i < pr.trail.length; i++) {
            const fade = 1 - i / pr.trail.length
            ctx.fillStyle = `rgba(159, 208, 255, ${0.35 * fade})`
            ctx.beginPath()
            ctx.arc(pr.trail[i].x, pr.trail[i].y, 6 * fade + 1.5, 0, Math.PI * 2)
            ctx.fill()
          }
        }
        const a = Math.atan2(pr.vel.y, pr.vel.x)
        ctx.save()
        ctx.translate(pr.pos.x, pr.pos.y)
        ctx.rotate(a)
        ctx.fillStyle = '#cfe8ff'
        ctx.shadowColor = '#9fd0ff'
        ctx.shadowBlur = 12
        ctx.beginPath()
        ctx.moveTo(12, 0); ctx.lineTo(-8, -3.5); ctx.lineTo(-4, 0); ctx.lineTo(-8, 3.5)
        ctx.closePath(); ctx.fill()
        ctx.restore()
      } else {
        ctx.fillStyle = '#b8e05a'
        ctx.shadowColor = '#b8e05a'
        ctx.shadowBlur = 8
        ctx.beginPath(); ctx.arc(pr.pos.x, pr.pos.y, pr.r, 0, Math.PI * 2); ctx.fill()
        ctx.shadowBlur = 0
      }
    }

    // 粒子
    for (const pt of this.particles) {
      ctx.globalAlpha = pt.life / pt.maxLife
      ctx.fillStyle = pt.color
      ctx.beginPath(); ctx.arc(pt.pos.x, pt.pos.y, pt.size, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 1

    // 伤害数字
    ctx.textAlign = 'center'
    for (const dn of this.dmgNums) {
      ctx.globalAlpha = Math.min(1, dn.life * 2)
      ctx.font = dn.crit ? 'bold 22px serif' : 'bold 15px serif'
      ctx.fillStyle = dn.crit ? '#ffd84a' : '#ffffff'
      ctx.strokeStyle = 'rgba(0,0,0,0.7)'
      ctx.lineWidth = 3
      ctx.strokeText(dn.text, dn.pos.x, dn.pos.y)
      ctx.fillText(dn.text, dn.pos.x, dn.pos.y)
    }
    ctx.globalAlpha = 1

    ctx.restore()

    // 低血警示：屏幕边缘血色脉动（屏幕空间）
    if (p.hp > 0 && p.hp < p.maxHp * 0.3) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 180)
      const g = ctx.createRadialGradient(vw / 2, vh / 2, vh * 0.3, vw / 2, vh / 2, vh * 0.75)
      g.addColorStop(0, 'rgba(190,30,30,0)')
      g.addColorStop(1, `rgba(190,30,30,${0.16 + 0.14 * pulse})`)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, vw, vh)
    }

    // ── Boss 登场：卷轴题名（屏幕空间）──
    if (this.bossIntroT > 0) {
      const k = 1 - this.bossIntroT / 2.6 // 0→1
      const unroll = Math.min(1, k / 0.22) // 前 22% 展开卷轴
      const fade = k > 0.78 ? 1 - (k - 0.78) / 0.22 : 1
      const cw = 460 * unroll
      const cy = vh * 0.32
      ctx.save()
      ctx.globalAlpha = fade
      // 宣纸卷面
      const paper = ctx.createLinearGradient(0, cy - 44, 0, cy + 44)
      paper.addColorStop(0, '#efe3c4')
      paper.addColorStop(0.5, '#f7efdb')
      paper.addColorStop(1, '#e7d8b4')
      ctx.fillStyle = paper
      ctx.beginPath()
      ctx.roundRect(vw / 2 - cw / 2, cy - 44, cw, 88, 6)
      ctx.fill()
      // 两端轴杆
      for (const side of [-1, 1]) {
        ctx.fillStyle = '#4a3524'
        ctx.beginPath()
        ctx.roundRect(vw / 2 + side * cw / 2 - (side < 0 ? 4 : 10), cy - 52, 14, 104, 7)
        ctx.fill()
      }
      if (unroll > 0.6) {
        // 朱砂题名
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = '#8c2f24'
        ctx.font = 'bold 44px "Kaiti SC", "STKaiti", "KaiTi", serif'
        ctx.fillText(this.bossIntroName, vw / 2, cy - 4)
        ctx.font = '15px "Kaiti SC", "STKaiti", "KaiTi", serif'
        ctx.fillStyle = 'rgba(90,60,30,0.75)'
        ctx.fillText('— 妖 皇 现 身 —', vw / 2, cy + 30)
        ctx.textBaseline = 'alphabetic'
      }
      ctx.restore()
    }

    // ── 小地图（屏幕空间）──
    this.renderMinimap(ctx, vw)
  }

  private renderMinimap(ctx: CanvasRenderingContext2D, vw: number) {
    const mw = 168, mh = 116
    const mx = vw - mw - 12, my = 12
    const sx = mw / WORLD_W, sy = mh / WORLD_H

    ctx.save()
    ctx.fillStyle = 'rgba(8, 12, 10, 0.72)'
    ctx.beginPath()
    ctx.roundRect(mx, my, mw, mh, 8)
    ctx.fill()
    ctx.strokeStyle = 'rgba(150,235,200,0.25)'
    ctx.lineWidth = 1
    ctx.stroke()

    // 区域
    for (const reg of this.regions) {
      ctx.fillStyle = reg.tint.replace(/0\.\d+\)/, '0.5)')
      ctx.beginPath()
      ctx.arc(mx + reg.cx * sx, my + reg.cy * sy, Math.max(3, reg.r * sx), 0, Math.PI * 2)
      ctx.fill()
    }
    // 奇遇点
    for (const prop of this.props) {
      if (!prop.active) continue
      ctx.fillStyle = prop.kind === 'herb' ? '#7ee08a' : prop.kind === 'chest' ? '#f0c878' : '#d8b877'
      ctx.beginPath()
      ctx.arc(mx + prop.pos.x * sx, my + prop.pos.y * sy, prop.kind === 'stele' ? 3 : 2, 0, Math.PI * 2)
      ctx.fill()
    }
    // 玩家
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(mx + this.player.pos.x * sx, my + this.player.pos.y * sy, 3, 0, Math.PI * 2)
    ctx.fill()
    // Boss
    if (!this.bossDead) {
      const boss = this.enemies.find((e) => isBossKind(e.kind) && !e.dead)
      if (boss) {
        const blink = Math.floor(performance.now() / 500) % 2 === 0
        ctx.fillStyle = blink ? '#ff5a3a' : '#ffb03a'
        ctx.beginPath()
        ctx.arc(mx + boss.pos.x * sx, my + boss.pos.y * sy, 3.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.font = '9px "Noto Serif SC", serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    for (const reg of this.regions) {
      ctx.fillText(reg.name, mx + reg.cx * sx, my + reg.cy * sy - reg.r * sx - 3)
    }
    ctx.restore()

    // ── 濒死警示：血量低于三成，四周浮起红雾并随心跳脉动 ──
    // 放在 UI（小地图）之后，避免把地图也染红
    const hpRatio = this.player.hp / this.player.maxHp
    if (hpRatio < 0.32 && !this.ended) {
      const cw = this.canvas.width, ch = this.canvas.height
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 260)
      const depth = (0.32 - hpRatio) / 0.32
      const g = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.3, cw / 2, ch / 2, Math.max(cw, ch) * 0.62)
      g.addColorStop(0, 'rgba(170,25,25,0)')
      g.addColorStop(1, `rgba(150,20,20,${(0.16 + 0.14 * pulse) * (0.45 + 0.55 * depth)})`)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, cw, ch)
    }
  }
}
