import { forwardRef, useCallback, useEffect, useRef, type MutableRefObject } from 'react'
import type { PetState } from './data'
import { getLook, type Look } from './looks'
import { packForAction, skinPoseFile, type LoadedPack } from './packs'
import idleUrl from '../assets/pet-idle.webp'
import meditateUrl from '../assets/pet-meditate.webp'
import idleMUrl from '../assets/pet-m-idle.webp'
import meditateMUrl from '../assets/pet-m-meditate.webp'
import eatUrl from '../assets/pet-eat.webp'
import batheUrl from '../assets/pet-bathe.webp'
import eatMUrl from '../assets/pet-m-eat.webp'
import batheMUrl from '../assets/pet-m-bathe.webp'
import danceAUrl from '../assets/pet-dance-a.webp'
import danceBUrl from '../assets/pet-dance-b.webp'
import danceAMUrl from '../assets/pet-m-dance-a.webp'
import danceBMUrl from '../assets/pet-m-dance-b.webp'
import idleOpenUrl from '../assets/pet-idle-open.webp'
import idleOpenMUrl from '../assets/pet-m-idle-open.webp'
import sleepUrl from '../assets/pet-sleep.webp'
import sleepMUrl from '../assets/pet-m-sleep.webp'
import eatBUrl from '../assets/pet-eat-b.webp'
import eatBMUrl from '../assets/pet-m-eat-b.webp'
import batheBUrl from '../assets/pet-bathe-b.webp'
import batheBMUrl from '../assets/pet-m-bathe-b.webp'
import meditateBUrl from '../assets/pet-meditate-b.webp'
import meditateBMUrl from '../assets/pet-m-meditate-b.webp'
import grabUrl from '../assets/pet-grab.webp'
import grabMUrl from '../assets/pet-m-grab.webp'
import grabBUrl from '../assets/pet-grab-b.webp'
import grabBMUrl from '../assets/pet-m-grab-b.webp'
import fruitUrl from '../assets/pet-fruit.webp'
import fruitMUrl from '../assets/pet-m-fruit.webp'
import brewUrl from '../assets/pet-brew.webp'
import brewMUrl from '../assets/pet-m-brew.webp'
import forgeUrl from '../assets/pet-forge.webp'
import forgeMUrl from '../assets/pet-m-forge.webp'
import cosWingsUrl from '../assets/cos-wings.webp'
import cosMountFoxUrl from '../assets/cos-mount-fox.webp'
import cosMountTurtleUrl from '../assets/cos-mount-turtle.webp'
import cosWingsGuUrl from '../assets/cos-wings-gu.webp'
import cosMountSilkwormUrl from '../assets/cos-mount-silkworm.webp'
import propUmbrellaUrl from '../assets/prop-umbrella.webp'
import propSnowmanUrl from '../assets/prop-snowman.webp'

const assetUrls: Record<string, string> = {
  idle: idleUrl, idleM: idleMUrl, meditate: meditateUrl, meditateM: meditateMUrl,
  eat: eatUrl, eatM: eatMUrl, bathe: batheUrl, batheM: batheMUrl,
  danceA: danceAUrl, danceB: danceBUrl, danceAM: danceAMUrl, danceBM: danceBMUrl,
  idleOpen: idleOpenUrl, idleOpenM: idleOpenMUrl, sleep: sleepUrl, sleepM: sleepMUrl,
  eatB: eatBUrl, eatBM: eatBMUrl, batheB: batheBUrl, batheBM: batheBMUrl,
  meditateB: meditateBUrl, meditateBM: meditateBMUrl, grab: grabUrl, grabM: grabMUrl,
  grabB: grabBUrl, grabBM: grabBMUrl, fruit: fruitUrl, fruitM: fruitMUrl,
  brew: brewUrl, brewM: brewMUrl, forge: forgeUrl, forgeM: forgeMUrl,
  wings: cosWingsUrl, wingsGu: cosWingsGuUrl, mountFox: cosMountFoxUrl,
  mountTurtle: cosMountTurtleUrl, mountSilkworm: cosMountSilkwormUrl,
  umbrella: propUmbrellaUrl, snowman: propSnowmanUrl,
}
const imageCache = new Map<string, Promise<HTMLImageElement>>()
// 资源包帧的动态 URL 表（key 形如 pack:<id>:<f|m>:<i>）
const dynamicUrls = new Map<string, string>()
export function registerPackImage(key: string, url: string) {
  if (!dynamicUrls.has(key)) dynamicUrls.set(key, url)
}
// 预览/调试：URL 带 ?dance=1 可强制起舞（桌面端由系统音乐侦测触发）
// ?act=feed|bathe 强制播动作立绘；?sleepy=1 强制深夜打盹（截图目检用）
const DEBUG_PARAMS = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
const FORCE_DANCE = DEBUG_PARAMS.has('dance')
const FORCE_ACT = DEBUG_PARAMS.get('act')
const FORCE_SLEEPY = DEBUG_PARAMS.has('sleepy')
const FORCE_GRAB = DEBUG_PARAMS.has('grab') // ?grab=1 预览被拎起挣扎帧
const FORCE_SKIN = DEBUG_PARAMS.get('skin') // ?skin=<id> 预览皮肤包形象
function loadImage(key: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(key)
  if (cached) return cached
  const src = assetUrls[key] ?? dynamicUrls.get(key)
  if (!src) return Promise.reject(new Error(`未知小仙图片：${key}`))
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`小仙图片加载失败：${key}`))
    image.src = src
  })
  imageCache.set(key, pending)
  void pending.catch(() => imageCache.delete(key))
  return pending
}

// 小修士 Canvas 动画：AI 形象 + 待机浮动 / 闭关灵气 / 心情特效 / 随机小动作 / 赌气背身
// 喂食/洗澡有专属动作立绘（AI 生成）；ref 暴露画布供像素级悬浮命中
const PetCanvas = forwardRef<
  HTMLCanvasElement,
  {
    pet: PetState
    recentAction: string | null
    interactRef?: MutableRefObject<number>
    dancing?: boolean
    bpm?: number // 起舞速度（拍/分钟）；节拍相位由它驱动
    look?: string | null // 换装配色 id
    grabbed?: boolean // 正被鼠标拎着拖动
    dragVecRef?: MutableRefObject<{ x: number; y: number }> // 拖拽瞬时位移（惯性倾斜用）
    weather?: 'rain' | 'snow' | null
    onReady?: () => void
    onError?: (message: string) => void
  }
>(function PetCanvas({ pet, recentAction, interactRef, dancing, bpm, look, grabbed, dragVecRef, weather, onReady, onError }, outerRef) {
  const innerRef = useRef<HTMLCanvasElement>(null)
  const setCanvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    innerRef.current = canvas
    if (typeof outerRef === 'function') return outerRef(canvas)
    if (outerRef) outerRef.current = canvas
  }, [outerRef])
  const petRef = useRef(pet)
  const actRef = useRef(recentAction)
  const danceRef = useRef(!!dancing)
  const bpmRef = useRef(bpm ?? 110)
  const lookRef = useRef<Look | null>(getLook(look))
  const grabbedRef = useRef(!!grabbed)
  const dragVecPropRef = useRef(dragVecRef)
  const weatherRef = useRef(weather ?? null)
  const callbacksRef = useRef({ onReady, onError })
  useEffect(() => {
    petRef.current = pet
    actRef.current = recentAction
    danceRef.current = !!dancing
    bpmRef.current = bpm ?? 110
    lookRef.current = getLook(look)
    grabbedRef.current = !!grabbed
    dragVecPropRef.current = dragVecRef
    weatherRef.current = weather ?? null
    callbacksRef.current = { onReady, onError }
  }, [pet, recentAction, dancing, bpm, look, grabbed, dragVecRef, weather, onReady, onError])

  // 换装染色：filter 改色相/饱和度（保留明暗），再叠一层半透明色定调。
  // 结果按「图源 + 配色」缓存——每帧重新染色会白白吃掉 GPU。
  const lookCache = useRef(new Map<string, HTMLCanvasElement>())
  const lookImage = (img: HTMLImageElement): HTMLCanvasElement | HTMLImageElement => {
    const lk = lookRef.current
    if (!lk || !lk.alpha && !lk.filter) return img
    const key = `${img.src}|${lk.id}`
    const hit = lookCache.current.get(key)
    if (hit) return hit
    const off = document.createElement('canvas')
    off.width = img.naturalWidth || img.width
    off.height = img.naturalHeight || img.height
    const c = off.getContext('2d')
    if (!c || !off.width || !off.height) return img
    if (lk.filter) c.filter = lk.filter
    c.drawImage(img, 0, 0)
    c.filter = 'none'
    c.globalCompositeOperation = 'source-atop'
    c.globalAlpha = lk.alpha
    c.fillStyle = lk.tint
    c.fillRect(0, 0, off.width, off.height)
    if (lookCache.current.size > 160) lookCache.current.clear() // 兜底：图源×配色是有限的
    lookCache.current.set(key, off)
    return off
  }

  useEffect(() => {
    const canvas = innerRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) {
      callbacksRef.current.onError?.('无法创建桌宠画布，请重新打开软件。')
      return
    }
    let raf = 0
    let lastFrame = 0
    const W = (canvas.width = 340)
    const H = (canvas.height = 340)
    const start = performance.now()

    // 随机小动作状态机：yawn 打哈欠 / hum 哼曲 / stretch 伸懒腰 / happy 被理睬后的开心
    const emote = { kind: '', until: 0, nextAt: Date.now() + 5000 + Math.random() * 4000 }
    let lastInteract = interactRef?.current ?? Date.now()
    // 眨眼调度：每 2~5 秒眨一次（140ms），12% 概率补一个双眼皮
    const blink = { until: 0, nextAt: Date.now() + 1800 + Math.random() * 2500 }
    // 姿态帧间交叉淡化：记录上一帧姿态与切换时刻
    let poseKey = ''
    let prevPoseKey = ''
    let poseSwitchAt = -10
    // 松手落地回弹：记录上一帧是否被拎着、落地时刻与松手瞬间的拖拽速度（惯性回摆用）
    let wasGrabbing = false
    let landAt = -10
    let releaseVec = { x: 0, y: 0 }
    let tiltSmooth = 0 // 拖拽惯性倾斜的平滑值（指针事件有抖动，插值后才丝滑）

    let alive = true
    let reportedReady = false
    let loadError = ''
    const imgs: Record<string, HTMLImageElement> = {}
    const ready: Record<string, boolean> = {}
    const requested = new Set<string>()
    const requestImage = (key: string) => {
      if (requested.has(key)) return
      requested.add(key)
      void loadImage(key).then((image) => {
        if (!alive) return
        imgs[key] = image
        ready[key] = true
      }).catch((error: Error) => {
        if (!alive) return
        if (key === (petRef.current.gender === 'male' ? 'idleM' : 'idle')) {
          loadError = error.message
          console.error('[pet-assets]', loadError)
          callbacksRef.current.onError?.(loadError)
        } else {
          console.warn('[pet-assets]', error.message)
        }
      })
    }
    requestImage(petRef.current.gender === 'male' ? 'idleM' : 'idle')

    // 首屏只等待机一张图；当前性别的动作立绘（吐纳/吃饭/泡澡）闲时预取，首次互动零等待
    const idleWin: ((cb: () => void) => number) | undefined = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback
    const prefetchCore = () => {
      const male0 = petRef.current.gender === 'male'
      for (const key of male0
        ? ['meditateM', 'meditateBM', 'eatM', 'eatBM', 'batheM', 'batheBM', 'danceAM', 'danceBM', 'idleOpenM', 'sleepM', 'grabM', 'grabBM', 'fruitM', 'brewM', 'forgeM']
        : ['meditate', 'meditateB', 'eat', 'eatB', 'bathe', 'batheB', 'danceA', 'danceB', 'idleOpen', 'sleep', 'grab', 'grabB', 'fruit', 'brew', 'forge']) requestImage(key)
    }
    if (idleWin) idleWin(prefetchCore)
    else window.setTimeout(prefetchCore, 1500)

    const drawFrame = (now: number) => {
      // 帧率 ~60fps：动作丝滑优先（立绘均为 webp 贴图，GPU 合成开销小）
      if (now - lastFrame < 15) {
        raf = requestAnimationFrame(draw)
        return
      }
      lastFrame = now
      const t = (now - start) / 1000
      const p = petRef.current
      const act = FORCE_ACT ?? actRef.current
      const pack: LoadedPack | undefined = packForAction(act) // 资源包动作（用户包/内置示范包）
      ctx.clearRect(0, 0, W, H)

      const cx = W / 2
      const groundY = H - 76 // 留足底部余量：立绘下沉 + 灵玉台椭圆不再被画布裁掉
      const acting = act === 'feed' || act === 'bathe' || act === 'feed-fruit' || act === 'brew' || act === 'forge' || !!pack // 播专属动作立绘/资源包动作
      const grabbing = grabbedRef.current || FORCE_GRAB // 正被鼠标拎着拖动
      if (wasGrabbing && !grabbing) {
        landAt = t // 松手瞬间：落地回弹计时
        releaseVec = { ...(dragVecPropRef.current?.current ?? { x: 0, y: 0 }) }
      }
      wasGrabbing = grabbing
      const landK = grabbing ? 1 : (t - landAt) / 0.6 // 0→1 落地回弹进度（≥1 结束）
      if (!grabbing) tiltSmooth *= 0.86 // 松手后倾斜平滑回正
      const meditating = p.secluding || act === 'meditate' || p.focus?.phase === 'focus'
      const dancing = (danceRef.current || FORCE_DANCE) && !meditating && !acting && !grabbing
      // 节拍器：拍速由 BPM 驱动（默认 110），舞姿帧按拍切换（跳舞全程共用）
      const beat = t * (bpmRef.current / 60)
      const beatPhase = beat % 1
      const danceFrame = Math.floor(beat) % 2 === 0
      // 作息：深夜（23-6 点）犯困打盹
      const hour = new Date().getHours()
      const sleepy = FORCE_SLEEPY || (!meditating && !dancing && !acting && (hour >= 23 || hour < 6))
      const float = grabbing
        ? 0 // 被拎着时不再漂浮
        : acting
          ? Math.sin(t * 2.4) * 1.5 // 吃饭泡澡时只是轻轻晃动
          : Math.sin(t * (sleepy ? 0.9 : 1.8)) * (meditating ? 2.5 : sleepy ? 2 : 5)
      const cy = groundY + float

      // ── 活感：赌气判定 + 随机小动作调度（统一用 Date.now 时基）──
      const wall = Date.now()
      const lastTouch = interactRef?.current ?? wall
      const sulking = !acting && !meditating && !dancing && !sleepy && wall - lastTouch > 90_000
      if (lastTouch !== lastInteract) {
        const wasSulking = wall - lastInteract > 90_000
        lastInteract = lastTouch
        if (wasSulking) {
          emote.kind = 'happy'
          emote.until = wall + 1500
        }
      }
      if (!meditating && !sulking && !dancing && !acting && wall > emote.nextAt) {
        const kinds = sleepy ? ['yawn'] : ['yawn', 'hum', 'stretch']
        emote.kind = kinds[Math.floor(Math.random() * kinds.length)]
        emote.until = wall + 2400
        emote.nextAt = wall + (sleepy ? 5000 : 9000) + Math.random() * 8000
      }
      if (wall > emote.until) emote.kind = ''
      const emoting = emote.kind

      // 眨眼调度：待机/赌气/开心时随机眨眼；动作/跳舞/打坐/打盹/被拎着时另有安排
      const blinkable = !acting && !dancing && !meditating && !sleepy && !grabbedRef.current
      if (blinkable && wall > blink.nextAt) {
        blink.until = wall + 140
        blink.nextAt = wall + 2200 + Math.random() * 2800
        if (Math.random() < 0.12) blink.nextAt = wall + 300 // 双眼皮：紧接着再眨一下
      }
      const blinking = blinkable && wall < blink.until

      // 地面灵玉台
      ctx.save()
      ctx.fillStyle = 'rgba(120, 200, 170, 0.06)'
      ctx.beginPath()
      ctx.ellipse(cx, groundY + 42, 120, 22, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(140, 220, 190, 0.25)'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.strokeStyle = 'rgba(140, 220, 190, 0.12)'
      for (let i = 0; i < 3; i++) {
        ctx.beginPath()
        ctx.ellipse(cx, groundY + 42, 100 - i * 22, 18 - i * 4, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.restore()

      // 影子（随浮动缩放）
      const shScale = 1 - (float + 5) / 40
      ctx.fillStyle = `rgba(0,0,0,${0.3 * shScale})`
      ctx.beginPath()
      ctx.ellipse(cx, groundY + 38, 46 * shScale, 10 * shScale, 0, 0, Math.PI * 2)
      ctx.fill()

      // ── 氛围灵气微粒：常驻绕身漂浮的仙尘，打坐/专注时更密更亮 ──
      {
        const moteN = meditating ? 16 : 8
        const baseA = meditating ? 0.5 : 0.22
        for (let i = 0; i < moteN; i++) {
          const seed = i * 2.399 // 黄金角散布
          const orbit = 62 + (i % 4) * 14 + Math.sin(t * 0.7 + seed) * 8
          const a = t * (0.25 + (i % 3) * 0.08) + seed
          const mx = cx + Math.cos(a) * orbit
          const my = cy - 44 + Math.sin(a * 1.3) * 52 - (i % 5) * 8
          const tw = 0.5 + 0.5 * Math.sin(t * 2.2 + seed * 3) // 呼吸闪烁
          ctx.fillStyle = meditating
            ? `rgba(150,235,200,${baseA * tw})`
            : `rgba(215,238,200,${baseA * tw})`
          ctx.beginPath()
          ctx.arc(mx, my, 1.4 + (i % 3) * 0.6, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // 闭关灵气漩涡 + 光柱
      if (p.secluding) {
        for (let i = 0; i < 14; i++) {
          const a = t * 1.6 + (i / 14) * Math.PI * 2
          const r = 78 + Math.sin(t * 3 + i) * 10
          const y = cy - 30 + Math.sin(a * 2) * 46
          ctx.fillStyle = `rgba(150, 235, 200, ${0.25 + 0.2 * Math.sin(t * 4 + i)})`
          ctx.beginPath()
          ctx.arc(cx + Math.cos(a) * r, y, 2.5, 0, Math.PI * 2)
          ctx.fill()
        }
        const grad = ctx.createLinearGradient(0, 0, 0, groundY)
        grad.addColorStop(0, 'rgba(150,235,200,0)')
        grad.addColorStop(1, 'rgba(150,235,200,0.10)')
        ctx.fillStyle = grad
        ctx.fillRect(cx - 46, 10, 92, groundY - 10)
      }

      // 喂食特效：金色灵气 + 米粒飞溅 + 爱心 + 「真香」
      if (act === 'feed') {
        for (let i = 0; i < 10; i++) {
          const px = cx + Math.sin(t * 2 + i * 2.4) * 62
          const py = cy - 80 + Math.cos(t * 1.5 + i) * 36
          ctx.fillStyle = `rgba(240, 200, 120, ${0.35 + 0.25 * Math.sin(t * 3 + i)})`
          ctx.beginPath()
          ctx.arc(px, py, 3, 0, Math.PI * 2)
          ctx.fill()
        }
        // 爱心随咀嚼节奏冒出
        for (let i = 0; i < 3; i++) {
          const hp = (t * 0.8 + i * 0.33) % 1 // 升腾相位
          const side = i % 2 === 0 ? 1 : -1
          ctx.globalAlpha = Math.sin(hp * Math.PI) * 0.9
          ctx.font = `${12 + Math.round(hp * 6)}px serif`
          ctx.fillText('💗', cx + side * (56 + i * 10) + Math.sin(t * 2.5 + i) * 6, cy - 88 - hp * 66)
        }
        ctx.globalAlpha = 1
        // 饭粒碎屑从嘴角蹦出
        for (let i = 0; i < 5; i++) {
          const cp = (t * 1.6 + i * 0.2) % 1
          ctx.fillStyle = `rgba(250,240,210,${0.8 * (1 - cp)})`
          ctx.beginPath()
          ctx.arc(cx + 20 + cp * (26 + i * 7), cy - 46 - Math.sin(cp * Math.PI) * (14 + i * 3), 1.6, 0, Math.PI * 2)
          ctx.fill()
        }
        // 热气腾腾的灵米饭
        ctx.font = '15px serif'
        ctx.fillText('🍚', cx - 78 + Math.sin(t * 2) * 3, cy - 96)
        ctx.font = '12px serif'
        ctx.fillStyle = 'rgba(240,220,170,0.85)'
        ctx.fillText('啊呜啊呜……', cx + 56, cy - 116 + Math.sin(t * 4) * 3)
      }
      // 洗澡特效：气泡上升破裂 + 水花飞溅 + 蒸汽氤氲
      if (act === 'bathe') {
        for (let i = 0; i < 12; i++) {
          const rise = ((t * 46 + i * 25) % 150)
          const bx = cx - 66 + i * 13 + Math.sin(t * 2 + i) * 7
          const by = groundY - 4 - rise
          if (rise > 132) {
            // 升到顶部破裂成小环
            const pop = (rise - 132) / 18
            ctx.strokeStyle = `rgba(170, 225, 255, ${0.5 * (1 - pop)})`
            ctx.lineWidth = 1.2
            ctx.beginPath()
            ctx.arc(bx, by, 3 + pop * 7, 0, Math.PI * 2)
            ctx.stroke()
          } else {
            ctx.strokeStyle = `rgba(160, 220, 255, ${0.65 - rise / 230})`
            ctx.lineWidth = 1.5
            ctx.beginPath()
            ctx.arc(bx, by, 4 + (i % 3) + Math.sin(t * 3 + i) * 0.8, 0, Math.PI * 2)
            ctx.stroke()
          }
        }
        // 泼水水滴：抛物线飞溅
        for (let i = 0; i < 6; i++) {
          const dp = (t * 1.1 + i * 0.17) % 1
          const dir = i % 2 === 0 ? 1 : -1
          const dx = dir * (30 + i * 9) * dp
          const dyy = -Math.sin(dp * Math.PI) * (30 + (i % 3) * 12)
          ctx.fillStyle = `rgba(170, 225, 255, ${0.75 * (1 - dp)})`
          ctx.beginPath()
          ctx.arc(cx + dx * 0.9, cy - 30 + dyy, 1.8 + (i % 2), 0, Math.PI * 2)
          ctx.fill()
        }
        // 蒸汽袅袅
        for (let i = 0; i < 3; i++) {
          const rise = ((t * 20 + i * 40) % 110)
          ctx.globalAlpha = Math.max(0, 0.5 - rise / 240)
          ctx.font = `${15 + i * 3}px serif`
          ctx.fillText('♨️', cx - 60 + i * 52 + Math.sin(t * 1.4 + i) * 6, cy - 96 - rise)
          ctx.globalAlpha = 1
        }
      }
      // 喂灵果特效：粉色灵氲缭绕 + 桃香爱心 + 灵气光点
      if (act === 'feed-fruit') {
        // 粉色灵氲光环
        const glow = ctx.createRadialGradient(cx, cy - 50, 10, cx, cy - 50, 110)
        glow.addColorStop(0, `rgba(255,170,200,${0.2 + 0.08 * Math.sin(t * 2.6)})`)
        glow.addColorStop(1, 'rgba(255,170,200,0)')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(cx, cy - 50, 110, 0, Math.PI * 2)
        ctx.fill()
        // 桃香爱心随啃食节奏冒出
        for (let i = 0; i < 3; i++) {
          const hp = (t * 0.9 + i * 0.33) % 1
          const side = i % 2 === 0 ? 1 : -1
          ctx.globalAlpha = Math.sin(hp * Math.PI) * 0.9
          ctx.font = `${12 + Math.round(hp * 6)}px serif`
          ctx.fillText('💗', cx + side * (52 + i * 12) + Math.sin(t * 2.5 + i) * 6, cy - 92 - hp * 60)
        }
        ctx.globalAlpha = 1
        // 灵果碎屑金光
        for (let i = 0; i < 6; i++) {
          const cp = (t * 1.4 + i * 0.17) % 1
          ctx.fillStyle = `rgba(255,205,150,${0.8 * (1 - cp)})`
          ctx.beginPath()
          ctx.arc(cx + 16 + cp * (24 + i * 8), cy - 44 - Math.sin(cp * Math.PI) * (12 + i * 4), 1.6, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.font = '12px serif'
        ctx.fillStyle = 'rgba(255,205,220,0.9)'
        ctx.fillText('灵果好甜～', cx + 54, cy - 118 + Math.sin(t * 4) * 3)
      }
      // 炼丹特效：金丹气螺旋升腾 + 丹成闪光 + 青烟
      if (act === 'brew') {
        // 丹气螺旋
        for (let i = 0; i < 10; i++) {
          const rise = ((t * 34 + i * 19) % 130)
          const swirl = Math.sin(t * 2.2 + i * 1.3) * (10 + rise * 0.12)
          ctx.fillStyle = `rgba(240,200,110,${0.65 - rise / 200})`
          ctx.beginPath()
          ctx.arc(cx + 44 + swirl, groundY - 20 - rise, 2 + (i % 3) * 0.7, 0, Math.PI * 2)
          ctx.fill()
        }
        // 青烟袅袅
        for (let i = 0; i < 2; i++) {
          const rise = ((t * 16 + i * 52) % 104)
          ctx.globalAlpha = Math.max(0, 0.4 - rise / 260)
          ctx.font = `${16 + i * 4}px serif`
          ctx.fillText('☁️', cx - 72 + i * 30 + Math.sin(t * 1.2 + i) * 8, cy - 100 - rise)
          ctx.globalAlpha = 1
        }
        // 丹成一闪（每 2.2 秒一轮金光）
        const flash = Math.max(0, Math.sin(t * Math.PI * 0.9))
        if (flash > 0.86) {
          ctx.font = '16px serif'
          ctx.globalAlpha = (flash - 0.86) / 0.14
          ctx.fillText('✨', cx + 66, cy - 108)
          ctx.fillText('✨', cx - 84, cy - 84)
          ctx.globalAlpha = 1
        }
        ctx.font = '12px serif'
        ctx.fillStyle = 'rgba(240,215,150,0.85)'
        ctx.fillText('青烟袅袅，丹香四溢……', cx + 48, cy - 126 + Math.sin(t * 3) * 3)
      }
      // 炼器特效：抡锤火星四溅（2.2Hz 落锤节拍）+ 铁花热浪
      if (act === 'forge') {
        const hitPh = (t * 2.2) % 1 // 落锤相位
        const striking = hitPh < 0.18 // 落锤瞬间
        if (striking) {
          const sp = hitPh / 0.18
          for (let i = 0; i < 8; i++) {
            const a = -Math.PI * 0.85 + (i / 7) * Math.PI * 0.7
            const dist = 12 + sp * (26 + (i % 3) * 10)
            ctx.fillStyle = `rgba(255,${170 + (i % 2) * 50},80,${0.9 * (1 - sp)})`
            ctx.beginPath()
            ctx.arc(cx + 46 + Math.cos(a) * dist, cy - 18 + Math.sin(a) * dist * 0.6, 1.8 + (i % 2), 0, Math.PI * 2)
            ctx.fill()
          }
          // 落锤冲击环
          ctx.strokeStyle = `rgba(255,190,110,${0.6 * (1 - sp)})`
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.ellipse(cx + 46, cy - 14, 14 + sp * 30, (14 + sp * 30) * 0.3, 0, 0, Math.PI * 2)
          ctx.stroke()
        }
        // 炉火热浪起伏
        ctx.font = '15px serif'
        ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 5)
        ctx.fillText('🔥', cx + 58, cy - 6 + Math.sin(t * 6) * 2)
        ctx.globalAlpha = 1
        ctx.font = '12px serif'
        ctx.fillStyle = 'rgba(255,200,140,0.9)'
        ctx.fillText(striking ? '铿！' : '呼……呼……', cx + 62, cy - 110 + Math.sin(t * 4) * 2)
      }
      // ── 资源包通用特效：灵氲光环 + 环绕微粒 + 灵气升腾 + 飘字（全部由 manifest 参数驱动）──
      if (pack) {
        const auraRgb = pack.aura ?? lookRef.current?.aura ?? '150,235,200'
        if (pack.aura) {
          const glow = ctx.createRadialGradient(cx, cy - 50, 12, cx, cy - 50, 112)
          glow.addColorStop(0, `rgba(${auraRgb},${0.18 + 0.07 * Math.sin(t * 2.4)})`)
          glow.addColorStop(1, `rgba(${auraRgb},0)`)
          ctx.fillStyle = glow
          ctx.beginPath()
          ctx.arc(cx, cy - 50, 112, 0, Math.PI * 2)
          ctx.fill()
        }
        // 环绕灵气微粒
        const moteN = pack.motes ?? 0
        for (let i = 0; i < moteN; i++) {
          const seed = i * 2.399
          const orbit = 66 + (i % 4) * 13 + Math.sin(t * 0.8 + seed) * 7
          const a = t * (0.3 + (i % 3) * 0.07) + seed
          const tw = 0.5 + 0.5 * Math.sin(t * 2.4 + seed * 3)
          ctx.fillStyle = `rgba(${auraRgb},${0.45 * tw})`
          ctx.beginPath()
          ctx.arc(cx + Math.cos(a) * orbit, cy - 46 + Math.sin(a * 1.25) * 48 - (i % 5) * 7, 1.5 + (i % 3) * 0.5, 0, Math.PI * 2)
          ctx.fill()
        }
        // 灵气升腾
        if (pack.rise) {
          for (let i = 0; i < 6; i++) {
            const rise = ((t * 30 + i * 26) % 120)
            ctx.fillStyle = `rgba(${auraRgb},${0.6 - rise / 200})`
            ctx.beginPath()
            ctx.arc(cx + Math.sin(t * 1.8 + i * 2.1) * (18 + i * 7), groundY - 14 - rise, 1.8 + (i % 2) * 0.6, 0, Math.PI * 2)
            ctx.fill()
          }
        }
        // 飘字
        if (pack.text) {
          ctx.font = '12px serif'
          ctx.fillStyle = `rgba(${auraRgb},0.92)`
          ctx.fillText(pack.text, cx + 56, cy - 120 + Math.sin(t * 3) * 3)
        }
      }

      // ── 跳舞舞台：聚光灯锥 + 旋转彩灯 + 脚下节拍涟漪（画在小仙身后）──
      if (dancing) {
        // 顶部聚光灯
        const spot = ctx.createLinearGradient(0, 0, 0, groundY + 40)
        spot.addColorStop(0, `rgba(255,240,200,${0.16 + 0.07 * Math.sin(beat * Math.PI)})`)
        spot.addColorStop(1, 'rgba(255,240,200,0)')
        ctx.fillStyle = spot
        ctx.beginPath()
        ctx.moveTo(cx - 26, 0)
        ctx.lineTo(cx + 26, 0)
        ctx.lineTo(cx + 90, groundY + 40)
        ctx.lineTo(cx - 90, groundY + 40)
        ctx.closePath()
        ctx.fill()
        // 两道旋转彩灯（青/金交替扫过）
        for (const [hue, speed] of [['150,235,200', 1.1], ['240,205,130', -0.9]] as const) {
          const a = t * speed
          ctx.save()
          ctx.translate(cx, groundY)
          ctx.rotate(a)
          const beam = ctx.createLinearGradient(0, 0, 120, 0)
          beam.addColorStop(0, `rgba(${hue},0.2)`)
          beam.addColorStop(1, `rgba(${hue},0)`)
          ctx.fillStyle = beam
          ctx.beginPath()
          ctx.moveTo(0, 0)
          ctx.lineTo(120, -26)
          ctx.lineTo(120, 26)
          ctx.closePath()
          ctx.fill()
          ctx.restore()
        }
        // 节拍涟漪：每拍从脚下荡开一圈
        for (let i = 0; i < 2; i++) {
          const ph = (beatPhase + i * 0.5) % 1
          ctx.strokeStyle = `rgba(150,235,200,${0.35 * (1 - ph)})`
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.ellipse(cx, groundY + 42, 30 + ph * 95, (30 + ph * 95) * 0.2, 0, 0, Math.PI * 2)
          ctx.stroke()
        }
      }

      // ── 坐骑（小仙骑乘时垫在脚下；吃饭泡澡时不上坐骑）──
      const activeCos = p.cosmetics?.active ?? null
      const mountKeyMap: Record<string, string> = { 'mount-fox': 'mountFox', 'mount-turtle': 'mountTurtle', 'mount-silkworm': 'mountSilkworm' }
      const mKey = acting ? null : mountKeyMap[activeCos ?? '']
      const mounted = !!mKey
      const lift = mounted ? 52 : 0
      if (mounted) {
        if (ready[p.gender === 'male' ? 'idleM' : 'idle']) requestImage(mKey)
        if (ready[mKey]) {
          const mh = 150
          const bob = Math.sin(t * 2.2) * 3
          ctx.save()
          ctx.translate(cx, groundY + 8 + bob)
          ctx.drawImage(imgs[mKey], -mh / 2 - 10, -mh + 26, mh * 1.15, mh * 1.15)
          ctx.restore()
        }
      }

      // ── 灵翼（背生双翼，画在小仙身后）──
      const wingKeyMap: Record<string, string> = { 'wings-qingyun': 'wings', 'wings-wangu': 'wingsGu' }
      const wKey = acting ? null : wingKeyMap[activeCos ?? '']
      if (wKey && ready[p.gender === 'male' ? 'idleM' : 'idle']) requestImage(wKey)
      if (wKey && ready[wKey]) {
        const flutter = 1 + Math.sin(t * 4) * 0.045
        ctx.save()
        ctx.translate(cx, cy - 66 - lift * 0.6)
        ctx.scale(flutter, flutter)
        ctx.globalAlpha = 0.92
        ctx.drawImage(imgs[wKey], -150, -105, 300, 210)
        ctx.globalAlpha = 1
        ctx.restore()
      }

      // ── 小仙本体（AI 形象，按性别选套图；动作立绘双帧交替：吃饭咀嚼/泡澡泼水；跳舞逐帧；深夜睡颜；待机眨眼）──
      const male = p.gender === 'male'
      const chewFrame = Math.floor(t * 3.2) % 2 === 1 // 咀嚼节奏 ~3.2Hz
      const splashFrame = Math.floor(t * 2) % 2 === 1 // 泼水节奏 2Hz
      const grabFrame = Math.floor(t * 4.5) % 2 === 1 // 挣扎扑腾节奏 4.5Hz（配合 180ms 交叉淡化，扑翼般柔和）
      const actKey = act === 'feed'
        ? male ? (chewFrame ? 'eatBM' : 'eatM') : chewFrame ? 'eatB' : 'eat'
        : act === 'bathe'
          ? male ? (splashFrame ? 'batheBM' : 'batheM') : splashFrame ? 'batheB' : 'bathe'
          : act === 'feed-fruit'
            ? male ? 'fruitM' : 'fruit'
            : act === 'brew'
              ? male ? 'brewM' : 'brew'
              : act === 'forge'
                ? male ? 'forgeM' : 'forge'
                : null
      // 资源包动作帧序列：注册动态 URL，帧号按 fps 轮转（交叉淡化柔化切换）
      let packKey: string | null = null
      const pframes = pack ? (male && pack.framesM?.length ? pack.framesM : pack.frames) ?? [] : []
      if (pack && pframes.length > 0) {
        const tag = male ? 'm' : 'f'
        for (let i = 0; i < pframes.length; i++) registerPackImage(`pack:${pack.id}:${tag}:${i}`, pack.resolve(pframes[i]))
        packKey = `pack:${pack.id}:${tag}:${Math.floor(t * (pack.fps ?? 1.8)) % pframes.length}`
      }
      const idleKey = male ? 'idleM' : 'idle'
      const openKey = male ? 'idleOpenM' : 'idleOpen'
      // 日常用睁眼立绘，眨眼瞬间切回闭眼笑的原版立绘（眨眼才看得见）
      const idlePose = ready[openKey] ? openKey : idleKey
      const meditateFrame = Math.floor(t * 0.8) % 2 === 1 // 吐纳双帧慢交替，灵气一吸一呼
      const key = grabbing
        ? male ? (grabFrame ? 'grabBM' : 'grabM') : grabFrame ? 'grabB' : 'grab'
        : actKey ?? packKey ??
          (dancing
            ? male
              ? danceFrame ? 'danceAM' : 'danceBM'
              : danceFrame ? 'danceA' : 'danceB'
            : meditating
              ? male
                ? meditateFrame ? 'meditateBM' : 'meditateM'
                : meditateFrame ? 'meditateB' : 'meditate'
              : sleepy
                ? male ? 'sleepM' : 'sleep'
                : blinking && ready[openKey]
                  ? idleKey
                  : idlePose)
      // 皮肤映射：内置姿态 key 换成皮肤帧（资源包动作/挣扎帧不受影响；皮肤缺的姿态自动回退默认立绘）
      const skinId = FORCE_SKIN ?? p.skin ?? null
      let finalKey = key
      let skinIdleKey: string | null = null
      if (skinId) {
        const idlePoseFile = skinPoseFile(skinId, 'idle')
        if (idlePoseFile) {
          skinIdleKey = `skin:${skinId}:idle`
          registerPackImage(skinIdleKey, idlePoseFile.pack.resolve(idlePoseFile.file))
        }
        if (assetUrls[key]) {
          const base = male && key.endsWith('M') ? key.slice(0, -1) : key
          const sp = skinPoseFile(skinId, base) ?? (base !== key ? skinPoseFile(skinId, key) : null)
          if (sp) {
            finalKey = `skin:${skinId}:${base}`
            registerPackImage(finalKey, sp.pack.resolve(sp.file))
          }
        }
      }
      requestImage(idleKey)
      if (ready[idleKey]) {
        requestImage(openKey)
        requestImage(finalKey)
      }
      const drawKey = ready[finalKey] ? finalKey : skinIdleKey && ready[skinIdleKey] ? skinIdleKey : male && ready.idleM ? 'idleM' : !male && ready.idle ? 'idle' : null
      // 帧间交叉淡化：姿态切换时 130ms 内旧帧淡出、新帧淡入，杜绝生硬跳变
      if (drawKey !== poseKey) {
        prevPoseKey = poseKey
        poseKey = drawKey ?? ''
        poseSwitchAt = t
      }
      const poseFade = Math.min(1, (t - poseSwitchAt) / 0.18)
      if (drawKey) {
        // 泡澡图带浴桶场景，画大一点、沉一点；其余保持原尺寸
        const bathing = act === 'bathe' && drawKey.startsWith('bathe')
        const size = bathing ? 292 : 250
        const breathe = acting
          ? 1 + Math.sin(t * 3.2) * 0.02
          : sleepy
            ? 1 + Math.sin(t * 0.9) * 0.024 // 睡着后呼吸更深更慢
            : 1 + Math.sin(t * 2) * 0.015
        // 小动作体态：伸懒腰上下抻拉、被理睬后开心弹跳、赌气背身微侧、戳一戳反应
        let sx = breathe
        let sy = breathe
        let dy = 0
        let rot = 0
        if (grabbing) {
          // 被拎着后领：单向悬挂后仰（绝不左右晃），挣扎全靠踢腿——急促上蹬 + 自然落下
          const kick = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2.4)), 1.6) // 尖锐上蹬脉冲
          rot = -0.07 // 拎着后领的自然后仰角（恒定，不摆动）
          dy = -10 - kick * 6 + (1 - kick) * 1.5
          const strain = Math.sin(t * Math.PI * 4.8) // 四肢高频小幅扑蹬（压弹而非摇晃）
          sx *= 1 + strain * 0.03
          sy *= 1 - strain * 0.035
          const dv = dragVecPropRef.current?.current
          const tiltTarget = dv ? Math.max(-0.26, Math.min(0.26, dv.x * 0.012)) : 0
          tiltSmooth += (tiltTarget - tiltSmooth) * 0.22 // 惯性倾斜低通滤波：只随拖拽方向单向倒
          rot += tiltSmooth
        } else if (acting) {
          // 吃饭/泡澡：满足地轻轻前后晃
          dy = -Math.abs(Math.sin(t * 2.4)) * 3
          rot = Math.sin(t * 1.6) * 0.02
          if (act === 'feed') {
            // 咀嚼同步压弹：腮帮一鼓一瘪
            const chew = Math.max(0, Math.sin(t * Math.PI * 3.2))
            sx *= 1 + chew * 0.03
            sy *= 1 - chew * 0.03
          } else if (act === 'bathe') {
            // 泼水瞬间身体轻晃大一点
            rot += splashFrame ? Math.sin(t * 4) * 0.02 : 0
          } else if (act === 'feed-fruit') {
            // 啃灵果：捧着果子一顿一顿地啃
            const bite = Math.max(0, Math.sin(t * Math.PI * 2.6))
            sx *= 1 + bite * 0.025
            sy *= 1 - bite * 0.03
            rot += bite * 0.02
          } else if (act === 'brew') {
            // 守炉闻香：随丹气一吸一呼
            const qig = Math.sin(t * 1.8)
            sy *= 1 + qig * 0.015
            dy -= Math.max(0, qig) * 2
          } else if (act === 'forge') {
            // 抡锤锻打：2.2Hz 节拍，落锤瞬间下压 + 前俯
            const hit = Math.max(0, Math.sin(t * Math.PI * 2.2))
            rot += hit * 0.055
            sy *= 1 - hit * 0.045
            sx *= 1 + hit * 0.03
          } else if (pack) {
            // 资源包通用体态：manifest 的 breathe/sway 参数驱动
            const br = Math.sin(t * 2.2)
            const amp = pack.breathe ?? 0.015
            sx *= 1 + amp * br * 0.5
            sy *= 1 + amp * br
            rot += (pack.sway ?? 0) * Math.sin(t * 1.5)
          }
        }
        if (!grabbing && landK >= 0 && landK < 1) {
          // 松手落地：压扁回弹（果冻感）+ 惯性回摆（沿拖拽方向甩一下再稳住）
          const imp = Math.sin(landK * Math.PI)
          sx *= 1 + imp * 0.09
          sy *= 1 - imp * 0.11
          dy += imp * 3
          const swing = Math.max(-0.24, Math.min(0.24, releaseVec.x * 0.014))
          rot += swing * Math.cos(landK * Math.PI * 1.6) * (1 - landK)
        } else if (emoting === 'stretch') {
          const k = Math.sin((1 - (emote.until - wall) / 2400) * Math.PI)
          sx *= 1 - 0.06 * k
          sy *= 1 + 0.08 * k
          dy = -6 * k
        } else if (emoting === 'happy' || act === 'poke-head') {
          dy = -Math.abs(Math.sin(t * 8)) * 10
        }
        if (act === 'poke-belly') {
          // 果冻抖动
          const w = Math.sin(t * 14)
          sx *= 1 + 0.08 * w
          sy *= 1 - 0.08 * w
        } else if (act === 'poke-hand') {
          // 被拉着手转圈圈
          rot = (t * 5) % (Math.PI * 2)
        } else if (dancing) {
          // 编舞：踩拍弹跳 + 左右倾摆 + 每 8 拍一个「转身」（横向翻卷模拟）
          const hop = Math.abs(Math.sin(beatPhase * Math.PI))
          dy = -hop * 15
          rot = Math.sin(beat * Math.PI) * 0.09
          const cycle = beat % 8
          if (cycle < 1.2) {
            const sp = cycle / 1.2
            const flip = Math.cos(sp * Math.PI * 2) // 1→0→-1→0→1：翻卷转身
            // 夹紧最窄宽度，避免转到侧面时糊成一条线
            sx *= Math.sign(flip || 1) * Math.max(Math.abs(flip), 0.38)
          }
          // 重拍下压：每拍起跳前微蹲
          const crouch = Math.max(0, 0.25 - beatPhase) * 4
          sx *= 1 + crouch * 0.06
          sy *= 1 - crouch * 0.06
        }
        // 帧间交叉淡化绘制：同一变换下先画淡出的旧帧，再画淡入的新帧
        const drawPose = (k: string, alpha: number) => {
          ctx.save()
          // 泡澡图底部是浴桶，锚到地面上；其余立绘以角色中心悬浮
          const anchorY = bathing ? groundY + 30 - size / 2 : cy - 60 + dy - lift
          ctx.translate(cx, anchorY + (bathing ? dy : 0))
          if (sulking) {
            ctx.rotate(-0.05)
            ctx.scale(-1, 1) // 哼，背过身去
          }
          ctx.rotate(rot)
          ctx.scale(sx, sy)
          if (alpha < 1) ctx.globalAlpha = alpha
          ctx.drawImage(lookImage(imgs[k]), -size / 2, -size / 2, size, size)
          ctx.restore()
        }
        if (poseFade < 1 && prevPoseKey && ready[prevPoseKey] && imgs[prevPoseKey]) drawPose(prevPoseKey, 1 - poseFade)
        drawPose(drawKey, poseFade)
        if (!reportedReady) {
          reportedReady = true
          callbacksRef.current.onReady?.()
        }
      } else {
        ctx.fillStyle = '#d7e8de'
        ctx.font = '14px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(loadError || '小仙正在苏醒……', cx, H / 2)
        ctx.textAlign = 'start'
      }

      // ── 松手落地：脚下扬尘 ──
      if (!grabbing && landK >= 0 && landK < 0.6) {
        const dp = landK / 0.6
        for (let i = 0; i < 5; i++) {
          const dir = i % 2 === 0 ? 1 : -1
          ctx.fillStyle = `rgba(205,195,165,${0.55 * (1 - dp)})`
          ctx.beginPath()
          ctx.arc(cx + dir * (16 + i * 13) * dp, groundY + 34 - Math.sin(dp * Math.PI) * 9 - (i % 3) * 2, 2.2 + (i % 3) * 0.8, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // ── 小动作表情符号 ──
      if (emoting === 'yawn') {
        const k = 1 - (emote.until - wall) / 2400
        ctx.globalAlpha = Math.sin(k * Math.PI)
        ctx.font = '22px serif'
        ctx.fillText('🥱', cx + 62, cy - 118 - k * 14)
        ctx.font = '12px serif'
        ctx.fillStyle = 'rgba(220,240,225,0.9)'
        ctx.fillText('哈～', cx + 86, cy - 96 - k * 18)
        ctx.globalAlpha = 1
      } else if (emoting === 'hum') {
        const k = 1 - (emote.until - wall) / 2400
        ctx.globalAlpha = Math.sin(k * Math.PI)
        ctx.font = '18px serif'
        ctx.fillText('🎵', cx + 66 + Math.sin(t * 3) * 6, cy - 110 - k * 26)
        ctx.fillText('🎶', cx - 80 - Math.sin(t * 2.4) * 6, cy - 96 - k * 20)
        ctx.globalAlpha = 1
      } else if (emoting === 'stretch') {
        ctx.font = '14px serif'
        ctx.fillText('✨', cx - 76, cy - 112)
        ctx.fillText('✨', cx + 74, cy - 88)
      } else if (emoting === 'happy') {
        ctx.font = '16px serif'
        ctx.fillText('💚', cx + 66, cy - 116 + Math.sin(t * 5) * 4)
      }

      // ── 戳一戳表情 ──
      if (act === 'poke-head') {
        ctx.font = '15px serif'
        ctx.fillText('💚', cx + 58, cy - 118 + Math.sin(t * 5) * 4)
        ctx.fillText('💚', cx - 70, cy - 100 + Math.cos(t * 4) * 4)
      } else if (act === 'poke-belly') {
        ctx.font = '14px serif'
        ctx.fillText('💦', cx + 70, cy - 92)
        ctx.font = '12px serif'
        ctx.fillStyle = 'rgba(220,240,225,0.9)'
        ctx.fillText('呀！', cx - 84, cy - 110)
      } else if (act === 'poke-hand') {
        ctx.font = '16px serif'
        ctx.fillText('💫', cx + 68, cy - 112)
        ctx.fillText('🌀', cx - 80, cy - 88)
      }

      // ── 音乐起舞：节拍音符阵 + 闪光星屑 ──
      if (dancing) {
        const notes = ['🎵', '🎶', '🎼', '💃']
        for (let i = 0; i < 4; i++) {
          const nb = (beat * 0.5 + i * 0.25) % 1 // 各自错开的升腾相位
          const side = i % 2 === 0 ? 1 : -1
          const nx = cx + side * (64 + i * 8) + Math.sin(t * 3 + i) * 8
          const ny = cy - 70 - nb * 80
          ctx.globalAlpha = Math.sin(nb * Math.PI)
          ctx.font = `${15 + Math.round(Math.sin(beatPhase * Math.PI) * 4)}px serif`
          ctx.fillText(notes[i], nx, ny)
        }
        ctx.globalAlpha = 1
        // 星屑随拍闪
        for (let i = 0; i < 5; i++) {
          const tw = Math.sin(beat * Math.PI + i * 2.1)
          if (tw > 0.3) {
            ctx.globalAlpha = tw * 0.9
            ctx.font = '11px serif'
            ctx.fillText('✨', cx - 100 + i * 48, cy - 128 + Math.cos(t * 2 + i) * 10)
          }
        }
        ctx.globalAlpha = 1
      }

      // ── 深夜打盹：💤 袅袅升起 ──
      if (sleepy) {
        for (let i = 0; i < 3; i++) {
          const rise = ((t * 14 + i * 34) % 100)
          ctx.globalAlpha = Math.max(0, 0.9 - rise / 110)
          ctx.font = `${13 + i * 3}px serif`
          ctx.fillText('💤', cx + 58 + rise * 0.35 + Math.sin(t + i) * 4, cy - 100 - rise)
        }
        ctx.globalAlpha = 1
      }

      // ── 赌气：气鼓鼓，偶尔哼一声 ──
      if (sulking) {
        const puff = 1 + Math.sin(t * 4) * 0.15
        ctx.font = `${Math.round(17 * puff)}px serif`
        ctx.fillText('💢', cx - 84, cy - 108)
        if (Math.sin(t * 0.5) > 0.7) {
          ctx.font = '12px serif'
          ctx.fillStyle = 'rgba(220,240,225,0.7)'
          ctx.fillText('哼', cx + 76, cy - 100)
        }
      }

      // 心情特效
      if (!meditating && !sulking && p.mood > 70) {
        // 开心：飘爱心
        const hy = ((t * 18) % 60)
        ctx.globalAlpha = Math.max(0, 1 - hy / 60)
        ctx.font = '16px serif'
        ctx.fillText('💚', cx + 68 + Math.sin(t * 2) * 6, cy - 100 - hy)
        ctx.globalAlpha = 1
      }
      if (p.satiety < 25 && !meditating) {
        // 饿了：冒汗滴 + 咕噜
        ctx.font = '14px serif'
        ctx.fillText('💧', cx - 72, cy - 110 + Math.sin(t * 3) * 3)
        if (Math.sin(t * 0.8) > 0.6) ctx.fillText('🍚', cx + 70, cy - 96)
      }
      if (p.cleanliness < 30 && !meditating) {
        // 脏了：小苍蝇/灰尘
        ctx.font = '12px serif'
        ctx.fillText('💨', cx - 70 + Math.sin(t * 4) * 8, cy - 70 + Math.cos(t * 3) * 6)
      }

      // 境界光环（筑基以上）
      if (p.realm >= 9) {
        ctx.strokeStyle = `rgba(216, 184, 119, ${0.35 + 0.15 * Math.sin(t * 2)})`
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(cx, cy - 66, 92 + Math.sin(t * 2) * 4, 0, Math.PI * 2)
        ctx.stroke()
        // 金丹以上：环绕灵珠
        if (p.realm >= 13) {
          for (let i = 0; i < 3; i++) {
            const a = t * 1.2 + (i / 3) * Math.PI * 2
            ctx.fillStyle = 'rgba(216,184,119,0.8)'
            ctx.beginPath()
            ctx.arc(cx + Math.cos(a) * 92, cy - 66 + Math.sin(a) * 30, 4, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }

      // ── 突破金光演出：渡劫功成后 3.6 秒，金莲绽放 + 光柱冲天 + 境界印 ──
      {
        const btAt = p.breakthroughAt ?? 0
        const btElapsed = wall - btAt
        if (btAt > 0 && btElapsed >= 0 && btElapsed < 3600) {
          const k = btElapsed / 3600
          const ease = 1 - Math.pow(1 - Math.min(1, k * 2.2), 3) // 快速绽放后缓缓收尾
          const fade = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1
          // 冲天金光柱
          const pillar = ctx.createLinearGradient(0, 0, 0, groundY + 40)
          pillar.addColorStop(0, `rgba(255,228,150,${0.55 * ease * fade})`)
          pillar.addColorStop(1, 'rgba(255,228,150,0)')
          ctx.fillStyle = pillar
          ctx.beginPath()
          ctx.moveTo(cx - 14 - ease * 30, 0)
          ctx.lineTo(cx + 14 + ease * 30, 0)
          ctx.lineTo(cx + 66 * ease, groundY + 40)
          ctx.lineTo(cx - 66 * ease, groundY + 40)
          ctx.closePath()
          ctx.fill()
          // 脚下金莲三层绽放
          for (let ring = 0; ring < 3; ring++) {
            const rk = Math.max(0, ease - ring * 0.18)
            if (rk <= 0) continue
            ctx.strokeStyle = `rgba(255,214,120,${0.75 * fade * (1 - ring * 0.22)})`
            ctx.lineWidth = 2.5 - ring * 0.6
            const rr = rk * (52 + ring * 30)
            ctx.beginPath()
            ctx.ellipse(cx, groundY + 40, rr, rr * 0.22, 0, 0, Math.PI * 2)
            ctx.stroke()
            // 每环八瓣莲
            for (let i = 0; i < 8; i++) {
              const a = (i / 8) * Math.PI * 2 + t * 0.6 * (ring % 2 === 0 ? 1 : -1)
              const bx = cx + Math.cos(a) * rr
              const by = groundY + 40 + Math.sin(a) * rr * 0.22
              ctx.fillStyle = `rgba(255,228,160,${0.7 * fade * rk})`
              ctx.beginPath()
              ctx.ellipse(bx, by, 4.5, 2, a, 0, Math.PI * 2)
              ctx.fill()
            }
          }
          // 灵气碎金升腾
          for (let i = 0; i < 14; i++) {
            const rise = ((t * 60 + i * 37) % 190)
            ctx.fillStyle = `rgba(255,220,140,${(0.8 - rise / 240) * fade})`
            ctx.beginPath()
            ctx.arc(cx + Math.sin(i * 2.4 + t) * (30 + i * 6), groundY + 30 - rise, 1.8 + (i % 3) * 0.7, 0, Math.PI * 2)
            ctx.fill()
          }
          // 「突破」朱砂印：从上方盖下，微微回弹
          const stampK = Math.min(1, Math.max(0, (k - 0.12) / 0.3))
          if (stampK > 0) {
            const bounce = 1 + Math.sin(stampK * Math.PI) * 0.18
            ctx.save()
            ctx.translate(cx, 60)
            ctx.rotate(-0.06)
            ctx.scale(bounce, bounce)
            ctx.globalAlpha = stampK * fade
            const seal = 46
            ctx.fillStyle = 'rgba(178,52,42,0.92)'
            ctx.beginPath()
            ctx.roundRect(-seal / 2, -seal / 2, seal, seal, 8)
            ctx.fill()
            ctx.strokeStyle = 'rgba(255,236,200,0.85)'
            ctx.lineWidth = 2
            ctx.stroke()
            ctx.fillStyle = '#ffeccc'
            ctx.font = 'bold 19px "Kaiti SC", "STKaiti", "KaiTi", serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText('突破', 0, 1)
            ctx.restore()
            ctx.textAlign = 'start'
            ctx.textBaseline = 'alphabetic'
          }
        }
      }

      // ── 天气：雨天撑荷叶伞、下雪堆小冰人 ──
      const wth = weatherRef.current
      if (wth === 'rain') {
        if (ready[idleKey]) requestImage('umbrella')
        // 雨丝
        ctx.strokeStyle = 'rgba(160, 200, 235, 0.35)'
        ctx.lineWidth = 1
        for (let i = 0; i < 18; i++) {
          const rx = (i * 47 + t * 160) % W
          const ry = (i * 89 + t * 320) % H
          ctx.beginPath()
          ctx.moveTo(rx, ry)
          ctx.lineTo(rx - 4, ry + 12)
          ctx.stroke()
        }
        // 荷叶伞
        if (ready.umbrella) {
          ctx.save()
          ctx.translate(cx + 34, cy - 128 - lift)
          ctx.rotate(Math.sin(t * 1.6) * 0.06)
          ctx.drawImage(imgs.umbrella, -70, -86, 140, 140)
          ctx.restore()
        }
      } else if (wth === 'snow') {
        if (ready[idleKey]) requestImage('snowman')
        // 雪花
        ctx.fillStyle = 'rgba(230, 242, 255, 0.75)'
        for (let i = 0; i < 22; i++) {
          const sx = (i * 53 + Math.sin(t * 0.9 + i) * 24 + t * 12) % W
          const sy = (i * 71 + t * 34) % H
          ctx.beginPath()
          ctx.arc(sx, sy, 1.2 + (i % 3) * 0.6, 0, Math.PI * 2)
          ctx.fill()
        }
        // 小冰人
        if (ready.snowman) {
          ctx.save()
          ctx.translate(cx - 96, groundY + 22)
          ctx.rotate(Math.sin(t * 1.2) * 0.03)
          ctx.drawImage(imgs.snowman, -36, -72, 72, 72)
          ctx.restore()
        }
      }

      // 深夜微光调
      if (sleepy) {
        ctx.fillStyle = 'rgba(8, 16, 38, 0.08)'
        ctx.fillRect(0, 0, W, H)
      }

      raf = requestAnimationFrame(draw)
    }
    const draw = (now: number) => {
      try {
        drawFrame(now)
      } catch (error) {
        const message = `桌宠动画绘制失败：${error instanceof Error ? error.message : String(error)}`
        console.error('[pet-canvas]', message)
        callbacksRef.current.onError?.(message)
      }
    }
    raf = requestAnimationFrame(draw)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
    }
  }, [interactRef])

  return <canvas ref={setCanvasRef} className="mx-auto block" style={{ width: 340, height: 340 }} />
})

export default PetCanvas
