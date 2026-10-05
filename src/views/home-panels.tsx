import { useEffect, useState } from 'react'
import { desktop } from '../lib/desktop-bridge'
import { ENEMY_INFO, EQUIP_POOL, COSMETICS, type PetState, type PetAction } from '../game/data'
import { LOOKS } from '../game/looks'
import { getSkinPacks, loadUserPacks, type LoadedPack } from '../game/packs'
import defaultSkinUrl from '../assets/pet-idle-open.webp'
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

const ENEMY_SPRITES: Record<string, string> = {
  wolf: enemyWolfUrl,
  spider: enemySpiderUrl,
  spirit: enemySpiritUrl,
  golem: enemyGolemUrl,
  boss: enemyBossUrl,
  iceserpent: enemyIceserpentUrl,
  frostmoth: enemyFrostmothUrl,
  iceboss: enemyIcebossUrl,
  guworm: enemyGuwormUrl,
  silkworm: enemySilkwormUrl,
  plaguetoad: enemyPlaguetoadUrl,
  guboss: enemyGubossUrl,
}

/** 换装配色：选一套气韵，立绘与灵光一起变 */
export function LookPanel({ pet, dispatch }: { pet: PetState; dispatch: (a: PetAction) => void }) {
  const active = pet.look ?? 'plain'
  return (
    <div className="ink-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="ink-title">形象 · 配色</span>
        <span className="text-[10px] text-emerald-100/30">{LOOKS.find((l) => l.id === active)?.name ?? '本来面貌'}</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {LOOKS.map((l) => {
          const on = active === l.id
          return (
            <button
              key={l.id}
              onClick={() => dispatch({ type: 'setLook', look: l.id === 'plain' ? null : l.id })}
              title={l.desc}
              className="flex flex-col items-center gap-1 rounded-lg px-1 py-2 transition"
              style={{
                border: `1px solid ${on ? 'rgba(211,183,129,0.6)' : 'rgba(211,183,129,0.14)'}`,
                background: on ? 'rgba(211,183,129,0.1)' : 'rgba(0,0,0,0.25)',
              }}
            >
              <span
                className="h-6 w-6 rounded-full"
                style={{
                  background: l.id === 'plain' ? 'linear-gradient(150deg, #ece4d0, #8fbfa8)' : l.tint,
                  boxShadow: `0 0 8px ${l.tint}`,
                }}
              />
              <span className="text-[10px]" style={{ color: on ? '#d3b781' : 'rgba(236,228,208,0.45)' }}>{l.name}</span>
            </button>
          )
        })}
      </div>
      <div className="mt-2 text-[10px] leading-relaxed text-emerald-100/25">
        立绘为整图，当前是整体染色（灵光同步换色）；发型/服饰的分层换装需资源包提供分层素材，契约已留。
      </div>
    </div>
  )
}

export function CosmeticPanel({ pet, dispatch }: { pet: PetState; dispatch: (a: PetAction) => void }) {
  const [open, setOpen] = useState(false)
  const owned = pet.cosmetics?.owned ?? []
  return (
    <div className="ink-card p-4">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between">
        <span className="ink-title">外观坊</span>
        <span className="text-[10px] text-emerald-100/30">
          {owned.length}/{COSMETICS.length} {open ? '▲' : '▼'}
        </span>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {COSMETICS.map((c) => {
            const has = owned.includes(c.id)
            const active = pet.cosmetics?.active === c.id
            const afford = Object.entries(c.cost).every(([k, n]) => (pet.neidan?.[k] ?? 0) >= n)
            return (
              <div key={c.id} className="flex items-center gap-2 rounded-lg border border-pink-900/30 bg-black/20 p-2">
                <span className="text-xl">{c.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-pink-100/90">
                    {c.name}
                    {active && <span className="ml-1 text-amber-300">· 佩戴中</span>}
                  </div>
                  <div className="text-[10px] text-emerald-100/40">{c.desc}</div>
                  {!has && (
                    <div className="mt-0.5 text-[10px] text-emerald-100/50">
                      {Object.entries(c.cost)
                        .map(([k, n]) => `${ENEMY_INFO[k]?.name ?? k}内丹 ${pet.neidan?.[k] ?? 0}/${n}`)
                        .join(' · ')}
                    </div>
                  )}
                </div>
                {has ? (
                  <button
                    onClick={() => dispatch({ type: 'wearCosmetic', id: active ? null : c.id })}
                    className="shrink-0 rounded border border-pink-700/50 px-2 py-1 text-[10px] text-pink-100/80 transition hover:bg-pink-900/30"
                  >
                    {active ? '卸下' : '佩戴'}
                  </button>
                ) : (
                  <button
                    disabled={!afford}
                    onClick={() => dispatch({ type: 'redeemCosmetic', id: c.id })}
                    className={`shrink-0 rounded border px-2 py-1 text-[10px] transition ${
                      afford
                        ? 'border-amber-600/60 text-amber-200 hover:bg-amber-900/30'
                        : 'border-emerald-900/40 text-emerald-100/25'
                    }`}
                  >
                    兑换
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function CodexPanel({ pet }: { pet: PetState }) {
  const [open, setOpen] = useState(false)
  const kills = pet.codex?.kills ?? {}
  const equips = pet.codex?.equips ?? []
  const enemyKinds = Object.keys(ENEMY_INFO)
  const found = enemyKinds.filter((k) => (kills[k] ?? 0) > 0).length
  return (
    <div className="ink-card p-4">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between">
        <span className="ink-title">万象图鉴</span>
        <span className="text-[10px] text-emerald-100/30">
          妖兽 {found}/{enemyKinds.length} · 法宝 {equips.length}/{EQUIP_POOL.length} {open ? '▲' : '▼'}
        </span>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          {/* 妖兽 */}
          <div className="grid grid-cols-4 gap-2">
            {enemyKinds.map((k) => {
              const n = kills[k] ?? 0
              const info = ENEMY_INFO[k]
              const seen = n > 0
              return (
                <div
                  key={k}
                  title={seen ? `${info.desc}\n栖息地：${info.habitat}` : '尚未遭遇——去秘境对应区域寻它'}
                  className={`rounded-lg border p-1.5 text-center transition ${
                    seen ? 'border-violet-800/50 bg-black/30' : 'border-dashed border-emerald-900/40 bg-black/10'
                  }`}
                >
                  <img
                    src={ENEMY_SPRITES[k]}
                    alt={info.name}
                    className={`mx-auto h-12 w-12 object-contain ${seen ? '' : 'opacity-25 grayscale'}`}
                  />
                  <div className={`mt-0.5 text-[10px] ${seen ? 'text-violet-100/90' : 'text-emerald-100/25'}`}>
                    {seen ? info.name : '？？？'}
                  </div>
                  <div className="text-[9px] text-emerald-100/35">{seen ? `斩 ×${n}` : info.habitat}</div>
                </div>
              )
            })}
          </div>
          {/* 法宝 */}
          <div className="grid grid-cols-3 gap-2">
            {EQUIP_POOL.map((it) => {
              const got = equips.includes(it.id)
              return (
                <div
                  key={it.id}
                  title={got ? it.desc : '击杀赤炎蛟有机会获得'}
                  className={`rounded-lg border px-2 py-1.5 text-center ${
                    got ? 'border-amber-800/50 bg-amber-950/20' : 'border-dashed border-emerald-900/40 bg-black/10'
                  }`}
                >
                  <div className={`text-sm ${got ? '' : 'opacity-30 grayscale'}`}>{it.icon}</div>
                  <div className={`text-[10px] ${got ? 'text-amber-100/90' : 'text-emerald-100/25'}`}>
                    {got ? it.name : '？？？'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function CompanionPanel({ pet, dispatch }: { pet: PetState; dispatch: (a: PetAction) => void }) {
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState('')
  const comp = pet.companion ?? { name: '小满', bond: 0 }
  const bond = comp.bond ?? 0
  const tier = bond >= 80 ? '生死之交' : bond >= 50 ? '莫逆于心' : bond >= 20 ? '志同道合' : '萍水相逢'
  const save = () => {
    if (name.trim()) dispatch({ type: 'renameCompanion', name })
    setRenaming(false)
    setName('')
  }
  return (
    <div className="ink-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="ink-title">仙友同行</span>
        <span className="text-[10px] text-emerald-100/30">好感越高，秘境助战越强</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-2xl">🧑‍🤝‍🧑</span>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm">
            {renaming ? (
              <>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') save() }}
                  maxLength={8}
                  placeholder={comp.name}
                  className="w-24 rounded border border-pink-800/50 bg-black/40 px-2 py-0.5 text-sm text-pink-100 outline-none focus:border-pink-500/60"
                />
                <button onClick={save} className="text-xs text-pink-300 hover:text-pink-100">好</button>
              </>
            ) : (
              <>
                <span className="text-pink-200">{comp.name}</span>
                <button
                  onClick={() => { setRenaming(true); setName(comp.name) }}
                  className="text-[10px] text-emerald-100/30 transition hover:text-pink-300"
                  title="给仙友改名"
                >
                  ✏️ 改名
                </button>
              </>
            )}
            <span className="text-[10px] text-pink-100/40">· {tier}</span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-black/50">
            <div
              className="h-full rounded-full bg-gradient-to-r from-pink-500/70 to-rose-400/80 transition-all"
              style={{ width: `${bond}%` }}
            />
          </div>
          <div className="mt-1 text-[10px] text-pink-100/40">
            好感 {bond}/100 · 助战剑气 {Math.round((0.5 + bond / 200) * 100)}% 威力
          </div>
        </div>
        <button
          onClick={() => dispatch({ type: 'feedCompanion' })}
          className="shrink-0 rounded-lg border border-pink-800/50 bg-pink-950/40 px-3 py-2 text-xs text-pink-100/90 transition hover:border-pink-500/60"
          title="灵草-1，好感+8"
        >
          🍑 分它一颗灵果
        </button>
      </div>
    </div>
  )
}

// ── 形象阁：皮肤包选择（本来面貌 + 内置/用户皮肤包；缺的姿态回退默认动画）──
export function SkinPanel({ pet, dispatch }: { pet: PetState; dispatch: (a: PetAction) => void }) {
  const [skins, setSkins] = useState<LoadedPack[]>([])
  useEffect(() => {
    void loadUserPacks().then(() => setSkins(getSkinPacks()))
  }, [])
  const card = (active: boolean, name: string, img: string | null, onClick: () => void) => (
    <button
      key={name}
      onClick={onClick}
      className={`flex w-24 flex-col items-center gap-1 rounded-md border p-2 transition ${
        active
          ? 'border-[rgba(211,183,129,0.6)] bg-[rgba(211,183,129,0.12)]'
          : 'border-[rgba(211,183,129,0.15)] bg-black/25 hover:border-[rgba(211,183,129,0.4)]'
      }`}
    >
      {img ? (
        <img src={img} alt={name} className="h-16 w-16 object-contain" draggable={false} />
      ) : (
        <span className="flex h-16 w-16 items-center justify-center text-3xl">🧝</span>
      )}
      <span className={`text-xs ${active ? 'text-[#d3b781]' : 'text-[#ece4d0]/70'}`}>{name}</span>
      {active && <span className="seal" style={{ fontSize: 9, padding: '0 4px' }}>在用</span>}
    </button>
  )
  return (
    <div className="ink-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="ink-title">形象阁</span>
        <span className="text-[10px] text-[#ece4d0]/30">皮肤包放入 packs 目录即自动收录</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {card(!pet.skin, '本来面貌', defaultSkinUrl, () => dispatch({ type: 'setSkin', skin: null }))}
        {skins.map((s) => {
          const preview = s.poses?.['idleOpen'] ?? s.poses?.['idle'] ?? s.frames?.[0] ?? null
          return card(pet.skin === s.id, s.name, preview ? s.resolve(preview) : null, () => dispatch({ type: 'setSkin', skin: s.id }))
        })}
      </div>
    </div>
  )
}

export function DiaryPanel({ pet }: { pet: PetState }) {  const today = new Date().toISOString().slice(0, 10)
  const d = pet.diary
  const dKills = d?.day === today ? Math.max(0, pet.kills - d.kills) : 0
  const dWins = d?.day === today ? Math.max(0, pet.victories - d.victories) : 0
  const dFocus = pet.focus.todayDay === today ? pet.focus.todayCount : 0
  const last = pet.diaryLast
  return (
    <div className="ink-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="ink-title">小仙日记</span>
        <span className="text-[10px] text-emerald-100/30">每天自动记一页手账</span>
      </div>
      <div
        className="rounded-lg border border-[rgba(211,183,129,0.4)] px-3 py-2"
        style={{
          background: 'linear-gradient(135deg, #f5ecd7 0%, #efe3c6 55%, #e7d7b2 100%)',
          boxShadow: 'inset 0 0 26px rgba(150,118,60,0.18), 0 2px 8px rgba(0,0,0,0.35)',
        }}
      >
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] tracking-widest text-[#8a6d3b]">📖 今日 · {today}</span>
          <span className="seal" style={{ fontSize: 10, padding: '1px 5px' }}>日记</span>
        </div>
        <div className="space-y-0.5 text-xs text-[#5b4a2a]" style={{ fontFamily: 'var(--kai)' }}>
          <div>⚔️ 斩妖 {dKills} 头{dWins > 0 ? ` · 大捷 ${dWins} 场` : ''}</div>
          <div>🍅 闭关专注 {dFocus} 轮 · 💎 灵石 {pet.stones}</div>
          <div>
            {pet.mood >= 70 ? '😊 心情愉悦，灵气充盈' : pet.mood >= 40 ? '😐 心绪平和' : '😞 有些闷闷不乐，该陪陪它了'}
            {pet.secluding ? ' · 正在闭关中' : ''}
          </div>
        </div>
      </div>
      {last && (
        <div className="mt-2 rounded-lg border border-emerald-900/30 bg-black/20 px-3 py-2">
          <div className="mb-1 text-[10px] tracking-widest text-emerald-100/30">📔 昨日 · {last.day}</div>
          <div className="space-y-0.5 text-xs text-emerald-100/50">
            {last.lines.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
      )}
    </div>
  )
}

export function TodoPanel({ pet, dispatch }: { pet: PetState; dispatch: (a: PetAction) => void }) {
  const [text, setText] = useState('')
  const todos = pet.todos ?? []
  const pending = todos.filter((t) => !t.done)
  const done = todos.filter((t) => t.done)
  const add = () => {
    if (!text.trim()) return
    dispatch({ type: 'addTodo', text })
    setText('')
  }
  return (
    <div className="ink-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="ink-title">历练清单 · 待办</span>
        <span className="text-[10px] text-emerald-100/30">
          未完 {pending.length} · 已毕 {done.length}（完成：修为+10 灵石+2）
        </span>
      </div>
      <div className="mb-2 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add() }}
          maxLength={40}
          placeholder="写下一件要做的事，回车挂上清单……"
          className="flex-1 rounded-lg border border-cyan-900/40 bg-black/40 px-3 py-1.5 text-sm text-emerald-100 outline-none placeholder:text-emerald-100/25 focus:border-cyan-600/50"
        />
        <button
          onClick={add}
          className="rounded-lg border border-cyan-800/50 bg-cyan-950/40 px-4 text-sm text-cyan-100/90 transition hover:border-cyan-500/60"
        >
          挂上
        </button>
      </div>
      {todos.length === 0 ? (
        <div className="py-2 text-xs text-emerald-100/25">清单空空如也。今日事今日毕，也是一件修行。</div>
      ) : (
        <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
          {[...pending, ...done].map((t) => (
            <div
              key={t.id}
              className={`group flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition ${
                t.done
                  ? 'border-emerald-900/30 bg-black/20 text-emerald-100/35'
                  : 'border-cyan-900/30 bg-black/30 text-emerald-100/85'
              }`}
            >
              <button
                onClick={() => dispatch({ type: 'toggleTodo', id: t.id })}
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] transition ${
                  t.done
                    ? 'border-emerald-500/60 bg-emerald-700/40 text-emerald-200'
                    : 'border-cyan-700/60 hover:border-cyan-400/70'
                }`}
                title={t.done ? '标记为未完（修为-10）' : '完成（修为+10 灵石+2）'}
              >
                {t.done ? '✓' : ''}
              </button>
              <span className={`flex-1 truncate ${t.done ? 'line-through' : ''}`}>{t.text}</span>
              <button
                onClick={() => dispatch({ type: 'removeTodo', id: t.id })}
                className="text-emerald-100/20 opacity-0 transition group-hover:opacity-100 hover:text-red-300"
                title="移除"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** 近 7 日专注账：从今天倒推，缺勤的日子留空柱 */
function last7(now: number) {
  const out: { key: string; label: string; m: number; r: number }[] = []
  const names = ['日', '一', '二', '三', '四', '五', '六']
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 86400000)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    out.push({ key, label: names[d.getDay()], m: 0, r: 0 })
  }
  return out
}

/** 连续闭关天数：今天没练就从昨天往前算，避免"今天还没开始"打断连续记录 */
function streakOf(log: Record<string, { m: number; r: number }>, now: number) {
  let n = 0
  for (let i = 0; i < 365; i++) {
    const d = new Date(now - i * 86400000)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (log[key] && log[key].m > 0) { n++; continue }
    if (i === 0) continue // 今天尚未开张，不算断
    break
  }
  return n
}

export function FocusPanel({ pet, dispatch, now }: { pet: PetState; dispatch: (a: PetAction) => void; now: number }) {
  const f = pet.focus
  const remainMs = Math.max(0, f.endsAt - now)
  const mm = String(Math.floor(remainMs / 60000)).padStart(2, '0')
  const ss = String(Math.floor((remainMs % 60000) / 1000)).padStart(2, '0')
  const log = pet.focusLog ?? {}
  const week = last7(now).map((d) => ({ ...d, ...(log[d.key] ?? { m: 0, r: 0 }) }))
  const peak = Math.max(25, ...week.map((d) => d.m))
  const streak = streakOf(log, now)
  const todayKey = week[6]?.key
  return (
    <div className="ink-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="ink-title">番茄钟 · 闭关专注</span>
        <span className="text-[10px] text-emerald-100/30">
          今日 {f.todayCount} 轮 · 累计 {f.totalMinutes} 分钟{streak > 1 ? ` · 连续 ${streak} 日` : ''}
        </span>
      </div>
      {f.phase === 'idle' ? (
        <div className="flex items-center gap-3">
          {([15, 25, 45] as const).map((m) => (
            <button
              key={m}
              onClick={() => dispatch({ type: 'startFocus', minutes: m })}
              className="flex-1 rounded-lg border border-orange-800/50 bg-black/30 py-3 text-sm text-orange-100/90 transition hover:border-orange-500/60 hover:bg-orange-900/20"
            >
              🍅 {m} 分钟
            </button>
          ))}
          <div className="w-40 text-[10px] leading-4 text-emerald-100/35">
            专注圆满：修为+25 灵石+3；全程无分心额外 +7。随后歇息 5 分钟。
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <div className={`text-[10px] tracking-[0.3em] ${f.phase === 'focus' ? 'text-orange-200/70' : 'text-emerald-200/70'}`}>
              {f.phase === 'focus' ? '闭关专注中' : '歇息调息中'}
              {f.phase === 'focus' && pet.guard.enabled && (
                <span className="ml-2 text-red-300/70">👿 心魔 ×{f.distractions ?? 0}/3</span>
              )}
            </div>
            <div className={`mt-1 font-mono text-3xl tabular-nums ${f.phase === 'focus' ? 'text-orange-100' : 'text-emerald-100'}`}>
              {mm}:{ss}
            </div>
          </div>
          <button
            onClick={() => dispatch({ type: 'cancelFocus' })}
            className="rounded-lg border border-red-800/50 bg-red-950/30 px-4 py-2 text-xs text-red-200/80 transition hover:border-red-500/60"
          >
            {f.phase === 'focus' ? '中断闭关' : '跳过歇息'}
          </button>
        </div>
      )}

      {/* 闭关守护（专注模式，仅桌面端） */}
      {desktop && (
        <div className="mt-3 border-t border-orange-900/30 pt-3">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="flex cursor-pointer items-center gap-1.5 text-orange-100/80">
            <input
              type="checkbox"
              checked={pet.guard.enabled}
              onChange={(e) => dispatch({ type: 'setGuard', enabled: e.target.checked })}
              className="accent-orange-500"
            />
            闭关守护（监控前台软件）
          </label>
          <label className={`flex cursor-pointer items-center gap-1.5 ${pet.guard.enabled ? 'text-red-200/80' : 'text-emerald-100/25'}`}>
            <input
              type="checkbox"
              disabled={!pet.guard.enabled}
              checked={pet.guard.strict}
              onChange={(e) => dispatch({ type: 'setGuard', strict: e.target.checked })}
              className="accent-red-500"
            />
            严格模式（自动最小化违规窗口）
          </label>
          <span className="text-[10px] text-emerald-100/30">白名单外软件计心魔一次，三次破功</span>
        </div>
        {pet.guard.enabled && (
          <textarea
            defaultValue={pet.guard.whitelist}
            onBlur={(e) => dispatch({ type: 'setGuard', whitelist: e.target.value })}
            rows={2}
            spellCheck={false}
            className="mt-2 w-full rounded-lg border border-orange-900/40 bg-black/40 px-2 py-1.5 font-mono text-[11px] text-emerald-100/70 outline-none focus:border-orange-600/50"
            placeholder="白名单进程名，逗号分隔，如：Code, chrome, msedge"
          />
        )}
        </div>
      )}

      {/* 近七日闭关账：今天用朱砂柱，其余用金；空柱只留极淡的底，不假装"有数据" */}
      <div className="mt-3 border-t border-orange-900/30 pt-3">
        <div className="mb-1.5 flex items-center justify-between text-[10px] text-emerald-100/35">
          <span>近七日闭关</span>
          <span>{week.reduce((a, d) => a + d.r, 0)} 轮 · {week.reduce((a, d) => a + d.m, 0)} 分钟</span>
        </div>
        <div className="flex items-end gap-1.5">
          {week.map((d) => (
            <div key={d.key} className="flex flex-1 flex-col items-center gap-1" title={`${d.key} · ${d.m} 分钟 / ${d.r} 轮`}>
              <div className="flex h-12 w-full items-end">
                <div
                  className="w-full rounded-t"
                  style={{
                    height: d.m ? `${Math.max(8, (d.m / peak) * 100)}%` : '2px',
                    background: d.key === todayKey
                      ? 'linear-gradient(180deg, #e8b4a8, rgba(193,75,58,0.55))'
                      : d.m
                        ? 'linear-gradient(180deg, rgba(211,183,129,0.8), rgba(211,183,129,0.22))'
                        : 'rgba(236,228,208,0.08)',
                  }}
                />
              </div>
              <span className="text-[9px] text-emerald-100/35">{d.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function StatBar({ label, value, text, color }: { label: string; value: number; text?: string; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-10 text-sm tracking-[0.2em] text-[#d3b781]/70" style={{ fontFamily: 'var(--kai)' }}>{label}</span>
      <div className="stat-track flex-1">
        <div className={`stat-fill bg-gradient-to-r ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
      <span className="w-16 text-right text-xs tabular-nums text-[#ece4d0]/45">{text ?? `${Math.floor(value)}`}</span>
    </div>
  )
}

export function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="ink-card p-4">
      <div className="mb-3"><span className="ink-title">{title}</span></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{children}</div>
    </div>
  )
}

export function ActionBtn({
  icon, name, cost, onClick, disabled, highlight,
}: {
  icon: string
  name: string
  cost: string
  onClick: () => void
  disabled?: boolean
  highlight?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn-jade flex flex-col items-center gap-1 px-2 py-3 ${disabled ? 'cursor-not-allowed opacity-45' : ''}`}
      style={highlight ? { borderColor: 'rgba(211,183,129,0.6)', background: 'linear-gradient(180deg, rgba(211,183,129,0.2), rgba(211,183,129,0.06))', boxShadow: '0 0 14px rgba(211,183,129,0.2)' } : undefined}
    >
      <span className="text-xl">{icon}</span>
      <span className="text-sm tracking-[0.15em]">{name}</span>
      <span className="text-[10px] tracking-normal text-[#ece4d0]/40">{cost}</span>
    </button>
  )
}
