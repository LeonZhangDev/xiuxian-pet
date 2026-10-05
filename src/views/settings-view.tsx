import { useCallback, useEffect, useRef, useState } from 'react'
import PetCanvas from '../game/PetCanvas'
import { SAVE_KEY } from '../game/pet-store'
import { REALMS } from '../game/data'
import { useMusicState } from '../hooks/use-music'
import { useUiSettings } from '../hooks/use-ui-settings'
import { useWeather } from '../hooks/use-weather'
import { resetSettings } from '../lib/settings'
import type { ViewProps } from './view-types'

// ─────────────────────────────────────────────────────────────
// 设置页的设计取舍（写给后来改这块的人）
// · 左预览右控件：人对"开关"的后果需要即时可见反馈，改完隔一屏去看等于没有反馈。
// · 控件右对齐成一条竖线：扫视时视线只走一条轴（古登堡图表的"终点区"），
//   比左标签右开关交错排布节省一半眼动。行高 ≥44px 满足触摸热区。
// · 分组按心智模型（观感 / 音律 / 洞府）而非按实现模块，用户找的是"我要改什么"，
//   不是"代码里它归谁管"。
// · 颜色只承担三种语义：金=可交互且当前生效，灰=中性未激活，朱砂=不可逆。
//   不再多一种颜色，否则"重要"就贬值了。
// · 全部即时生效、无保存按钮：省掉"改完忘了保存"这一整类错误，
//   代价是撤销要靠"恢复默认"，所以那一颗按钮放在末尾并二次确认。
// ─────────────────────────────────────────────────────────────

type Option<T extends string> = { value: T; label: string; hint?: string }

function Section({ title, seal, children }: { title: string; seal: string; children: React.ReactNode }) {
  return (
    <section className="ink-card px-5 py-4">
      <div className="ink-title mb-3">
        <span className="seal" style={{ letterSpacing: '0.06em' }}>{seal}</span>
        {title}
      </div>
      <div className="divide-y divide-[rgba(211,183,129,0.08)]">{children}</div>
    </section>
  )
}

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-6 py-2.5">
      <div className="min-w-0">
        <div className="text-[13px] tracking-[0.12em] text-[#ece4d0]/90">{label}</div>
        {desc && <div className="mt-0.5 text-[11px] leading-relaxed text-[#ece4d0]/40">{desc}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="flex h-11 w-[76px] items-center gap-1.5 rounded-full border px-1 transition-colors"
      style={{
        borderColor: on ? 'rgba(211,183,129,0.55)' : 'rgba(236,228,208,0.14)',
        background: on ? 'linear-gradient(90deg, rgba(211,183,129,0.22), rgba(143,191,168,0.14))' : 'rgba(0,0,0,0.4)',
      }}
    >
      <span
        className="h-8 w-8 rounded-full transition-transform duration-200"
        style={{
          transform: `translateX(${on ? 32 : 0}px)`,
          background: on ? 'linear-gradient(150deg, #e6cf9a, #d3b781)' : 'linear-gradient(150deg, #4a504d, #333a37)',
          boxShadow: on ? '0 0 10px rgba(211,183,129,0.45)' : 'none',
        }}
      />
      <span className="w-6 text-[10px] tracking-widest" style={{ color: on ? '#d3b781' : 'rgba(236,228,208,0.3)' }}>
        {on ? '开' : '关'}
      </span>
    </button>
  )
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: Option<T>[]; onChange: (v: T) => void }) {
  return (
    <div className="flex overflow-hidden rounded border border-[rgba(211,183,129,0.25)]" role="radiogroup">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            title={o.hint}
            onClick={() => onChange(o.value)}
            className="min-h-[40px] px-3 text-xs transition"
            style={{
              background: active ? 'rgba(211,183,129,0.2)' : 'rgba(0,0,0,0.3)',
              color: active ? '#d3b781' : 'rgba(236,228,208,0.45)',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export default function SettingsView({ pet, navigate, dispatch }: ViewProps) {
  const [settings, set] = useUiSettings()
  const { systemPlaying, dancing, bpm, track, remembered, tap, setBpm, setEnabled, setManual } = useMusicState()
  const [tapHint, setTapHint] = useState<string | null>(null)
  const realWeather = useWeather()
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => { if (!toast) return; const id = window.setTimeout(() => setToast(null), 2200); return () => window.clearTimeout(id) }, [toast])
  useEffect(() => { if (!tapHint) return; const id = window.setTimeout(() => setTapHint(null), 2500); return () => window.clearTimeout(id) }, [tapHint])

  const previewWeather = settings.previewWeather === 'auto' ? realWeather : settings.previewWeather === 'clear' ? null : settings.previewWeather

  // ── 模拟窗拖拽：直接跟手，不做惯性（预览不是游戏，惯性只会让人抓不住）──
  const stageRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 24, y: 56 })
  const drag = useRef<{ dx: number; dy: number } | null>(null)
  const onDragStart = useCallback((e: React.PointerEvent) => {
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [pos.x, pos.y])
  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return
    const box = stageRef.current?.getBoundingClientRect()
    const next = { x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy }
    if (box) {
      next.x = Math.max(-40, Math.min(box.width - 120, next.x))
      next.y = Math.max(0, Math.min(box.height - 90, next.y))
    }
    setPos(next)
  }, [])
  const onDragEnd = useCallback(() => { drag.current = null }, [])

  const exportSave = () => {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) { setToast('本地没有存档可导出'); return }
    const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `xiuxian-pet-${pet.name}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setToast('存档已导出')
  }
  const importSave = async (file: File) => {
    try {
      const text = await file.text()
      JSON.parse(text) // 先校验再落盘，避免写坏存档
      if (!confirm('导入会覆盖当前洞府进度，确定吗？')) return
      localStorage.setItem(SAVE_KEY, text)
      setToast('导入成功，即将重载洞府')
      window.setTimeout(() => window.location.reload(), 800)
    } catch {
      setToast('这不像一份存档（JSON 解析失败）')
    }
  }

  return (
    <main
      className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 pb-12 lg:grid-cols-[380px_1fr]"
      style={{ fontFamily: '"Kaiti SC", "STKaiti", "KaiTi", "Noto Serif SC", "Songti SC", "SimSun", serif' }}
    >
      {/* ── 左：模拟窗（实时预览，可拖动）── */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div
          ref={stageRef}
          className="relative h-[420px] overflow-hidden rounded-lg border border-[rgba(211,183,129,0.16)]"
          style={{
            background:
              'radial-gradient(ellipse at 30% 15%, rgba(143,191,168,0.1), transparent 60%), linear-gradient(160deg, #101614, #080b0a)',
          }}
        >
          {/* 窗格纹理：暗示这是一块"桌面"，而不是又一个设置面板 */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage: 'linear-gradient(rgba(211,183,129,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(211,183,129,0.05) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />
          {settings.showPreview ? (
            <div
              className="absolute w-[200px] select-none rounded-md border border-[rgba(211,183,129,0.28)] bg-[rgba(10,13,12,0.86)] shadow-[0_10px_30px_rgba(0,0,0,0.6)] backdrop-blur-sm"
              style={{ left: pos.x, top: pos.y, transform: `scale(${settings.petScale})`, transformOrigin: 'top left' }}
            >
              <div
                onPointerDown={onDragStart}
                onPointerMove={onDragMove}
                onPointerUp={onDragEnd}
                onPointerCancel={onDragEnd}
                className="flex cursor-grab items-center justify-between px-2.5 py-1.5 active:cursor-grabbing"
                style={{ borderBottom: '1px solid rgba(211,183,129,0.14)', touchAction: 'none' }}
                title="按住可把小仙拖到桌面任意角落"
              >
                <span className="text-[11px] tracking-[0.2em] text-[#ece4d0]/55">{pet.name} · {REALMS[pet.realm]}</span>
                <span className="flex gap-1">
                  <i className="h-2 w-2 rounded-full bg-[rgba(211,183,129,0.5)]" />
                  <i className="h-2 w-2 rounded-full bg-[rgba(143,191,168,0.5)]" />
                </span>
              </div>
              <PetCanvas pet={pet} recentAction={null} dancing={dancing} bpm={bpm} look={pet.look} weather={previewWeather} />
              <div className="px-2.5 pb-2 text-center text-[10px] tracking-widest text-[#ece4d0]/35">
                {dancing ? '🎶 随乐起舞中' : previewWeather ? `天气：${previewWeather === 'rain' ? '落雨' : '飘雪'}` : '静立待机'}
              </div>
            </div>
          ) : (
            <div className="grid h-full place-items-center text-xs tracking-[0.3em] text-[#ece4d0]/25">模拟窗已收起</div>
          )}

          <div className="absolute bottom-2 left-3 text-[10px] tracking-widest text-[#ece4d0]/25">
            拖动标题栏试试 · 此窗只用于预览，不影响真实桌宠
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 rounded border border-[rgba(211,183,129,0.14)] bg-black/30 px-3 py-2">
          <span className="shrink-0 text-[11px] tracking-widest text-[#ece4d0]/45">系统音律</span>
          <span className="truncate text-[11px]" style={{ color: systemPlaying ? '#d3b781' : 'rgba(236,228,208,0.35)' }} title={track}>
            {track ? `${track.slice(0, 24)}${track.length > 24 ? '…' : ''}` : systemPlaying ? '正在播放' : '未检测到'}
          </span>
        </div>
      </aside>

      {/* ── 右：分组设置 ── */}
      <div className="flex flex-col gap-5">
        <header className="flex items-end justify-between">
          <div>
            <h2 className="text-lg tracking-[0.4em] text-[#ece4d0]">设置</h2>
            <p className="mt-1 text-[11px] tracking-wider text-[#ece4d0]/35">改动即时生效 · 只影响这台机器的观感，不动修为进度</p>
          </div>
          <button onClick={() => navigate('home')} className="btn-jade px-3 py-1.5 text-xs">返回洞府</button>
        </header>

        <Section title="音律" seal="律">
          <Row label="随乐起舞" desc="系统播放器放歌时，小仙跟着起舞">
            <Toggle on={settings.danceEnabled} onChange={setEnabled} label="随乐起舞" />
          </Row>
          <Row label="不听歌也跳" desc="手动开舞，用于试动作或截图">
            <Toggle on={settings.danceManual} onChange={setManual} label="手动起舞" />
          </Row>
          <Row label="停歌后立刻收势" desc="关掉则延迟三秒渐停，避免切歌时一顿一顿">
            <Toggle on={settings.danceAutoOff} onChange={(v) => set({ danceAutoOff: v })} label="停歌立刻收势" />
          </Row>
          <Row
            label="起舞拍速"
            desc={remembered ? `本曲已记住 ${bpm} BPM，下次播到自动对拍` : '系统不提供音频波形，拍速由你告诉小仙'}
          >
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={60}
                max={180}
                step={2}
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value))}
                className="h-11 w-32 accent-[#d3b781]"
                aria-label="起舞拍速"
              />
              <span className="w-16 text-right text-xs" style={{ color: remembered ? '#d3b781' : 'rgba(236,228,208,0.55)' }}>
                {bpm} BPM
              </span>
            </div>
          </Row>
          <Row label="跟着音乐点拍" desc="放一首歌，跟着鼓点连点四下，小仙就知道该跳多快">
            <div className="flex items-center gap-3">
              {tapHint && <span className="text-[10px] text-[#8fbfa8]">{tapHint}</span>}
              <button
                onClick={() => {
                  const got = tap()
                  setTapHint(got ? `已记为 ${got} BPM` : '再点几下……')
                }}
                className="btn-jade min-h-[40px] px-4 text-xs"
                aria-label="跟着音乐点拍"
              >
                🎵 点拍
              </button>
            </div>
          </Row>
        </Section>

        <Section title="观感" seal="观">
          <Row label="身量" desc="洞府页与预览窗里小仙的显示大小（桌宠窗不做缩放，否则点击命中会错位）">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0.8}
                max={1.3}
                step={0.05}
                value={settings.petScale}
                onChange={(e) => set({ petScale: Number(e.target.value) })}
                className="h-11 w-32 accent-[#d3b781]"
                aria-label="小仙身量"
              />
              <span className="w-10 text-right text-xs text-[#d3b781]">{Math.round(settings.petScale * 100)}%</span>
            </div>
          </Row>
          <Row label="凝神模式" desc="压掉飘落、呼吸等非必要动效，长时间盯屏更省神">
            <Toggle on={settings.reduceMotion} onChange={(v) => set({ reduceMotion: v })} label="凝神模式" />
          </Row>
          <Row label="模拟窗天气" desc="只在设置页的预览窗里生效">
            <Segmented
              value={settings.previewWeather}
              onChange={(v) => set({ previewWeather: v })}
              options={[
                { value: 'auto', label: '随实况', hint: '跟随本机定位的真实天气' },
                { value: 'clear', label: '晴' },
                { value: 'rain', label: '雨' },
                { value: 'snow', label: '雪' },
              ]}
            />
          </Row>
          <Row label="常驻模拟窗" desc="关掉则在设置页隐藏预览">
            <Toggle on={settings.showPreview} onChange={(v) => set({ showPreview: v })} label="常驻模拟窗" />
          </Row>
        </Section>

        <Section title="洞府" seal="府">
          <Row label="导出存档" desc="存一份 JSON，换机器时可带走">
            <button onClick={exportSave} className="btn-jade min-h-[40px] px-4 text-xs">导出</button>
          </Row>
          <Row label="导入存档" desc="会覆盖当前进度，导入前会再问一次">
            <label className="btn-jade min-h-[40px] cursor-pointer px-4 text-xs">
              导入
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void importSave(f); e.target.value = '' }}
              />
            </label>
          </Row>
          <Row label="恢复默认设置" desc="只重置本页选项，修为不受影响">
            <button
              onClick={() => { if (confirm('恢复本页全部设置为默认？')) { resetSettings(); setToast('已恢复默认') } }}
              className="min-h-[40px] rounded border border-[rgba(211,183,129,0.3)] px-4 text-xs text-[#ece4d0]/60 transition hover:border-[rgba(211,183,129,0.6)] hover:text-[#ece4d0]"
            >
              恢复默认
            </button>
          </Row>
          <Row label="兵解重修" desc="清空全部修为，不可恢复">
            <button
              onClick={() => { if (confirm('确定要兵解重修吗？（清空存档）')) dispatch({ type: 'reset' }) }}
              className="min-h-[40px] rounded border border-[rgba(193,75,58,0.45)] px-4 text-xs text-[#c14b3a] transition hover:bg-[rgba(193,75,58,0.12)]"
            >
              兵解
            </button>
          </Row>
        </Section>

        <p className="pb-2 text-center text-[10px] tracking-widest text-[#ece4d0]/20">设置随改随存 · 与修为进度分开保管</p>
      </div>

      {toast && (
        <div
          role="status"
          className="fixed bottom-8 left-1/2 -translate-x-1/2 rounded border border-[rgba(211,183,129,0.35)] bg-[rgba(10,13,12,0.92)] px-5 py-2 text-xs tracking-widest text-[#d3b781]"
        >
          {toast}
        </div>
      )}
    </main>
  )
}
