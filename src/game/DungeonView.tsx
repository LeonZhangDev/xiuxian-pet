import { useCallback, useEffect, useRef, useState } from 'react'
import type { PetState } from './data'
import { Dungeon, type DungeonResult, type HudState } from './dungeon'
import { skinPoseFile } from './packs'
import { copyShareCard, previewShareCard, saveShareCard } from './share-card'
import petBattleUrl from '../assets/pet-battle.webp'
import petBattleMUrl from '../assets/pet-m-battle.webp'

/** 结算立绘：皮肤战斗姿态优先，缺姿态回退待机睁眼帧，再回退默认战斗立绘 */
function battlePortraitUrl(pet: PetState): string {
  const skinId = typeof pet.skin === 'string' ? pet.skin : null
  if (skinId) {
    const battle = skinPoseFile(skinId, 'battle') ?? skinPoseFile(skinId, 'idleOpen')
    if (battle) return battle.pack.resolve(battle.file)
  }
  return pet.gender === 'male' ? petBattleMUrl : petBattleUrl
}

export default function DungeonView({
  pet,
  onExit,
}: {
  pet: PetState
  onExit: (r: DungeonResult) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const [hud, setHud] = useState<HudState | null>(null)
  const [result, setResult] = useState<DungeonResult | null>(null)
  const resultRef = useRef<DungeonResult | null>(null)
  // 战绩分享卡：先出预览图，再决定保存/复制（先看后存，避免误存一堆图）
  const [sharePreview, setSharePreview] = useState<string | null>(null)
  const [shareBusy, setShareBusy] = useState(false)
  const [shareNote, setShareNote] = useState<string | null>(null)
  const petRef = useRef(pet)
  useEffect(() => { petRef.current = pet }, [pet])
  const shareInput = useCallback(
    () => (resultRef.current ? { pet: petRef.current, result: resultRef.current, portraitUrl: battlePortraitUrl(petRef.current) } : null),
    [],
  )
  const makeShare = useCallback(async () => {
    const input = shareInput()
    if (!input || shareBusy) return
    setShareBusy(true)
    setShareNote(null)
    try {
      setSharePreview(await previewShareCard(input))
    } catch {
      setShareNote('战报绘制失败，请重试。')
    } finally {
      setShareBusy(false)
    }
  }, [shareBusy, shareInput])

  useEffect(() => {
    const d = new Dungeon(
      canvasRef.current!,
      overlayRef.current!,
      pet,
      (h) => setHud({ ...h, loot: { ...h.loot } }),
      (r) => {
        resultRef.current = r
        setResult(r)
      },
    )
    d.start()
    return () => d.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hpPct = hud ? (hud.hp / hud.maxHp) * 100 : 100
  const bossPct = hud?.bossHp != null && hud.bossMax ? (hud.bossHp / hud.bossMax) * 100 : null
  // 画质档：流畅 960×540 / 精致 1280×720 / 极致 1600×900（画布内部分辨率，CSS 仍铺满）
  const [qw, qh] = pet.quality === 'smooth' ? [960, 540] : pet.quality === 'ultra' ? [1600, 900] : [1280, 720]
  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1

  return (
    <div className="relative mx-auto aspect-[16/9] w-full max-w-[980px]" style={{ fontFamily: '"Kaiti SC", "STKaiti", "KaiTi", "Noto Serif SC", serif' }}>
      {/* 世界层（WebGL / 2.5D） */}
      <canvas
        ref={canvasRef}
        width={qw}
        height={qh}
        className="absolute inset-0 z-0 block h-full w-full rounded-md border border-[rgba(211,183,129,0.25)] bg-[#0a1010] shadow-[0_0_30px_rgba(0,0,0,0.6)]"
      />
      {/* HUD / 特效 overlay（2D，接收鼠标） */}
      <canvas
        ref={overlayRef}
        width={Math.round(qw * dpr)}
        height={Math.round(qh * dpr)}
        className="absolute inset-0 z-[5] block h-full w-full cursor-crosshair rounded-md"
      />

      {/* 顶部：气血 + 波次 */}
      <div className="pointer-events-none absolute left-4 top-4 w-64">
        <div className="mb-1 flex items-baseline justify-between text-xs text-[#ece4d0]/90">
          <span className="tracking-[0.25em]">{pet.name} · 气血</span>
          <span className="tabular-nums">
            {hud?.hp ?? 0} / {hud?.maxHp ?? 0}
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-sm border border-[rgba(193,75,58,0.5)] bg-black/60">
          <div
            className="h-full bg-gradient-to-r from-[#8c2f24] to-[#c14b3a] transition-all duration-150"
            style={{ width: `${hpPct}%`, boxShadow: '0 0 8px rgba(193,75,58,0.5)' }}
          />
        </div>
        <div className="mt-2 flex gap-2 text-xs">
          <span className="rounded-sm border border-[rgba(211,183,129,0.2)] bg-black/55 px-2 py-0.5 text-sky-200">
            💎 {hud?.loot.stones ?? 0}
          </span>
          <span className="rounded-sm border border-[rgba(211,183,129,0.2)] bg-black/55 px-2 py-0.5 text-green-200">
            🌿 {hud?.loot.herbs ?? 0}
          </span>
          <span className="rounded-sm border border-[rgba(211,183,129,0.2)] bg-black/55 px-2 py-0.5 text-purple-200">
            ⛏ {hud?.loot.ore ?? 0}
          </span>
        </div>
      </div>

      {/* 区域 */}
      <div className="ink-card pointer-events-none absolute right-4 top-4 px-4 py-2 text-center">
        <div className="text-[10px] tracking-[0.35em] text-[#d3b781]/70">所在区域</div>
        <div className="text-xl tracking-[0.15em] text-[#d3b781]">{hud?.region ?? '荒野灵台'}</div>
        <div className="text-[10px] text-[#c14b3a]/90">交战妖兽 {hud?.enemiesNear ?? 0}</div>
        <div className="mt-1 text-[10px] text-[#ece4d0]/50">
          {hud?.bossAlive === false ? '已斩妖皇' : '妖窟有主 · B 回城'}
        </div>
      </div>

      {/* Boss 血条 */}
      {bossPct != null && (
        <div className="pointer-events-none absolute left-1/2 top-4 w-96 -translate-x-1/2">
          <div className="mb-1 text-center text-sm tracking-[0.4em] text-[#e8b4a8]" style={{ fontFamily: 'var(--kai)' }}>{hud?.bossName ?? '妖皇'}</div>
          <div className="h-3 overflow-hidden rounded-sm border border-[rgba(193,75,58,0.6)] bg-black/70">
            <div
              className={`h-full bg-gradient-to-r transition-all duration-200 ${
                bossPct < 50 ? 'from-pink-900 via-fuchsia-600 to-red-500' : 'from-[#6e241c] via-[#a03a2c] to-[#c14b3a]'
              }`}
              style={{ width: `${bossPct}%` }}
            />
          </div>
          {bossPct < 50 && (
            <div className="mt-0.5 text-center text-[10px] tracking-[0.5em] text-fuchsia-300">暴 走</div>
          )}
        </div>
      )}

      {/* 连击计数 */}
      {(hud?.combo ?? 0) >= 3 && (
        <div className="pointer-events-none absolute left-4 top-28 text-left">
          <div className="text-2xl font-black text-[#d3b781] drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]" style={{ fontFamily: 'var(--kai)' }}>
            {hud!.combo} <span className="text-sm tracking-widest">连击</span>
          </div>
          <div className="mt-0.5 text-[11px] tracking-wider text-[#8fbfa8] drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
            灵气掉落 ×{(hud!.comboMult ?? 1).toFixed(2)}
          </div>
        </div>
      )}

      {/* 底部技能栏 */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-3">
        <SkillIcon label="左键/J" name="御剑" cd={0} max={1} icon="⚔️" />
        <SkillIcon label="空格" name="闪避" cd={hud?.dashCd ?? 0} max={1.6} icon="💨" />
        <SkillIcon label="Q" name="雷法" cd={hud?.thunderCd ?? 0} max={6} icon="⚡" />
        {(hud?.unionCd ?? -1) >= 0 ? (
          <SkillIcon label="F" name="合击" cd={hud?.unionCd ?? 0} max={20} icon="💞" />
        ) : (
          <SkillIcon label="F" name="心意未通" cd={0} max={1} icon="🔒" />
        )}
        <SkillIcon label="E" name={`丹药×${hud?.pills ?? 0}`} cd={0} max={1} icon="🧪" />
        <SkillIcon label="B" name="回城符" cd={0} max={1} icon="🏮" />
      </div>

      {/* 结算 */}
      {result && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-black/70 backdrop-blur-sm">
          <div className="ink-card w-80 p-6 text-center">
            <div className="relative mx-auto -mt-20 mb-2 h-32 w-32">
              <img
                src={battlePortraitUrl(pet)}
                alt=""
                className="h-full w-full object-contain drop-shadow-[0_6px_16px_rgba(0,0,0,0.7)]"
                style={result.victory ? undefined : { filter: 'grayscale(0.55) brightness(0.85)' }}
              />
            </div>
            <div className="mb-1 text-3xl">{result.victory ? '🏆' : result.retreated ? '🏮' : '💫'}</div>
            <div className="mb-1 flex items-center justify-center gap-2">
              <span className="seal">战报</span>
            </div>
            <div className="mb-4 text-xl tracking-[0.3em] text-[#d3b781]" style={{ fontFamily: 'var(--kai)' }}>
              {result.victory ? '秘境大捷' : result.retreated ? '全身而退' : '重伤遁归'}
            </div>
            <div className="mb-1 text-sm text-[#ece4d0]/80">斩妖 × {result.kills}</div>
            <div className="mb-4 flex justify-center gap-3 text-sm">
              <span className="text-sky-300">💎 灵石 ×{result.loot.stones}</span>
              <span className="text-green-300">🌿 灵草 ×{result.loot.herbs}</span>
              <span className="text-purple-300">⛏ 玄铁 ×{result.loot.ore}</span>
            </div>
            {result.equip && (
              <div className="mb-4 rounded-md border border-[rgba(211,183,129,0.45)] bg-[rgba(211,183,129,0.08)] px-3 py-2">
                <div className="text-sm text-[#d3b781]">
                  ✨ 获得法宝「{result.equip.icon} {result.equip.name}」
                </div>
                <div className="text-xs text-[#d3b781]/60">{result.equip.desc} · 回洞府后可装备</div>
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button
                onClick={makeShare}
                disabled={shareBusy}
                className="btn-jade flex-1 py-2 text-xs tracking-[0.2em]"
                title="把战斗立绘、斩妖数与掉落合成一张战报图"
              >
                {shareBusy ? '绘制中……' : '📜 生成战报图'}
              </button>
              <button
                onClick={() => onExit(resultRef.current!)}
                className="btn-jade flex-1 py-2 text-xs tracking-[0.2em]"
              >
                返回洞府
              </button>
            </div>
            {shareNote && <div className="mt-2 text-[11px] text-[#c14b3a]/80">{shareNote}</div>}
          </div>
        </div>
      )}

      {/* 战报预览：先看后存 */}
      {sharePreview && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-md bg-black/85 p-4 backdrop-blur-sm">
          <div className="text-sm tracking-[0.35em] text-[#d3b781]" style={{ fontFamily: 'var(--kai)' }}>战 报 已 成</div>
          <img
            src={sharePreview}
            alt="秘境战报"
            className="max-h-[72%] rounded-md border border-[rgba(211,183,129,0.35)] shadow-[0_10px_40px_rgba(0,0,0,0.7)]"
          />
          <div className="flex gap-2">
            <button
              onClick={async () => {
                const input = shareInput()
                if (!input) return
                setShareBusy(true)
                try {
                  await saveShareCard(input)
                  setShareNote(null)
                } catch { setShareNote('保存失败，可右键图片另存为。') }
                finally { setShareBusy(false) }
              }}
              className="btn-jade px-4 py-2 text-xs tracking-[0.2em]"
              disabled={shareBusy}
            >
              💾 保存到本地
            </button>
            <button
              onClick={async () => {
                const input = shareInput()
                if (!input) return
                setShareBusy(true)
                const ok = await copyShareCard(input)
                setShareNote(ok ? '已复制，可直接粘贴到聊天窗口。' : '此环境不支持复制，请用「保存到本地」。')
                setShareBusy(false)
              }}
              className="btn-jade px-4 py-2 text-xs tracking-[0.2em]"
              disabled={shareBusy}
            >
              📋 复制战报
            </button>
            <button
              onClick={() => { setSharePreview(null); setShareNote(null) }}
              className="btn-jade px-4 py-2 text-xs tracking-[0.2em]"
            >
              收起
            </button>
          </div>
          {shareNote && <div className="text-[11px] text-[#8fbfa8]">{shareNote}</div>}
        </div>
      )}
    </div>
  )
}

function SkillIcon({ label, name, cd, max, icon }: { label: string; name: string; cd: number; max: number; icon: string }) {
  const pct = Math.min(100, (cd / max) * 100)
  return (
    <div
      className="relative flex h-16 w-16 flex-col items-center justify-center overflow-hidden rounded-md border border-[rgba(211,183,129,0.25)] bg-[rgba(10,13,12,0.75)] backdrop-blur-sm"
      style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.5), inset 0 0 8px rgba(211,183,129,0.06)' }}
    >
      <div className="text-lg">{icon}</div>
      <div className="text-[10px] tracking-wider text-[#ece4d0]/85">{name}</div>
      <div className="text-[9px] text-[#ece4d0]/40">{label}</div>
      {pct > 0 && (
        <div
          className="absolute bottom-0 left-0 w-full bg-black/70"
          style={{ height: `${pct}%` }}
        />
      )}
      {cd > 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums text-[#d3b781]">
          {cd.toFixed(1)}
        </div>
      )}
    </div>
  )
}
