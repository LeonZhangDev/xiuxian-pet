import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { REALMS, cultivationNeed, msg, type PetAction } from '../game/data'
import PetCanvas from '../game/PetCanvas'
import { chatReply } from '../game/chat'
import { uiLog, setUiVerbose } from '../lib/logger'
import { desktop } from '../lib/desktop-bridge'
import { useWeather } from '../hooks/use-weather'
import { useMusicState } from '../hooks/use-music'
import type { ViewProps } from './view-types'
import sfxPatUrl from '../assets/sfx-pat.mp3'
import sfxPokeUrl from '../assets/sfx-poke.mp3'
import sfxSpinUrl from '../assets/sfx-spin.mp3'
import sfxBreakthroughUrl from '../assets/sfx-breakthrough.mp3'

export default function PetView({ pet, messages, dispatch: sendAction, setMessages, navigate, mode }: ViewProps) {
  const [now, setNow] = useState(Date.now)
  const [lastInteraction, setLastInteraction] = useState(Date.now)
  const interactiveRef = useRef(false)
  const draggedRef = useRef(false)
  const dragRef = useRef<{x: number; y: number} | null>(null)
  const dragVecRef = useRef({ x: 0, y: 0 }) // 拖拽瞬时位移（小仙惯性倾斜用）
  const [locked, setLocked] = useState(false)
  const [hover, setHover] = useState(false)
  const [grabbed, setGrabbed] = useState(false) // 正被拎着拖动（小仙播挣扎帧）
  const [ghost, setGhost] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [bubbleGone, setBubbleGone] = useState(false)
  const { dancing: musicOn, systemPlaying: musicPlaying, bpm } = useMusicState()
  const weather = useWeather()
  const [follow, setFollow] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatLog, setChatLog] = useState<Array<{ who: 'me' | 'pet'; text: string }>>([])
  const [chatInput, setChatInput] = useState('')
  const chatBusyRef = useRef(false)
  const [recentAction, setRecentAction] = useState<string | null>(null)
  const actTimer = useRef<number>(0)
  const petBoxRef = useRef<HTMLDivElement>(null)
  const petCanvasRef = useRef<HTMLCanvasElement>(null) // 像素级悬浮命中用
  const hitRef = useRef<CanvasRenderingContext2D | null>(null) // 1px 离屏命中画布
  const leaveTimer = useRef<number>(0) // 掠过透明缝隙时延迟隐去 UI
  const petRef = useRef(pet)
  useEffect(() => { petRef.current = pet }, [pet])
  // 最近互动时间：喂食/洗澡/靠近/点菜单都会刷新；90 秒不理它就要赌气了
  const interactRef = useRef(0)
  useEffect(() => {
    interactRef.current = Date.now()
    const timer = window.setInterval(() => { setNow(Date.now()); setLastInteraction(interactRef.current) }, 1000)
    return () => { window.clearInterval(timer); window.clearTimeout(actTimer.current); window.clearTimeout(leaveTimer.current); desktop?.setHitTest(false) }
  }, [])
  // 戳一戳：按下位置（区分点击与拖动）
  const downRef = useRef<{ x: number; y: number } | null>(null)
  // 戳一戳音效（AI 生成的真实音频资产）
  const sfx = useRef<{ head: HTMLAudioElement; belly: HTMLAudioElement; hand: HTMLAudioElement } | null>(null)
  useEffect(() => {
    sfx.current = { head: new Audio(sfxPatUrl), belly: new Audio(sfxPokeUrl), hand: new Audio(sfxSpinUrl) }
    sfx.current.head.volume = 0.5
    sfx.current.belly.volume = 0.5
    sfx.current.hand.volume = 0.5
    return () => { Object.values(sfx.current ?? {}).forEach((audio) => audio.pause()); sfx.current = null }
  }, [])

  // 戳一戳：摸头开心 / 戳肚子抗议 / 拉手转圈
  const poke = (kind: 'head' | 'belly' | 'hand') => {
    interactRef.current = Date.now()
    setRecentAction(`poke-${kind}`)
    window.clearTimeout(actTimer.current)
    actTimer.current = window.setTimeout(() => setRecentAction(null), 1600)
    const a = sfx.current?.[kind]
    if (a) {
      // HTMLAudioElement is an imperative browser resource, not React state.
      // eslint-disable-next-line react-hooks/immutability
      a.currentTime = 0
      void a.play().catch(() => {})
    }
    const text = kind === 'head' ? '「嘿嘿，再摸一下……」' : kind === 'belly' ? '「呀！别闹～」' : '「哇——转晕啦！」'
    setMessages((m) => [...m.slice(-5), msg(text)])
  }

  const dispatch = useCallback((action: PetAction) => {
    sendAction(action)
    const actKey = action.type === 'feed'
      ? action.fruit ? 'feed-fruit' : 'feed'
      : action.type === 'study'
        ? 'study-wuxiang'
        : ['bathe', 'meditate', 'brew', 'forge'].includes(action.type)
          ? action.type
          : null
    if (actKey) {
      setRecentAction(actKey)
      window.clearTimeout(actTimer.current)
      actTimer.current = window.setTimeout(() => setRecentAction(null), 2600)
    }
    if (action.type !== 'tick') interactRef.current = Date.now()
  }, [sendAction])

  // 和小仙聊天（离线话术引擎；localStorage 配置大模型后自动升级）
  const sendChat = useCallback(() => {
    const text = chatInput.trim()
    if (!text || chatBusyRef.current) return
    chatBusyRef.current = true
    setChatInput('')
    setChatLog((l) => [...l.slice(-11), { who: 'me', text }])
    interactRef.current = Date.now()
    setChatOpen(true)
    void chatReply(text, petRef.current)
      .then((reply) => {
        setChatLog((l) => [...l.slice(-11), { who: 'pet', text: reply }])
        setMessages((m) => [...m.slice(-5), msg(`「${reply}」`)])
      })
      .finally(() => { chatBusyRef.current = false })
  }, [chatInput, setMessages])

  // 突破仙音：渡劫功成瞬间奏一次编钟（窗口级金光配合 PetCanvas 的金莲演出）
  const btPlayedForRef = useRef(0)
  useEffect(() => {
    const at = pet.breakthroughAt ?? 0
    if (at > 0 && Date.now() - at < 4000 && btPlayedForRef.current !== at) {
      btPlayedForRef.current = at
      const a = new Audio(sfxBreakthroughUrl)
      a.volume = 0.8
      void a.play().catch(() => {})
    }
  }, [pet.breakthroughAt])

  // 详细日志模式：托盘开关同步过来后，开始 30 秒一次的性能采样
  useEffect(() => {
    const unsubscribe = desktop?.onVerbose((on) => {
      setUiVerbose(on)
      uiLog.info('log', `详细日志模式 → ${on}`)
    })
    const id = window.setInterval(() => {
      const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
      uiLog.debug('perf', '性能采样', {
        heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : undefined,
        mode,
        realm: petRef.current.realm,
        satiety: Math.round(petRef.current.satiety),
      })
    }, 30_000)
    return () => { window.clearInterval(id); unsubscribe?.() }
  }, [mode])

  // 托盘快捷动作（右键托盘图标：喂食/洗澡/吐纳/历练/穿透同步）
  useEffect(() => {
    return desktop?.onTrayAction((a) => {
      if (a === 'feed') dispatch({ type: 'feed', fruit: false })
      else if (a === 'bathe') dispatch({ type: 'bathe' })
      else if (a === 'meditate') dispatch({ type: 'meditate' })
      else if (a === 'dungeon') {
        const p = petRef.current
        dispatch({ type: 'enterDungeon' })
        if (!p.secluding && p.stamina >= 25) navigate('dungeon')
      } else if (a === 'ghost-on') setGhost(true)
      else if (a === 'ghost-off') setGhost(false)
    })
  }, [dispatch, navigate])

  // 碎碎念气泡：新消息浮现，6 秒后自动隐去（悬停时常驻）
  const latestMessageId = messages[messages.length - 1]?.id
  useEffect(() => {
    setBubbleGone(false)
    const id = window.setTimeout(() => setBubbleGone(true), 6000)
    return () => window.clearTimeout(id)
  }, [latestMessageId])

  // 右键菜单：Esc 关闭
  useEffect(() => {
    if (!menu) return
    const f = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null)
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [menu])

  // 闭关守护：专注期间按白名单监控前台窗口
  useEffect(() => {
    if (!desktop) return
    if (pet.focus.phase === 'focus' && pet.guard.enabled) {
      const list = pet.guard.whitelist.split(',').map((s) => s.trim()).filter(Boolean)
      desktop.startGuard(list, pet.guard.strict)
      return () => desktop?.stopGuard()
    }
    desktop.stopGuard()
  }, [pet.focus.phase, pet.guard.enabled, pet.guard.strict, pet.guard.whitelist])

  // 心魔事件（前台切到白名单外软件）
  useEffect(() => {
    return desktop?.onDistraction((app) => dispatch({ type: 'distraction', app }))
  }, [dispatch])

  // 系统放歌：起舞状态由 useMusicState 统一给出（洞府窗口同源），这里只负责碎碎念
  const musicWasOn = useRef(false)
  useEffect(() => {
    if (musicPlaying && !musicWasOn.current) {
      setMessages((m) => [...m.slice(-5), msg('🎶 好曲子！我也来扭一段～')])
      interactRef.current = Date.now()
    }
    musicWasOn.current = musicPlaying
  }, [musicPlaying, setMessages])

  // 饭点提醒：早 7-9 / 午 11-13 / 晚 17-19，饱腹不足就要饭
  const mealRemindRef = useRef('')
  useEffect(() => {
    const id = window.setInterval(() => {
      const h = new Date().getHours()
      const meal = h >= 7 && h < 9 ? '早饭' : h >= 11 && h < 13 ? '午饭' : h >= 17 && h < 19 ? '晚饭' : null
      const p = petRef.current
      const stamp = meal + new Date().toDateString()
      if (meal && p.satiety < 70 && mealRemindRef.current !== stamp) {
        mealRemindRef.current = stamp
        setMessages((m) => [...m.slice(-5), msg(`「到${meal}时间啦，肚子咕咕叫……」`)])
      }
    }, 30000)
    return () => window.clearInterval(id)
  }, [setMessages])

  // 自主行为：桌宠模式且未被理睬时才自己散步；跟鼠标模式优先
  useEffect(() => {
    if (!desktop) return
    desktop.setWander(mode === 'pet' && !locked && !ghost && !hover && !menu && !follow)
  }, [mode, locked, ghost, hover, menu, follow])
  useEffect(() => {
    desktop?.setFollow(follow && mode === 'pet' && !locked && !ghost)
  }, [follow, mode, locked, ghost])

  const enterDungeon = () => {
    if (pet.secluding || pet.stamina < 25) {
      dispatch({ type: 'enterDungeon' }) // 触发提示消息
      return
    }
    dispatch({ type: 'enterDungeon' })
    navigate('dungeon')
  }

  const need = cultivationNeed(pet.realm)
  const cultPct = Math.min(100, (pet.cultivation / need) * 100)
  const focusRemainMs = Math.max(0, (pet.focus?.endsAt ?? 0) - now)
  const focusRemain = `${String(Math.floor(focusRemainMs / 60000)).padStart(2, '0')}:${String(Math.floor((focusRemainMs % 60000) / 1000)).padStart(2, '0')}`

  // ── 桌面桌宠模式：完全透明，平时只见小仙；鼠标靠近才浮现功能（QQ 宠物式）──
  {
    const noDrag = { WebkitAppRegion: 'no-drag' } as CSSProperties
    const latest = messages[messages.length - 1]
    const reveal = hover || locked || !!menu || chatOpen
    const sulking =
      !pet.secluding && pet.focus.phase === 'idle' && now - lastInteraction > 90_000
    const bubbleText =
      latest?.text ??
      (pet.focus.phase === 'focus'
        ? `🍅 闭关专注中 · 剩 ${focusRemain}`
        : pet.focus.phase === 'break'
          ? '调息歇息中……喝口茶吧'
          : pet.pendingTribulation
            ? '⚡ 天劫将至！快开洞府为我护法'
            : pet.secluding
              ? `闭关中……还剩 ${Math.ceil(pet.secludeLeft)} 息`
              : musicOn
                ? '🎶 跟着节奏摇摆中～'
                : sulking
                  ? '「哼，都不理我……」'
                  : new Date(now).getHours() >= 23 || new Date(now).getHours() < 6
                    ? '「zzz……好困……」'
                    : '「今天也是修仙的好日子！」')
    const showBubble = !bubbleGone || reveal

    // 鼠标碰到小仙「画出来的任何像素」就唤醒 UI；
    // 把主画布那 1 个像素 drawImage 到离屏小画布再读 alpha（主画布保持 GPU 加速，不拖 CPU）。
    // 掠过头/脚/裙摆都算；移向按钮途中过透明缝隙时延迟隐去，避免 UI 闪没。
    const onPetMouseMove = (e: { clientX: number; clientY: number; target?: EventTarget | null }) => {
      window.clearTimeout(leaveTimer.current)
      if (dragRef.current) return
      if (e.target instanceof Element && e.target.closest('button, input, [data-pet-interactive]')) { desktop?.setHitTest(true); return }
      const cv = petCanvasRef.current
      if (!cv) { interactiveRef.current = false; desktop?.setHitTest(false); return }
      const r = cv.getBoundingClientRect()
      const x = Math.floor(((e.clientX - r.left) / r.width) * cv.width)
      const y = Math.floor(((e.clientY - r.top) / r.height) * cv.height)
      if (x < 0 || y < 0 || x >= cv.width || y >= cv.height) { interactiveRef.current = false; desktop?.setHitTest(false); return }
      try {
        if (!hitRef.current) {
          const c = document.createElement('canvas')
          c.width = 1
          c.height = 1
          hitRef.current = c.getContext('2d', { willReadFrequently: true })
        }
        const hit = hitRef.current!
        hit.clearRect(0, 0, 1, 1)
        hit.drawImage(cv, x, y, 1, 1, 0, 0, 1, 1)
        const alpha = hit.getImageData(0, 0, 1, 1).data[3]
        interactiveRef.current = alpha > 10
        desktop?.setHitTest(alpha > 10)
        if (alpha > 10) {
          if (!hover) uiLog.info('pet', '悬浮唤醒小仙 UI')
          setHover(true)
          interactRef.current = Date.now() // 碰到也算理它
        }
      } catch { desktop?.setHitTest(false) }
    }
    const onPetContextMenu = (e: { clientX: number; clientY: number; preventDefault: () => void }) => {
      e.preventDefault()
      interactRef.current = Date.now()
      const r = petBoxRef.current?.getBoundingClientRect()
      if (!r) return
      const x = Math.min(Math.max(e.clientX - r.left, 4), 360 - 190)
      const y = Math.min(Math.max(e.clientY - r.top, 4), 36)
      setMenu({ x, y })
      setHover(true)
    }
    const toggleGhost = () => {
      const next = !ghost
      setGhost(next)
      desktop?.setClickThrough(next)
    }

    // 戳一戳：点击（非拖动）落在小仙头/肚子/手上触发不同反应
    const onPetClick = (e: { clientX: number; clientY: number }) => {
      setMenu(null)
      const d = downRef.current
      downRef.current = null
      if (draggedRef.current) { draggedRef.current = false; return }
      if (!d || Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 6) return // 拖动不算戳
      const r = petBoxRef.current?.getBoundingClientRect()
      if (!r) return
      const x = e.clientX - r.left
      const y = e.clientY - r.top
      const ax = Math.abs(x - 180)
      if (ax <= 55 && y >= 170 && y <= 262) poke('head')
      else if (ax <= 45 && y >= 288 && y <= 382) poke('belly')
      else if (ax >= 55 && ax <= 118 && y >= 248 && y <= 372) poke('hand')
    }

    // 环绕小仙的功能弧（205°→337° 扇形浮出）
    const arc = [
      { icon: '🍚', label: '喂食', fn: () => dispatch({ type: 'feed', fruit: false }) },
      { icon: '🛁', label: '洗澡', fn: () => dispatch({ type: 'bathe' }) },
      { icon: '🧘', label: '吐纳', fn: () => dispatch({ type: 'meditate' }) },
      { icon: '🌀', label: pet.secluding ? `${Math.ceil(pet.secludeLeft)}s` : '闭关', fn: () => dispatch({ type: 'seclude' }) },
    ] as const
    const arcPos = (i: number) => {
      const a = ((205 + i * 33) * Math.PI) / 180
      return { left: 180 + Math.cos(a) * 156, top: 320 + Math.sin(a) * 156 }
    }
    const dungeonPos = arcPos(4)

    const menuItems: Array<
      { sep: true } | { icon: string; label: string; fn: () => void; check?: boolean; danger?: boolean }
    > = [
      { icon: '⛩️', label: '打开洞府', fn: () => navigate('home') },
      { icon: '⚔️', label: '出外历练', fn: enterDungeon },
      { sep: true },
      { icon: '🍚', label: '喂食', fn: () => dispatch({ type: 'feed', fruit: false }) },
      { icon: '🛁', label: '洗澡', fn: () => dispatch({ type: 'bathe' }) },
      { icon: '🧘', label: '吐纳', fn: () => dispatch({ type: 'meditate' }) },
      { icon: '🌀', label: '闭关 30 息', fn: () => dispatch({ type: 'seclude' }) },
      { sep: true },
      { icon: '💬', label: '和小仙聊天', fn: () => setChatOpen(true) },
      { icon: '🍅', label: '番茄专注 25 分钟', fn: () => dispatch({ type: 'startFocus', minutes: 25 }) },
      {
        icon: pet.gender === 'male' ? '🌸' : '🌊',
        label: pet.gender === 'male' ? '化作女修形象' : '化作男修形象',
        fn: () => dispatch({ type: 'setGender', gender: pet.gender === 'male' ? 'female' : 'male' }),
      },
      { icon: locked ? '📌' : '📍', label: locked ? '解锁位置' : '锁定位置', fn: () => setLocked((v) => !v), check: locked },
      { icon: '👻', label: '鼠标穿透（托盘可恢复）', fn: toggleGhost, check: ghost },
      { icon: '🧲', label: '跟我走（追着鼠标）', fn: () => setFollow((v) => !v), check: follow },
      { sep: true },
      { icon: '🚪', label: '退出桌面小仙', fn: () => desktop?.quit(), danger: true },
    ]

    return (
      <div
        className="relative h-screen w-screen select-none overflow-hidden text-emerald-50"
        style={{
          WebkitAppRegion: 'no-drag',
          background: 'transparent',
          fontFamily: '"Kaiti SC", "STKaiti", "KaiTi", "Noto Serif SC", "Songti SC", "SimSun", serif',
          cursor: locked ? 'default' : 'move',
        } as CSSProperties}
        onMouseMove={onPetMouseMove}
        onMouseLeave={() => {
          if (!dragRef.current) { interactiveRef.current = false; desktop?.setHitTest(false) }
          // 延迟 400ms 隐去：掠过透明缝隙/正移向按钮时不闪退
          window.clearTimeout(leaveTimer.current)
          leaveTimer.current = window.setTimeout(() => {
            setHover(false)
            setMenu(null)
          }, 400)
        }}
        onPointerDown={(e) => {
          if (e.button !== 0 || (e.target as Element).closest('button, input, [data-pet-interactive]')) return
          downRef.current = { x: e.clientX, y: e.clientY }
          draggedRef.current = false
          if (locked || !interactiveRef.current || !desktop) return
          dragRef.current = { x: e.screenX, y: e.screenY }
          setGrabbed(true)
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          const drag = dragRef.current
          if (!drag) return
          if (Math.abs(e.screenX - drag.x) + Math.abs(e.screenY - drag.y) > 0) draggedRef.current = true
          dragVecRef.current = { x: e.screenX - drag.x, y: e.screenY - drag.y }
          desktop?.dragPet(e.screenX - drag.x, e.screenY - drag.y)
          dragRef.current = { x: e.screenX, y: e.screenY }
        }}
        onPointerUp={(e) => {
          dragRef.current = null
          dragVecRef.current = { x: 0, y: 0 }
          setGrabbed(false)
          if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
          onPetMouseMove(e)
        }}
        onPointerCancel={() => { dragRef.current = null; dragVecRef.current = { x: 0, y: 0 }; setGrabbed(false); desktop?.setHitTest(false) }}
        onClick={onPetClick}
        onDoubleClick={(e) => {
          // 双击小仙（非按钮）直接出外历练
          if ((e.target as HTMLElement).closest('button')) return
          const r = petBoxRef.current?.getBoundingClientRect()
          if (!r) return
          const x = e.clientX - r.left
          const y = e.clientY - r.top
          if (Math.abs(x - 180) <= 130 && y >= 160 && y <= 440) enterDungeon()
        }}
        onContextMenu={onPetContextMenu}
        title={locked ? '已锁定位置' : '按住拖动 · 戳我有惊喜 · 双击出外历练 · 右键更多仙务'}
      >
        {/* 突破窗口级金光：渡劫功成后 4 秒，整个桌面角落沐金 */}
        {pet.breakthroughAt > 0 && now - pet.breakthroughAt >= 0 && now - pet.breakthroughAt < 4000 && (
          <div
            className="pointer-events-none fixed inset-0 z-50"
            style={{
              background: 'radial-gradient(ellipse at 50% 62%, rgba(255,224,140,0.38), rgba(255,200,90,0.14) 45%, transparent 78%)',
              animation: 'btGlow 4s ease-out forwards',
            }}
          />
        )}
        {/* 360×500 舞台（桌宠窗口即此大小；浏览器预览时居中） */}
        <div ref={petBoxRef} className="absolute left-1/2 top-1/2 h-[500px] w-[360px] -translate-x-1/2 -translate-y-1/2">
          {/* 气泡：贴在小仙头顶，带小尾巴，6 秒自动隐去（悬停时常驻） */}
          <div
            className={`pointer-events-none absolute left-1/2 top-[96px] w-max max-w-[300px] -translate-x-1/2 transition-all duration-300 ${
              showBubble ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'
            }`}
          >
            <div className="pet-bubble truncate px-3 py-1.5 text-center text-[11px] tracking-wider text-[#ece4d0]/90" style={{ fontFamily: 'var(--kai)' }}>
              {bubbleText}
            </div>
            <div className="mx-auto h-2 w-2 -translate-y-1 rotate-45 border-b border-r border-[rgba(211,183,129,0.16)] bg-[#0e1311]/90" />
          </div>

          {/* 宠物本体（拖动把手） */}
          <div className="absolute inset-x-0 bottom-0 top-8 flex items-center justify-center">
            <PetCanvas ref={petCanvasRef} pet={pet} recentAction={recentAction} interactRef={interactRef} dancing={musicOn} bpm={bpm} look={pet.look} grabbed={grabbed} dragVecRef={dragVecRef} weather={weather} onReady={() => desktop?.rendererReady()} onError={(message) => desktop?.rendererFailed(message)} />
          </div>

          {/* ── 靠近才浮现的 UI ── */}
          <div
            data-testid="pet-reveal"
            style={{ visibility: reveal ? 'visible' : 'hidden' }}
            className={`pointer-events-none absolute inset-0 transition-all duration-200 ${
              reveal ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {/* 顶部：名牌 + 控制钮 */}
            <div className="absolute inset-x-0 top-0 flex items-start justify-between px-2 pt-1">
              <div
                className={`pet-chip flex items-center gap-2 px-2.5 py-1 text-xs transition-transform duration-200 ${
                  reveal ? 'translate-y-0' : '-translate-y-2'
                }`}
              >
                <span className="tracking-[0.2em] text-[#ece4d0]" style={{ fontFamily: 'var(--kai)' }}>{pet.name}</span>
                <span className="seal" style={{ fontSize: 10, padding: '1px 5px' }}>
                  {REALMS[pet.realm]}
                </span>
              </div>
              <div className="flex gap-1" data-pet-interactive
              style={{ ...noDrag, pointerEvents: 'auto' }}>
                <button
                  onClick={() => setLocked((v) => !v)}
                  className={`pet-chip px-1.5 py-0.5 text-xs ${locked ? 'text-[#d3b781]' : 'text-[#ece4d0]/55 hover:text-[#ece4d0]'}`}
                  style={locked ? { borderColor: 'rgba(211,183,129,0.5)' } : undefined}
                  title={locked ? '解锁：恢复拖动' : '锁定位置：防止误拖'}
                >
                  {locked ? '🔒' : '🔓'}
                </button>
                <button
                  onClick={toggleGhost}
                  className={`pet-chip px-1.5 py-0.5 text-xs ${ghost ? 'text-[#8fbfa8]' : 'text-[#ece4d0]/55 hover:text-[#ece4d0]'}`}
                  style={ghost ? { borderColor: 'rgba(143,191,168,0.5)' } : undefined}
                  title={ghost ? '关闭鼠标穿透' : '鼠标穿透：完全不挡操作（托盘可恢复）'}
                >
                  👻
                </button>
                <button
                  onClick={() => setChatOpen((v) => !v)}
                  className={`pet-chip px-1.5 py-0.5 text-xs ${chatOpen ? 'text-[#8fbfa8]' : 'text-[#ece4d0]/55 hover:text-[#ece4d0]'}`}
                  style={chatOpen ? { borderColor: 'rgba(143,191,168,0.5)' } : undefined}
                  title="和小仙聊天"
                >
                  💬
                </button>
                <button
                  onClick={() => navigate('home')}
                  className="pet-chip px-1.5 py-0.5 text-xs text-[#ece4d0]/55 hover:text-[#ece4d0]"
                  title="打开洞府（完整界面）"
                >
                  ⛶
                </button>
                <button
                  onClick={() => desktop?.quit()}
                  className="pet-chip px-1.5 py-0.5 text-xs text-[#ece4d0]/35 hover:text-[#c14b3a]"
                  title="退出"
                >
                  ×
                </button>
              </div>
            </div>

            {/* 功能弧：环绕小仙扇形浮出 */}
            {arc.map((b, i) => {
              const p = arcPos(i)
              return (
                <button
                  key={b.label}
                  onClick={b.fn}
                  className={`absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full transition-all duration-200 hover:scale-110 ${
                    reveal ? 'scale-100' : 'scale-50'
                  }`}
                  style={{
                    left: p.left, top: p.top, transitionDelay: `${i * 30}ms`, ...noDrag, pointerEvents: 'auto',
                    border: '1px solid rgba(211,183,129,0.35)',
                    background: 'radial-gradient(circle at 35% 30%, rgba(24,30,28,0.88), rgba(9,12,11,0.85))',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.5), inset 0 0 6px rgba(211,183,129,0.08)',
                    backdropFilter: 'blur(6px)',
                  }}
                  title={b.label}
                >
                  <span className="text-base leading-none">{b.icon}</span>
                  <span className="mt-0.5 text-[9px] tracking-widest text-[#ece4d0]/70" style={{ fontFamily: 'var(--kai)' }}>{b.label}</span>
                </button>
              )
            })}
            <button
              onClick={enterDungeon}
              className={`absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full transition-all duration-200 hover:scale-110 ${
                reveal ? 'scale-100' : 'scale-50'
              }`}
              style={{
                left: dungeonPos.left, top: dungeonPos.top, transitionDelay: '120ms', ...noDrag, pointerEvents: 'auto',
                border: '1px solid rgba(193,75,58,0.55)',
                background: 'radial-gradient(circle at 35% 30%, rgba(52,20,16,0.9), rgba(20,8,7,0.88))',
                boxShadow: '0 2px 12px rgba(193,75,58,0.3), inset 0 0 8px rgba(193,75,58,0.15)',
                backdropFilter: 'blur(6px)',
              }}
              title="进入妖兽秘境（消耗体力25）"
            >
              <span className="text-base leading-none">⚔️</span>
              <span className="mt-0.5 text-[9px] tracking-widest text-[#e8b4a8]/85" style={{ fontFamily: 'var(--kai)' }}>历练</span>
            </button>

            {/* 底部：修为细条 + 提示 */}
            <div
              className={`absolute inset-x-0 bottom-2 flex flex-col items-center gap-1 transition-all duration-200 ${
                reveal ? 'translate-y-0' : 'translate-y-3'
              }`}
              data-pet-interactive
              style={{ ...noDrag, pointerEvents: 'auto' }}
            >
              <div className="stat-track w-44">
                <div
                  className="stat-fill bg-gradient-to-r from-[#5d8f74] to-[#a8d4b8] text-[#8fbfa8]"
                  style={{ width: `${cultPct}%` }}
                />
              </div>
              <div className="text-[9px] tracking-[0.35em] text-[#d3b781]/35" style={{ fontFamily: 'var(--kai)' }}>右键唤出仙务菜单</div>
            </div>
          </div>

          {/* ── 聊天小窗 ── */}
          {chatOpen && (
            <div
              className="ink-card absolute bottom-10 left-1/2 z-40 w-[320px] -translate-x-1/2 overflow-hidden"
              data-pet-interactive
              style={{ ...noDrag, pointerEvents: 'auto' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid rgba(211,183,129,0.14)' }}>
                <span className="ink-title" style={{ fontSize: 11 }}>与 {pet.name} 私聊</span>
                <button
                  onClick={() => setChatOpen(false)}
                  className="text-xs text-[#ece4d0]/40 transition hover:text-[#ece4d0]"
                >
                  ×
                </button>
              </div>
              <div className="max-h-40 space-y-1.5 overflow-y-auto px-3 py-2">
                {chatLog.length === 0 && (
                  <div className="py-2 text-center text-[11px] text-[#ece4d0]/30">
                    戳一戳不如聊一聊，跟 {pet.name} 说点什么吧～
                  </div>
                )}
                {chatLog.map((c, i) => (
                  <div key={i} className={`flex ${c.who === 'me' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] px-2.5 py-1 text-[11px] leading-relaxed ${
                        c.who === 'me'
                          ? 'rounded-md rounded-br-none bg-[rgba(143,191,168,0.18)] text-[#ece4d0]'
                          : 'rounded-md rounded-bl-none border border-[rgba(211,183,129,0.14)] bg-black/40 text-[#ece4d0]/85'
                      }`}
                    >
                      {c.text}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5 px-2.5 py-2" style={{ borderTop: '1px solid rgba(211,183,129,0.14)' }}>
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') sendChat() }}
                  maxLength={60}
                  placeholder="说点什么……"
                  className="flex-1 rounded border border-[rgba(211,183,129,0.18)] bg-black/40 px-2.5 py-1 text-[11px] text-[#ece4d0] outline-none placeholder:text-[#ece4d0]/25 focus:border-[rgba(211,183,129,0.45)]"
                />
                <button
                  onClick={sendChat}
                  className="btn-jade px-2.5 text-[11px]"
                >
                  发送
                </button>
              </div>
            </div>
          )}

          {/* ── 右键仙务菜单 ── */}
          {menu && (
            <div
              data-pet-interactive
              className="ink-card absolute z-50 w-[196px] overflow-hidden py-1.5"
              style={{ left: menu.x, top: menu.y, ...noDrag, pointerEvents: 'auto' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 px-3 pb-1.5 pt-1">
                <span className="seal">仙务</span>
                <span className="text-[10px] tracking-[0.25em] text-[#ece4d0]/40" style={{ fontFamily: 'var(--kai)' }}>
                  {pet.name}
                </span>
              </div>
              <hr className="gold-sep" />
              {menuItems.map((it, i) =>
                'sep' in it ? (
                  <hr key={i} className="gold-sep" />
                ) : (
                  <button
                    key={i}
                    onClick={() => {
                      it.fn()
                      setMenu(null)
                    }}
                    className={`menu-item flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs ${
                      it.danger ? 'text-[#c14b3a]/85 hover:bg-[rgba(193,75,58,0.12)]' : 'text-[#ece4d0]/85 hover:bg-[rgba(211,183,129,0.08)]'
                    }`}
                  >
                    <span className="w-4 text-center">{it.icon}</span>
                    <span className="flex-1 tracking-wider">{it.label}</span>
                    {it.check && <span className="text-[#d3b781]">✓</span>}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

}
