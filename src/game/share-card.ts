// ─── 战绩分享卡 · 秘境战报 ───────────────────────────────────────────
// 用 Canvas 手绘而非 DOM 截图：战报要固定尺寸、跨机器一致、且要塞进
// 皮肤包立绘（可能是 pack:// 自定义协议，DOM 截图库同样会撞跨域污染）。
// 手绘还能精确控制字距/留白，排版心理学上更像"卷轴"而非"网页截图"。

import { ENEMY_INFO, REALMS, type PetState } from './data'
import type { DungeonResult } from './dungeon'

const KAI = '"Kaiti SC", "STKaiti", "KaiTi", "Noto Serif SC", "Songti SC", "SimSun", serif'

// 3:4 竖版（社交平台通用分享比例）
const W = 1080
const H = 1440

const INK_DEEP = '#070a09'
const PAPER = '#ece4d0'
const GOLD = '#d3b781'
const GOLD_DIM = 'rgba(211,183,129,0.35)'
const CINNABAR = '#c14b3a'
const JADE = '#8fbfa8'

export interface ShareCardInput {
  pet: PetState
  result: DungeonResult
  portraitUrl: string // 战斗立绘 URL（皮肤包优先，回退内置）
}

/** 加载一张图；失败/超时返回 null（不阻塞出图） */
function loadImage(src: string, timeout = 4000): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    let settled = false
    const done = (value: HTMLImageElement | null) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      resolve(value)
    }
    const timer = window.setTimeout(() => done(null), timeout)
    const img = new Image()
    // 仅 http(s) 需要 CORS；pack:// 自定义协议开 crossOrigin 反而会加载失败
    if (/^https?:/i.test(src)) img.crossOrigin = 'anonymous'
    img.onload = () => done(img)
    img.onerror = () => done(null)
    img.src = src
  })
}

/** 跨域图会污染画布导致 toBlob 抛 SecurityError：先探一下，被污染就换占位符 */
function untainted(img: HTMLImageElement | null): HTMLImageElement | null {
  if (!img) return null
  try {
    const probe = document.createElement('canvas')
    probe.width = 1
    probe.height = 1
    const c = probe.getContext('2d')
    if (!c) return null
    c.drawImage(img, 0, 0, 1, 1)
    c.getImageData(0, 0, 1, 1)
    return img
  } catch {
    return null
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** 朱砂印章（旋转 2°，与 UI 的 .seal 同源视觉） */
function seal(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size = 26) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate((-2 * Math.PI) / 180)
  ctx.font = `${size}px ${KAI}`
  const w = ctx.measureText(text).width + 18
  const h = size + 12
  const grad = ctx.createLinearGradient(0, -h / 2, w, h / 2)
  grad.addColorStop(0, CINNABAR)
  grad.addColorStop(1, '#a03a2c')
  ctx.fillStyle = grad
  roundRect(ctx, -w / 2, -h / 2, w, h, 4)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,236,204,0.28)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = '#ffeccc'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 0, 1)
  ctx.restore()
}

/** 竖向排布的落款（仿卷轴题跋），返回结束 y */
function verticalText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, gap: number) {
  ctx.save()
  ctx.font = `${size}px ${KAI}`
  ctx.fillStyle = 'rgba(236,228,208,0.5)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < text.length; i++) ctx.fillText(text[i], x, y + i * gap)
  ctx.restore()
  return y + text.length * gap
}

const clock = (sec: number) => {
  const s = Math.max(0, Math.floor(sec))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** 绘制战报，返回画布（调用方负责导出） */
export async function drawShareCard({ pet, result, portraitUrl }: ShareCardInput): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建战报画布')
  // 字体就绪再落笔，否则楷体可能回退成默认衬线
  try { await (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready } catch { /* 老浏览器忽略 */ }

  const win = result.victory
  const retreated = !!result.retreated
  const accent = win ? GOLD : retreated ? JADE : CINNABAR
  const title = win ? '秘 境 大 捷' : retreated ? '全 身 而 退' : '重 伤 遁 归'
  const verdict = win
    ? '妖皇授首，宝物入袋'
    : retreated
      ? '见好就收，来日再战'
      : '道基受损，卷土重来'
  const portrait = untainted(await loadImage(portraitUrl))

  // ── 底：墨色 + 顶部主色晕染（胜利金 / 失败朱）──
  ctx.fillStyle = INK_DEEP
  ctx.fillRect(0, 0, W, H)
  const aura = ctx.createRadialGradient(W * 0.5, H * 0.3, 40, W * 0.5, H * 0.3, W * 0.86)
  aura.addColorStop(0, win ? 'rgba(211,183,129,0.20)' : retreated ? 'rgba(143,191,168,0.13)' : 'rgba(193,75,58,0.16)')
  aura.addColorStop(0.55, 'rgba(143,191,168,0.045)')
  aura.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = aura
  ctx.fillRect(0, 0, W, H)

  // 宣纸噪点（极轻，避免死板纯色块）
  ctx.save()
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = `rgba(236,228,208,${Math.random() * 0.035})`
    ctx.fillRect(Math.random() * W, Math.random() * H, 1.4, 1.4)
  }
  ctx.restore()

  // ── 金线回纹外框（双线 + 四角回字）──
  ctx.strokeStyle = GOLD_DIM
  ctx.lineWidth = 2
  ctx.strokeRect(30, 30, W - 60, H - 60)
  ctx.strokeStyle = 'rgba(211,183,129,0.14)'
  ctx.lineWidth = 1
  ctx.strokeRect(42, 42, W - 84, H - 84)
  ctx.strokeStyle = 'rgba(211,183,129,0.5)'
  ctx.lineWidth = 2.5
  const corner = 46
  for (const [cx, cy, sx, sy] of [[42, 42, 1, 1], [W - 42, 42, -1, 1], [42, H - 42, 1, -1], [W - 42, H - 42, -1, -1]] as const) {
    ctx.beginPath()
    ctx.moveTo(cx + sx * corner, cy)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx, cy + sy * corner)
    ctx.stroke()
  }

  // ── 页眉：印章 + 出处 + 日期 ──
  seal(ctx, '战报', 126, 104, 30)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `30px ${KAI}`
  ctx.fillStyle = PAPER
  ctx.fillText('桌面小仙 · 秘境战报', 180, 100)
  ctx.font = `17px ${KAI}`
  ctx.fillStyle = 'rgba(236,228,208,0.42)'
  const date = new Date()
  const stamp = `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`
  ctx.fillText(`${stamp} · ${result.region ?? '荒野灵台'} · 历时 ${clock(result.durationSec ?? 0)}`, 180, 130)
  ctx.strokeStyle = 'rgba(211,183,129,0.2)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(80, 156)
  ctx.lineTo(W - 80, 156)
  ctx.stroke()

  // ── 主视觉：灵玉台 + 战斗立绘 ──
  const heroY = 470
  const halo = ctx.createRadialGradient(W / 2, heroY + 60, 20, W / 2, heroY + 60, 300)
  halo.addColorStop(0, win ? 'rgba(211,183,129,0.34)' : 'rgba(143,191,168,0.2)')
  halo.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.ellipse(W / 2, heroY + 60, 300, 96, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(211,183,129,0.28)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.ellipse(W / 2, heroY + 60, 150, 46, 0, 0, Math.PI * 2)
  ctx.stroke()

  if (portrait) {
    const box = 420
    const ratio = Math.min(box / portrait.width, box / portrait.height)
    const dw = portrait.width * ratio
    const dh = portrait.height * ratio
    ctx.save()
    ctx.globalAlpha = win ? 1 : 0.92
    if (!win) ctx.filter = 'grayscale(0.45) brightness(0.9)'
    ctx.drawImage(portrait, W / 2 - dw / 2, heroY + 60 - dh, dw, dh)
    ctx.restore()
  } else {
    // 立绘不可用时的占位：朱砂圆印 + 名号（不破坏构图）
    ctx.fillStyle = 'rgba(211,183,129,0.1)'
    ctx.beginPath()
    ctx.ellipse(W / 2, heroY - 120, 120, 150, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.font = `120px ${KAI}`
    ctx.fillStyle = GOLD_DIM
    ctx.textAlign = 'center'
    ctx.fillText('仙', W / 2, heroY - 86)
  }

  // ── 头衔：名号 + 境界 ──
  ctx.textAlign = 'center'
  ctx.font = `40px ${KAI}`
  ctx.fillStyle = PAPER
  ctx.fillText(pet.name, W / 2, heroY + 156)
  ctx.font = `19px ${KAI}`
  ctx.fillStyle = 'rgba(211,183,129,0.75)'
  ctx.fillText(`${REALMS[pet.realm] ?? '练气一层'} · 飞剑 +${pet.swordLevel} · 相伴 ${pet.companion?.name ?? '小满'}`, W / 2, heroY + 190)

  // ── 主标题 ──
  ctx.font = `76px ${KAI}`
  ctx.fillStyle = accent
  ctx.shadowColor = win ? 'rgba(211,183,129,0.45)' : 'rgba(193,75,58,0.35)'
  ctx.shadowBlur = 26
  ctx.fillText(title, W / 2, heroY + 292)
  ctx.shadowBlur = 0
  ctx.font = `22px ${KAI}`
  ctx.fillStyle = 'rgba(236,228,208,0.5)'
  ctx.fillText(verdict, W / 2, heroY + 332)

  // ── 核心数字：斩妖（视觉锚点，最大字号）──
  const statY = heroY + 400
  ctx.font = `26px ${KAI}`
  ctx.fillStyle = 'rgba(236,228,208,0.55)'
  ctx.fillText('斩 妖', W / 2 - 210, statY + 4)
  ctx.font = `128px ${KAI}`
  ctx.fillStyle = accent
  ctx.fillText(String(result.kills), W / 2 - 130, statY + 20)
  ctx.font = `26px ${KAI}`
  ctx.fillStyle = 'rgba(236,228,208,0.55)'
  ctx.fillText('头', W / 2 + 130, statY + 4)
  // 最高连击（有才显示，避免零值噪音）
  if ((result.maxCombo ?? 0) >= 3) {
    ctx.font = `22px ${KAI}`
    ctx.fillStyle = 'rgba(211,183,129,0.7)'
    ctx.fillText(`最高 ${result.maxCombo} 连击`, W / 2, statY + 66)
  }
  seal(ctx, win ? '凯旋' : retreated ? '知退' : '惜败', W - 150, statY - 6, 24)

  // ── 掉落三连 ──
  const cardY = statY + 118
  const cardH = 150
  const gap = 22
  const cardW = (W - 160 - gap * 2) / 3
  const loots = [
    { icon: '💎', label: '灵石', value: result.loot.stones, color: '#7ec8f2' },
    { icon: '🌿', label: '灵草', value: result.loot.herbs, color: '#8fd48f' },
    { icon: '⛏', label: '玄铁', value: result.loot.ore, color: '#c9a2f0' },
  ]
  loots.forEach((it, i) => {
    const x = 80 + i * (cardW + gap)
    ctx.fillStyle = 'rgba(13,17,16,0.72)'
    roundRect(ctx, x, cardY, cardW, cardH, 8)
    ctx.fill()
    ctx.strokeStyle = 'rgba(211,183,129,0.2)'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.textAlign = 'center'
    ctx.font = '40px serif'
    ctx.fillText(it.icon, x + cardW / 2, cardY + 54)
    ctx.font = `58px ${KAI}`
    ctx.fillStyle = it.color
    ctx.fillText(String(it.value), x + cardW / 2, cardY + 112)
    ctx.font = `20px ${KAI}`
    ctx.fillStyle = 'rgba(236,228,208,0.45)'
    ctx.fillText(it.label, x + cardW / 2, cardY + 138)
  })

  // ── 法宝（有则高亮，无则省略：不给零值占位）──
  let y = cardY + cardH + 34
  if (result.equip) {
    ctx.fillStyle = 'rgba(211,183,129,0.1)'
    roundRect(ctx, 80, y, W - 160, 104, 8)
    ctx.fill()
    ctx.strokeStyle = 'rgba(211,183,129,0.5)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.textAlign = 'left'
    ctx.font = `34px ${KAI}`
    ctx.fillStyle = GOLD
    ctx.fillText(`✨ 法宝现世 · ${result.equip.icon} ${result.equip.name}`, 116, y + 48)
    ctx.font = `21px ${KAI}`
    ctx.fillStyle = 'rgba(211,183,129,0.62)'
    ctx.fillText(result.equip.desc, 116, y + 82)
    y += 104 + 30
  }

  // ── 妖兽名录 + 内丹 ──
  const byKind = Object.entries(result.killsByKind ?? {}).filter(([, n]) => (n ?? 0) > 0).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
  if (byKind.length > 0) {
    ctx.textAlign = 'left'
    ctx.font = `22px ${KAI}`
    ctx.fillStyle = 'rgba(236,228,208,0.4)'
    ctx.fillText('斩获名录', 80, y + 18)
    y += 46
    ctx.font = `24px ${KAI}`
    byKind.slice(0, 6).forEach(([kind, n], i) => {
      const name = ENEMY_INFO[kind]?.name ?? kind
      const col = i % 2
      const x = 80 + col * 470
      if (col === 0) y += i > 0 ? 42 : 0
      ctx.fillStyle = 'rgba(236,228,208,0.82)'
      ctx.fillText(`${name}`, x, y)
      ctx.fillStyle = GOLD
      ctx.fillText(`× ${n}`, x + 240, y)
    })
    y += 52
  }
  const neidan = Object.entries(result.neidan ?? {}).filter(([, n]) => (n ?? 0) > 0)
  if (neidan.length > 0) {
    ctx.textAlign = 'left'
    ctx.font = `22px ${KAI}`
    ctx.fillStyle = 'rgba(236,228,208,0.82)'
    const parts = neidan.map(([k, n]) => `${ENEMY_INFO[k]?.name ?? k}内丹 ×${n}`)
    ctx.fillText(`🟣 ${parts.join('　·　')}`, 80, y)
    y += 42
  }

  // ── 页脚：题跋 + 落款 ──
  ctx.strokeStyle = 'rgba(211,183,129,0.18)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(80, H - 150)
  ctx.lineTo(W - 80, H - 150)
  ctx.stroke()
  ctx.textAlign = 'left'
  ctx.font = `24px ${KAI}`
  ctx.fillStyle = 'rgba(236,228,208,0.45)'
  const summary = win
    ? '一剑霜寒，妖氛尽扫。此战之功，当记一功。'
    : retreated
      ? '知止不殆，全身而退亦是修行。'
      : '胜败乃兵家常事，养足精神再走一遭。'
  ctx.fillText(summary, 80, H - 104)
  ctx.font = `19px ${KAI}`
  ctx.fillStyle = 'rgba(236,228,208,0.28)'
  ctx.fillText(`累计斩妖 ${pet.kills} · 大捷 ${pet.victories} 场`, 80, H - 68)
  verticalText(ctx, '桌面小仙', W - 110, H - 300, 26, 32)
  seal(ctx, '仙', W - 110, H - 120, 30)

  return canvas
}

/** 画布 → PNG Blob */
function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('战报导出失败'))), 'image/png')
  })
}

/** 保存战报到本地（Electron 下走下载目录） */
export async function saveShareCard(input: ShareCardInput): Promise<void> {
  const canvas = await drawShareCard(input)
  const blob = await toBlob(canvas)
  const url = URL.createObjectURL(blob)
  const d = new Date()
  const name = `秘境战报-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${input.result.kills}斩.png`
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** 复制战报到剪贴板（不支持时返回 false，调用方降级为保存） */
export async function copyShareCard(input: ShareCardInput): Promise<boolean> {
  const canvas = await drawShareCard(input)
  const blob = await toBlob(canvas)
  const Ctor = (window as unknown as { ClipboardItem?: new (items: Record<string, Blob>) => ClipboardItem }).ClipboardItem
  if (!Ctor || !navigator.clipboard?.write) return false
  try {
    await navigator.clipboard.write([new Ctor({ 'image/png': blob })])
    return true
  } catch {
    return false
  }
}

/** 生成预览用的 data URL（结算面板里先看后存） */
export async function previewShareCard(input: ShareCardInput): Promise<string> {
  const canvas = await drawShareCard(input)
  return canvas.toDataURL('image/png')
}
