import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { REALMS, combatStats, cultivationNeed } from '../game/data'
import PetCanvas from '../game/PetCanvas'
import { desktop } from '../lib/desktop-bridge'
import { useMusicState } from '../hooks/use-music'
import type { DungeonResult } from '../game/dungeon'
import type { ViewProps } from './view-types'
import { LookPanel, CosmeticPanel, CodexPanel, CompanionPanel, DiaryPanel, SkinPanel, TodoPanel, FocusPanel, StatBar, Panel, ActionBtn } from './home-panels'
import sfxBreakthroughUrl from '../assets/sfx-breakthrough.mp3'

const DungeonView = lazy(() => import('../game/DungeonView'))
const TribulationGame = lazy(() => import('../game/TribulationGame'))
const SettingsView = lazy(() => import('./settings-view'))

export default function HomeView({ pet, messages, dispatch: sendAction, setMessages, navigate, mode }: ViewProps) {
  useEffect(() => { desktop?.rendererReady() }, [])
  const { dancing, bpm } = useMusicState() // 洞府里的小仙也该跟着放歌起舞
  const [editing, setEditing] = useState(false)
  const [recentAction, setRecentAction] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now)
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id) }, [])
  useEffect(() => { if (!recentAction) return; const id = window.setTimeout(() => setRecentAction(null), 2600); return () => window.clearTimeout(id) }, [recentAction])
  const dispatch = (action: Parameters<typeof sendAction>[0]) => {
    sendAction(action)
    if (action.type === 'feed') setRecentAction(action.fruit ? 'feed-fruit' : 'feed')
    else if (action.type === 'study') setRecentAction('study-wuxiang')
    else if (['bathe', 'meditate', 'brew', 'forge'].includes(action.type)) setRecentAction(action.type)
  }
  const need = cultivationNeed(pet.realm)
  const cs = combatStats(pet)
  const cultPct = Math.min(100, (pet.cultivation / need) * 100)
  const remain = Math.max(0, pet.focus.endsAt - now)
  const focusRemain = `${String(Math.floor(remain / 60000)).padStart(2, '0')}:${String(Math.floor((remain % 60000) / 1000)).padStart(2, '0')}`
  const enterDungeon = () => { dispatch({ type: 'enterDungeon' }); if (!pet.secluding && pet.stamina >= 25) navigate('dungeon') }
  const exitDungeon = (result: DungeonResult) => { dispatch({ type: 'dungeonResult', ...result }); navigate('home') }
  const endTribulation = (success: boolean) => { dispatch({ type: 'tribulationResult', success }); navigate('home') }
  // 突破仙音：渡劫功成瞬间奏一次编钟
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
  return (
    <div
      className="min-h-screen text-emerald-50"
      style={{
        background:
          'radial-gradient(ellipse at 20% 0%, rgba(143,191,168,0.07), transparent 55%), radial-gradient(ellipse at 85% 90%, rgba(211,183,129,0.06), transparent 50%), #0a0d0c',
        fontFamily: '"Kaiti SC", "STKaiti", "KaiTi", "Noto Serif SC", "Songti SC", "SimSun", serif',
      }}
    >
      {/* 突破窗口级金光：渡劫功成后 4 秒，洞府沐金 */}
      {pet.breakthroughAt > 0 && now - pet.breakthroughAt >= 0 && now - pet.breakthroughAt < 4000 && (
        <div
          className="pointer-events-none fixed inset-0 z-50"
          style={{
            background: 'radial-gradient(ellipse at 50% 55%, rgba(255,224,140,0.32), rgba(255,200,90,0.1) 50%, transparent 80%)',
            animation: 'btGlow 4s ease-out forwards',
          }}
        />
      )}
      {/* 顶栏 */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="seal" style={{ fontSize: 13, padding: '3px 8px' }}>仙</span>
          <h1 className="text-xl tracking-[0.5em] text-[#ece4d0]">桌面小仙</h1>
          <span className="rounded border border-[rgba(211,183,129,0.3)] px-2 py-0.5 text-xs text-[#d3b781]/80">
            原型 v0.1
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-[#ece4d0]/55">
          <span>斩妖 <span className="text-[#d3b781]">{pet.kills}</span></span>
          <span>大捷 <span className="text-[#d3b781]">{pet.victories}</span></span>
          <button
            onClick={() => navigate('settings')}
            className="text-[#ece4d0]/55 transition hover:text-[#d3b781]"
            title="观感、音律与存档"
          >
            <span aria-hidden>⚙</span> 设置
          </button>
          {desktop && (
            <button
              onClick={() => navigate('pet')}
              className="btn-jade px-3 py-1 text-xs"
              title="收回桌面角落，继续当桌宠"
            >
              收回桌面
            </button>
          )}
          <button
            onClick={() => { if (confirm('确定要兵解重修吗？（清空存档）')) dispatch({ type: 'reset' }) }}
            className="text-[#ece4d0]/30 transition hover:text-[#c14b3a]"
          >
            兵解
          </button>
        </div>
      </header>

      {mode === 'settings' ? (
        <Suspense fallback={<p role="status">正在铺开设置……</p>}>
          <SettingsView pet={pet} messages={messages} dispatch={sendAction} setMessages={setMessages} navigate={navigate} mode={mode} />
        </Suspense>
      ) : mode === 'tribulation' ? (
        <main className="mx-auto max-w-6xl px-4 pb-10">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm tracking-[0.3em] text-violet-200/70">— 天劫降临 · 护法渡劫 —</div>
            <div className="text-xs text-violet-200/40">点击劈落的雷电即可化解 · 心境耗尽则渡劫失败</div>
          </div>
          <Suspense fallback={<p role="status">正在准备渡劫……</p>}><TribulationGame pet={pet} onEnd={endTribulation} /></Suspense>
        </main>
      ) : mode === 'dungeon' ? (
        <main className="mx-auto max-w-6xl px-4 pb-10">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm tracking-[0.3em] text-emerald-100/60">— 妖兽秘境 · 历练中 —</div>
            <div className="text-xs text-emerald-100/40">WASD 移动 · 左键/J 御剑 · 空格闪避 · Q 雷法 · E 服丹 · B 回城</div>
          </div>
          <Suspense fallback={<p role="status">正在准备秘境……</p>}><DungeonView pet={pet} onExit={exitDungeon} /></Suspense>
        </main>
      ) : (
        <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 pb-10 lg:grid-cols-[400px_1fr]">
          {/* 左：桌宠 */}
          <section className="ink-card p-4">
            <div className="mb-1 flex items-center justify-center gap-2">
              {editing ? (
                <input
                  autoFocus
                  defaultValue={pet.name}
                  maxLength={8}
                  onBlur={(e) => { dispatch({ type: 'rename', name: e.target.value }); setEditing(false) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  className="w-28 rounded border border-[rgba(211,183,129,0.4)] bg-black/40 px-2 py-0.5 text-center text-lg text-[#ece4d0] outline-none"
                />
              ) : (
                <button onClick={() => setEditing(true)} className="text-lg tracking-[0.3em] text-[#ece4d0] hover:text-[#d3b781]" title="点击改名">
                  {pet.name}
                </button>
              )}
              <span className="seal">
                {REALMS[pet.realm]}
              </span>
              <span className="flex overflow-hidden rounded border border-[rgba(211,183,129,0.25)]" title="切换小仙形象">
                {([['female', '女仙', '🌸'], ['male', '男仙', '⚔️']] as const).map(([g, label, icon]) => (
                  <button
                    key={g}
                    onClick={() => dispatch({ type: 'setGender', gender: g })}
                    className={`px-2.5 py-0.5 text-xs transition ${
                      pet.gender === g
                        ? 'bg-[rgba(211,183,129,0.2)] text-[#d3b781]'
                        : 'bg-black/30 text-[#ece4d0]/40 hover:text-[#ece4d0]/80'
                    }`}
                  >
                    {icon} {label}
                  </button>
                ))}
              </span>
            </div>

            <div className="pet-stage">
              <PetCanvas pet={pet} recentAction={recentAction} dancing={dancing} bpm={bpm} look={pet.look} />
            </div>

            {/* 心情气泡 */}
            <div className="pet-bubble mx-auto -mt-2 mb-3 w-fit px-4 py-1 text-center text-sm text-[#ece4d0]/80">
              {pet.pendingTribulation
                ? '「劫云来了……主人，护我！」'
                : pet.focus.phase === 'focus'
                  ? `🍅 闭关专注中 · 剩 ${focusRemain}`
                  : pet.focus.phase === 'break'
                    ? '调息歇息中……喝口茶吧'
                    : pet.secluding
                ? `闭关中……还剩 ${Math.ceil(pet.secludeLeft)} 息`
                : pet.satiety < 25
                  ? '「肚子好饿……给点吃的嘛」'
                  : pet.cleanliness < 30
                    ? '「身上黏糊糊的，想洗澡……」'
                    : pet.mood > 70
                      ? '「今天也是修仙的好日子！」'
                      : '「嗯……平平无奇的一天。」'}
            </div>

            {/* 状态条 */}
            <div className="space-y-2 px-2">
              <StatBar label="修为" value={cultPct} text={`${Math.floor(pet.cultivation)} / ${need}`} color="from-emerald-600 to-emerald-300" />
              <StatBar label="饱腹" value={pet.satiety} color="from-amber-600 to-amber-300" />
              <StatBar label="洁净" value={pet.cleanliness} color="from-sky-600 to-sky-300" />
              <StatBar label="心情" value={pet.mood} color="from-rose-600 to-rose-300" />
              <StatBar label="体力" value={pet.stamina} color="from-violet-600 to-violet-300" />
            </div>
          </section>

          {/* 右：操作 + 洞府 */}
          <section className="flex flex-col gap-4">
            {/* 天劫横幅 */}
            {pet.pendingTribulation && (
              <button
                onClick={() => navigate('tribulation')}
                className="animate-pulse rounded-md border border-violet-400/50 bg-gradient-to-r from-violet-950/80 via-[#1c1430] to-violet-950/80 py-4 shadow-[0_0_24px_rgba(139,92,246,0.25)] transition hover:border-violet-300/70"
              >
                <div className="text-lg tracking-[0.5em] text-violet-200" style={{ fontFamily: 'var(--kai)' }}>⚡ 天 劫 将 至 ⚡</div>
                <div className="mt-1 text-xs text-violet-200/60">劫云压顶，点击为{pet.name} 护法渡劫</div>
              </button>
            )}

            {/* 消息流 */}
            <div className="ink-card min-h-[52px] px-4 py-2">
              {messages.length === 0 ? (
                <div className="py-1 text-sm text-[#ece4d0]/30">洞府静悄悄的……先喂它点东西，或者让它闭关修炼吧。</div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`py-0.5 text-sm ${
                      m.kind === 'good' ? 'text-[#8fbfa8]' : m.kind === 'bad' ? 'text-[#c14b3a]' : 'text-[#ece4d0]/70'
                    }`}
                  >
                    {m.text}
                  </div>
                ))
              )}
            </div>

            {/* 日常照料 */}
            <Panel title="日常照料">
              <ActionBtn icon="🍚" name="喂灵米" cost="1 灵石" onClick={() => dispatch({ type: 'feed', fruit: false })} disabled={pet.secluding} />
              <ActionBtn icon="🍑" name="喂灵果" cost="5 灵石 · 修为+10" onClick={() => dispatch({ type: 'feed', fruit: true })} disabled={pet.secluding} />
              <ActionBtn icon="🛁" name="净身术" cost="洗澡祛尘" onClick={() => dispatch({ type: 'bathe' })} disabled={pet.secluding} />
              <ActionBtn icon="🧘" name="吐纳" cost="修为+12" onClick={() => dispatch({ type: 'meditate' })} disabled={pet.secluding} />
            </Panel>

            {/* 修仙事务 */}
            <Panel title="修仙事务">
              <ActionBtn
                icon="🌀"
                name={pet.secluding ? `闭关 ${Math.ceil(pet.secludeLeft)}s` : '闭关'}
                cost={pet.secluding ? '灵气汇聚中…' : '30 息 · 修为大涨'}
                onClick={() => dispatch({ type: 'seclude' })}
                disabled={pet.secluding}
                highlight={pet.secluding}
              />
              <ActionBtn icon="⚗️" name="炼丹" cost={`灵草2→回灵丹（有${pet.pills}）`} onClick={() => dispatch({ type: 'brew' })} />
              <ActionBtn icon="⚔️" name="炼器" cost={`玄铁3+灵石10→飞剑+${pet.swordLevel + 1}`} onClick={() => dispatch({ type: 'forge' })} />
            </Panel>

            {/* 秘籍阁（首个资源包示范：研读动画由动作包驱动） */}
            <Panel title="秘籍阁">
              <ActionBtn icon="📜" name="研读《无相剑典》" cost="体力10 → 修为+25" onClick={() => dispatch({ type: 'study' })} disabled={pet.secluding} />
            </Panel>

            {/* 番茄钟 */}
            <FocusPanel pet={pet} dispatch={dispatch} now={now} />

            {/* 历练清单 */}
            <TodoPanel pet={pet} dispatch={dispatch} />

            {/* 换装配色 */}
            <LookPanel pet={pet} dispatch={dispatch} />

            {/* 图鉴 */}
            <CodexPanel pet={pet} />
            <CosmeticPanel pet={pet} dispatch={dispatch} />

            {/* 形象阁（皮肤包） */}
            <SkinPanel pet={pet} dispatch={dispatch} />

            {/* 仙友养成 */}
            <CompanionPanel pet={pet} dispatch={dispatch} />

            {/* 小仙日记 */}
            <DiaryPanel pet={pet} />

            {/* 背包 */}
            <div className="ink-card flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <span className="ink-title" style={{ fontSize: 13 }}>乾坤袋</span>
              <span className="text-sky-300">💎 灵石 ×{pet.stones}</span>
              <span className="text-green-300">🌿 灵草 ×{pet.herbs}</span>
              <span className="text-purple-300">⛏ 玄铁 ×{pet.ore}</span>
              <span className="text-amber-300">🧪 回灵丹 ×{pet.pills}</span>
              <span className="text-cyan-200">🗡 飞剑 +{pet.swordLevel}</span>
            </div>

            {/* 画质设置 */}
            <div className="ink-card flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
              <span className="ink-title" style={{ fontSize: 13 }}>画质</span>
              {([['smooth', '流畅'], ['fine', '精致'], ['ultra', '极致']] as const).map(([q, label]) => (
                <button
                  key={q}
                  onClick={() => dispatch({ type: 'setQuality', quality: q })}
                  className={`rounded border px-2.5 py-1 text-xs transition ${
                    pet.quality === q
                      ? 'border-[rgba(211,183,129,0.55)] bg-[rgba(211,183,129,0.15)] text-[#d3b781]'
                      : 'border-[rgba(211,183,129,0.15)] bg-black/30 text-[#ece4d0]/45 hover:text-[#ece4d0]/80'
                  }`}
                >
                  {label}
                </button>
              ))}
              <span className="text-[10px] text-[#ece4d0]/30">秘境分辨率与灵尘密度 · 下次进秘境生效</span>
            </div>

            {/* 法宝装备 */}
            <div className="ink-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="ink-title">法宝</span>
                <span className="text-[10px] text-[#ece4d0]/30">击杀各方妖皇必掉一件</span>
              </div>
              <div className="mb-3 grid grid-cols-3 gap-2">
                {(['weapon', 'armor', 'trinket'] as const).map((slot) => {
                  const label = { weapon: '武器', armor: '护甲', trinket: '饰品' }[slot]
                  const eq = pet.equipped?.[slot]
                  return (
                    <button
                      key={slot}
                      onClick={() => eq && dispatch({ type: 'unequip', slot })}
                      title={eq ? `${eq.desc}（点击卸下）` : `${label}槽位 · 空`}
                      className={`rounded-md border px-2 py-2 text-center transition ${
                        eq
                          ? 'border-[rgba(211,183,129,0.45)] bg-[rgba(211,183,129,0.08)] hover:border-[rgba(193,75,58,0.6)]'
                          : 'border-dashed border-[rgba(211,183,129,0.15)] bg-black/20'
                      }`}
                    >
                      <div className="text-[10px] tracking-widest text-[#ece4d0]/40">{label}</div>
                      <div className={`text-sm ${eq ? 'text-[#d3b781]' : 'text-[#ece4d0]/25'}`}>
                        {eq ? `${eq.icon} ${eq.name}` : '—'}
                      </div>
                      {eq && <div className="text-[9px] text-[#d3b781]/50">{eq.desc}</div>}
                    </button>
                  )
                })}
              </div>
              {(pet.backpack ?? []).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {(pet.backpack ?? []).map((item, i) => (
                    <button
                      key={item.id + i}
                      onClick={() => dispatch({ type: 'equip', index: i })}
                      title={`${item.desc}（点击装备）`}
                      className="rounded-md border border-[rgba(143,191,168,0.25)] bg-black/30 px-2.5 py-1.5 text-xs text-[#ece4d0]/80 transition hover:border-[rgba(211,183,129,0.5)] hover:text-[#d3b781]"
                    >
                      {item.icon} {item.name}
                      <span className="ml-1 text-[9px] text-[#ece4d0]/40">{item.desc}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-[#ece4d0]/25">乾坤袋中尚无法宝，去秘境深处寻一件吧。</div>
              )}
            </div>

            {/* 出副本 */}
            <button
              onClick={enterDungeon}
              className="group relative overflow-hidden rounded-md border border-[rgba(193,75,58,0.5)] bg-gradient-to-r from-[rgba(60,20,16,0.7)] via-[#16100f] to-[rgba(60,20,16,0.7)] py-5 shadow-[0_0_20px_rgba(193,75,58,0.15)] transition hover:border-[rgba(193,75,58,0.8)] hover:shadow-[0_0_28px_rgba(193,75,58,0.3)]"
            >
              <div className="text-lg tracking-[0.6em] text-[#e8b4a8] transition group-hover:text-[#ffe0d6]" style={{ fontFamily: 'var(--kai)' }}>
                出 外 历 练
              </div>
              <div className="mt-1 text-xs text-[#e8b4a8]/50">
                进入妖兽秘境 · 消耗体力 25（当前 {Math.floor(pet.stamina)}）· 无缝开放秘境 · 五大区域 · 炎窟斩蛟
              </div>
              {/* 战力构成：让玩家知道这一身本事从哪来（境界/剑诀/法宝），
                  否则"养宠"与"打架"看起来是两件不相干的事 */}
              <div className="mt-1 text-[10px] text-[#e8b4a8]/35">
                本次出战 · 气血 {Math.round(cs.maxHp)} · 攻击 {Math.round(cs.attack)} · 身法 {cs.speed.toFixed(2)} · 雷法 {Math.round(cs.thunder)}
                <span className="ml-1 opacity-70">（境界 {REALMS[pet.realm]} · 剑诀 {pet.swordLevel} 重 · 法宝 {Object.keys(pet.equipped ?? {}).length} 件）</span>
              </div>
            </button>
          </section>
        </main>
      )}
    </div>
  )
}
