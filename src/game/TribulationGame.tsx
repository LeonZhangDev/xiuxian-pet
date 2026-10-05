import { useEffect, useRef, useState } from 'react'
import type { PetState } from './data'
import { REALMS } from './data'
import { Sfx } from './dungeon'
import bgUrl from '../assets/tribulation-bg.jpg'
import petIdleUrl from '../assets/pet-idle.webp'

// ─── 渡劫护法 ───────────────────────────────────────────────────────
// 天雷自劫云漩涡劈落，点击雷电将其化解；心境耗尽则渡劫失败。

interface Bolt {
  id: number
  x: number // 落点 x
  state: 'telegraph' | 'falling' | 'done'
  t: number // 状态计时
  progress: number // 下落进度 0-1
  dispelled: boolean
}

const DURATION = 30 // 渡劫时长（秒）
const TELEGRAPH = 0.8 // 预警时长
const FALL = 0.5 // 劈落时长

export default function TribulationGame({
  pet,
  onEnd,
}: {
  pet: PetState
  onEnd: (success: boolean) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mind, setMind] = useState(3)
  const [left, setLeft] = useState(DURATION)
  const [dispelled, setDispelled] = useState(0)
  const [result, setResult] = useState<'success' | 'fail' | null>(null)
  const resultRef = useRef<'success' | 'fail' | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const W = (canvas.width = 960)
    const H = (canvas.height = 600)
    const sfx = new Sfx()
    sfx.ensure()

    const bg = new Image()
    let bgReady = false
    bg.onload = () => { bgReady = true }
    bg.src = bgUrl
    const petImg = new Image()
    let petReady = false
    petImg.onload = () => { petReady = true }
    petImg.src = petIdleUrl

    const petX = W / 2
    const petY = H - 110

    let bolts: Bolt[] = []
    let boltId = 0
    let hp = 3
    let dispelCount = 0
    let time = 0
    let spawnT = 0.8
    let shake = 0
    let flashAll = 0
    let finished = false
    let raf = 0
    let last = performance.now()

    const finish = (ok: boolean) => {
      if (finished) return
      finished = true
      const r = ok ? 'success' : 'fail'
      resultRef.current = r
      if (ok) sfx.pickup()
      else sfx.hurt()
      setTimeout(() => setResult(r), ok ? 800 : 600)
    }

    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const mx = ((e.clientX - rect.left) / rect.width) * W
      const my = ((e.clientY - rect.top) / rect.height) * H
      sfx.ensure()
      // 点击雷电（剑身附近 60px 内）化解
      for (const b of bolts) {
        if (b.dispelled || b.state === 'done') continue
        const headY = b.state === 'telegraph' ? 120 : 120 + b.progress * (petY - 150)
        // 判定区域：雷柱附近
        if (Math.abs(mx - b.x) < 55 && my > 60 && my < headY + 60) {
          b.dispelled = true
          b.state = 'done'
          dispelCount++
          setDispelled(dispelCount)
          sfx.thunder()
          break
        }
      }
    }
    canvas.addEventListener('mousedown', onClick)

    // 画一道锯齿闪电
    const drawBolt = (x: number, y0: number, y1: number, alpha: number, width: number) => {
      const segs = 9
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.strokeStyle = '#e8dcff'
      ctx.lineWidth = width
      ctx.shadowColor = '#b08cff'
      ctx.shadowBlur = 18
      ctx.beginPath()
      let px = x
      ctx.moveTo(px, y0)
      for (let i = 1; i <= segs; i++) {
        const y = y0 + ((y1 - y0) * i) / segs
        px = x + (i === segs ? 0 : (Math.random() - 0.5) * 34)
        ctx.lineTo(px, y)
      }
      ctx.stroke()
      ctx.lineWidth = width * 2.6
      ctx.globalAlpha = alpha * 0.25
      ctx.stroke()
      ctx.restore()
    }

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      if (!finished) time += dt
      setLeft(Math.max(0, Math.ceil(DURATION - time)))

      // ── 生成雷电（频率渐快，后期双雷）──
      if (!finished) {
        spawnT -= dt
        if (spawnT <= 0) {
          const k = time / DURATION
          spawnT = 1.25 - k * 0.75
          bolts.push({ id: ++boltId, x: petX + (Math.random() - 0.5) * 560, state: 'telegraph', t: TELEGRAPH, progress: 0, dispelled: false })
          if (k > 0.55 && Math.random() < 0.45) {
            bolts.push({ id: ++boltId, x: petX + (Math.random() - 0.5) * 560, state: 'telegraph', t: TELEGRAPH * 1.2, progress: 0, dispelled: false })
          }
          sfx.beep(1400, 0.15, 'sine', 0.03, -600)
        }
        if (time >= DURATION && bolts.every((b) => b.state === 'done')) finish(hp > 0)
      }

      // ── 雷电推进 ──
      for (const b of bolts) {
        if (b.state === 'telegraph') {
          b.t -= dt
          if (b.t <= 0) b.state = 'falling'
        } else if (b.state === 'falling') {
          b.progress += dt / FALL
          if (b.progress >= 1) {
            b.state = 'done'
            // 命中范围：小仙附近
            if (Math.abs(b.x - petX) < 70) {
              hp--
              setMind(hp)
              shake = 14
              flashAll = 0.25
              sfx.hurt()
              if (hp <= 0) finish(false)
            } else {
              sfx.thunder()
              shake = Math.max(shake, 4)
            }
          }
        }
      }
      bolts = bolts.filter((b) => b.state !== 'done')
      shake = Math.max(0, shake - dt * 30)
      flashAll = Math.max(0, flashAll - dt)

      // ── 渲染 ──
      const sx = (Math.random() - 0.5) * shake
      const sy = (Math.random() - 0.5) * shake
      ctx.save()
      ctx.translate(sx, sy)
      if (bgReady) ctx.drawImage(bg, 0, 0, W, H)
      else {
        ctx.fillStyle = '#14101f'
        ctx.fillRect(0, 0, W, H)
      }
      // 压暗下部，突出舞台
      const grad = ctx.createLinearGradient(0, H * 0.5, 0, H)
      grad.addColorStop(0, 'rgba(10,8,20,0)')
      grad.addColorStop(1, 'rgba(10,8,20,0.75)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, H)

      // 小仙（立于峰顶）
      if (petReady) {
        const bob = Math.sin(now / 400) * 3
        // 护体金光（剩余心境越多数越亮）
        ctx.fillStyle = `rgba(255, 215, 130, ${0.06 + hp * 0.05})`
        ctx.beginPath()
        ctx.arc(petX, petY - 40 + bob, 95, 0, Math.PI * 2)
        ctx.fill()
        ctx.drawImage(petImg, petX - 85, petY - 125 + bob, 170, 170)
      }

      // 雷电
      for (const b of bolts) {
        if (b.state === 'telegraph') {
          // 预警：落点光环 + 虚影闪
          const a = 1 - b.t / TELEGRAPH
          ctx.strokeStyle = `rgba(200, 160, 255, ${0.3 + a * 0.5})`
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.ellipse(b.x, petY + 30, 40 + a * 20, 10 + a * 4, 0, 0, Math.PI * 2)
          ctx.stroke()
          if (a > 0.5) drawBolt(b.x, 60, petY - 20, 0.15, 3)
        } else if (b.state === 'falling') {
          const headY = 60 + b.progress * (petY - 90)
          drawBolt(b.x, 60, headY, 1, 5)
          // 雷头光球
          ctx.fillStyle = 'rgba(230, 215, 255, 0.9)'
          ctx.shadowColor = '#b08cff'
          ctx.shadowBlur = 24
          ctx.beginPath()
          ctx.arc(b.x, headY, 10, 0, Math.PI * 2)
          ctx.fill()
          ctx.shadowBlur = 0
        }
      }

      if (flashAll > 0) {
        ctx.fillStyle = `rgba(220, 200, 255, ${flashAll * 1.6})`
        ctx.fillRect(0, 0, W, H)
      }
      ctx.restore()

      if (!finished) raf = requestAnimationFrame(loop)
      else {
        // 收束一帧
      }
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('mousedown', onClick)
    }
  }, [])

  return (
    <div className="relative mx-auto w-full max-w-[980px]">
      <canvas
        ref={canvasRef}
        width={960}
        height={600}
        className="block w-full cursor-crosshair rounded-xl border border-violet-800/60 bg-[#14101f]"
      />

      {/* HUD */}
      <div className="pointer-events-none absolute left-4 top-4 rounded-lg border border-violet-700/60 bg-black/60 px-4 py-2">
        <div className="text-[10px] tracking-[0.3em] text-violet-200/70">心境</div>
        <div className="text-lg tracking-[0.3em]">
          {Array.from({ length: 3 }, (_, i) => (
            <span key={i} className={i < mind ? 'text-violet-300' : 'text-white/15'}>☯</span>
          ))}
        </div>
      </div>
      <div className="pointer-events-none absolute right-4 top-4 rounded-lg border border-amber-700/60 bg-black/60 px-4 py-2 text-center">
        <div className="text-[10px] tracking-[0.3em] text-amber-200/70">天劫持续</div>
        <div className="text-xl font-bold text-amber-200">{left}s</div>
        <div className="text-[10px] text-violet-200/70">已化解 {dispelled} 道</div>
      </div>
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-violet-700/50 bg-black/60 px-5 py-1.5 text-xs text-violet-100/80">
        点击劈落的雷电，为{pet.name} 护法 · 莫让天雷近身
      </div>

      {/* 结算 */}
      {result && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/70 backdrop-blur-sm">
          <div className="w-96 rounded-xl border border-violet-600/50 bg-[#16121f] p-6 text-center shadow-2xl">
            <div className="mb-1 text-3xl">{result === 'success' ? '🌈' : '🌩️'}</div>
            <div className={`mb-3 text-xl tracking-[0.3em] ${result === 'success' ? 'text-amber-200' : 'text-violet-300'}`}>
              {result === 'success' ? '渡劫成功' : '渡劫失败'}
            </div>
            <div className="mb-5 text-sm text-emerald-100/70">
              {result === 'success'
                ? `云开月明，${pet.name} 踏入「${REALMS[pet.realm + 1] ?? '更高境界'}」，此后仙途再无此劫！`
                : `${pet.name} 被天雷震伤道基，修为折损……回去将养一番，卷土重来未可知。`}
            </div>
            <button
              onClick={() => onEnd(resultRef.current === 'success')}
              className="w-full rounded-lg border border-amber-600/60 bg-amber-700/30 py-2 tracking-[0.3em] text-amber-100 transition hover:bg-amber-600/40"
            >
              返回洞府
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
