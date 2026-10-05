// ─── 动作/皮肤资源包运行时 ─────────────────────────────────────────
// 包 = manifest.json + 若干图片/音频。内置包随应用打包；用户包放在
// %APPDATA%/xiuxian-pet/packs/<包id>/ 下热加载。
// manifest 的 kind 预留 'spine'：后期接 Spine/DragonBones 运行时做连招，
// 与 webp 帧包并存，互不冲突。

import { desktop } from '../lib/desktop-bridge'
import studyAFUrl from '../assets/pet-study-a.webp'
import studyBFUrl from '../assets/pet-study-b.webp'
import studyAMUrl from '../assets/pet-m-study-a.webp'
import studyBMUrl from '../assets/pet-m-study-b.webp'
import skinFoxIdleUrl from '../assets/skin-fox-idle.webp'
import skinFoxOpenUrl from '../assets/skin-fox-open.webp'
import skinFoxBattleUrl from '../assets/skin-fox-battle.webp'
import skinFoxBattleBlinkUrl from '../assets/skin-fox-battle-blink.webp'

export interface PackManifest {
  id: string
  name: string
  kind: 'action' | 'skin' | 'spine' // spine：预留（连招/骨骼动画）
  action?: string // action 包：触发它的 recentAction key
  frames?: string[] // 帧文件名（用户包）或打包资源 URL（内置包）；skin 包用 poses 而非 frames
  framesM?: string[] // 男相帧（缺省时男女共用 frames）
  poses?: Record<string, string> // skin 包：姿态 key → 帧文件（idle/idleOpen/eat/eatB/bathe/batheB/meditate/meditateB/sleep/danceA/danceB/grab/grabB；副本战斗另支持 battle/battleBlink）
  fps?: number // 帧切换频率，默认 1.8
  breathe?: number // 呼吸幅度 0~0.05，默认 0.015
  sway?: number // 身体摇摆幅度（弧度），默认 0
  aura?: string // 灵氲光环颜色 'r,g,b'
  motes?: number // 环绕灵气微粒数，默认 0
  rise?: boolean // 灵气升腾
  text?: string // 飘字
}

export interface LoadedPack extends PackManifest {
  resolve: (file: string) => string // 帧文件名 → 可加载 URL
}

const byAction = new Map<string, LoadedPack>()
const skins = new Map<string, LoadedPack>()

/** 注册一个包。resolve 把帧文件名映射为 URL。 */
export function registerPack(manifest: PackManifest, resolve: (file: string) => string) {
  if (!manifest.id) return
  const isSkin = manifest.kind === 'skin'
  if (!isSkin && (!Array.isArray(manifest.frames) || manifest.frames.length === 0)) return
  if (isSkin && (!manifest.poses || Object.keys(manifest.poses).length === 0)) return
  const pack: LoadedPack = { fps: 1.8, breathe: 0.015, sway: 0, motes: 0, frames: [], ...manifest, resolve }
  if (pack.kind === 'action' && pack.action) byAction.set(pack.action, pack)
  if (pack.kind === 'skin') skins.set(pack.id, pack)
}

/** 按 recentAction key 查包。 */
export function packForAction(act: string | null | undefined): LoadedPack | undefined {
  return act ? byAction.get(act) : undefined
}

/** 全部皮肤包（形象阁 UI 用）。 */
export function getSkinPacks(): LoadedPack[] {
  return [...skins.values()]
}

/** 皮肤姿态查询：返回包与帧文件名；无此姿态返回 null（调用方回退内置立绘）。 */
export function skinPoseFile(id: string, baseKey: string): { pack: LoadedPack; file: string } | null {
  const pack = skins.get(id)
  const file = pack?.poses?.[baseKey]
  return pack && file ? { pack, file } : null
}

/** 内置包帧的 URL 直查（registerBuiltin 用）。 */
const builtin = (url: string) => url

// ── 内置示范包：研读《无相剑典》──
registerPack(
  {
    id: 'miji-wuxiang',
    name: '研读 · 无相剑典',
    kind: 'action',
    action: 'study-wuxiang',
    frames: [studyAFUrl, studyBFUrl],
    framesM: [studyAMUrl, studyBMUrl],
    fps: 1.6,
    breathe: 0.015,
    sway: 0.012,
    aura: '150,235,200',
    motes: 12,
    rise: true,
    text: '剑意通透……',
  },
  builtin,
)

// ── 内置示范皮肤：小狐仙（待机两帧 + 副本战斗两帧，其余姿态自动回退默认立绘）──
registerPack(
  {
    id: 'skin-huli',
    name: '小狐仙',
    kind: 'skin',
    frames: [],
    poses: {
      idle: skinFoxIdleUrl,
      idleOpen: skinFoxOpenUrl,
      battle: skinFoxBattleUrl,
      battleBlink: skinFoxBattleBlinkUrl,
    },
  },
  builtin,
)

let userPacksLoaded = false
/** 扫描并注册桌面端用户包（浏览器预览时为空）。幂等。 */
export async function loadUserPacks(): Promise<void> {
  if (userPacksLoaded) return
  userPacksLoaded = true
  if (!desktop) return
  try {
    const list = await desktop.listPacks()
    for (const raw of list) {
      const m = raw as PackManifest
      if (!m || typeof m.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(m.id)) continue
      const id = m.id
      registerPack(m, (file) => `pack://${id}/${file}`)
    }
  } catch (err) {
    console.warn('[packs] 用户包加载失败', err)
  }
}
