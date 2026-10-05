// ─── 界面偏好设置（与存档解耦）─────────────────────────────────────
// 这些是"本机观感"而非"修仙进度"：不该进 PetState（进存档会污染跨窗口同步、
// 也会让一次误触成为不可逆的状态迁移）。独立存 localStorage + 轻量订阅。

export interface UiSettings {
  danceEnabled: boolean // 随乐起舞总开关
  danceManual: boolean // 手动起舞（不依赖系统播放侦测）
  danceAutoOff: boolean // 系统暂停后是否立刻停舞（关=延迟 3 秒渐停）
  danceBpm: number // 起舞速度（拍/分钟）；按曲目记忆的 BPM 优先于此值
  reduceMotion: boolean // 凝神模式：压掉非必要动效
  petScale: number // 小仙身量 0.8~1.3
  previewWeather: 'auto' | 'clear' | 'rain' | 'snow' // 模拟预览窗的天气
  showPreview: boolean // 设置页是否常驻显示模拟窗
}

const KEY = 'xiuxian-pet-ui-settings-v1'
const WEATHERS: UiSettings['previewWeather'][] = ['auto', 'clear', 'rain', 'snow']

export const defaultSettings = (): UiSettings => ({
  danceEnabled: true,
  danceManual: false,
  danceAutoOff: true,
  danceBpm: 110,
  reduceMotion: false,
  petScale: 1,
  previewWeather: 'auto',
  showPreview: true,
})

const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)
const num = (v: unknown, fallback: number, lo: number, hi: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback

function read(): UiSettings {
  const base = defaultSettings()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return base
    const src = JSON.parse(raw) as Record<string, unknown>
    return {
      danceEnabled: bool(src.danceEnabled, base.danceEnabled),
      danceManual: bool(src.danceManual, base.danceManual),
      danceAutoOff: bool(src.danceAutoOff, base.danceAutoOff),
      danceBpm: num(src.danceBpm, base.danceBpm, 60, 180),
      reduceMotion: bool(src.reduceMotion, base.reduceMotion),
      petScale: num(src.petScale, base.petScale, 0.8, 1.3),
      previewWeather: WEATHERS.includes(src.previewWeather as UiSettings['previewWeather'])
        ? (src.previewWeather as UiSettings['previewWeather'])
        : base.previewWeather,
      showPreview: bool(src.showPreview, base.showPreview),
    }
  } catch {
    return base
  }
}

let current = read()
const listeners = new Set<(s: UiSettings) => void>()

export const getSettings = (): UiSettings => current

export function setSettings(patch: Partial<UiSettings>): UiSettings {
  current = { ...current, ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(current)) } catch { /* 隐私模式下忽略 */ }
  applyUiToDocument(current)
  for (const l of listeners) l(current)
  return current
}

export function resetSettings(): UiSettings {
  current = defaultSettings()
  try { localStorage.setItem(KEY, JSON.stringify(current)) } catch { /* 忽略 */ }
  applyUiToDocument(current)
  for (const l of listeners) l(current)
  return current
}

export function subscribeSettings(cb: (s: UiSettings) => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// ─── 按曲目记忆 BPM ────────────────────────────────────────────────
// 系统媒体接口只给曲名不给音频波形，拿不到真实 BPM。退而求其次：
// 用户跟着歌点几下（Tap Tempo），记下"这首歌该跳多快"，下次自动对上。
const BPM_KEY = 'xiuxian-pet-bpm-by-track-v1'

function readBpmMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(BPM_KEY)
    if (!raw) return {}
    const src = JSON.parse(raw) as Record<string, unknown>
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(src)) if (typeof v === 'number' && v >= 40 && v <= 220) out[k] = v
    return out
  } catch {
    return {}
  }
}

export function getTrackBpm(track: string): number | null {
  if (!track) return null
  return readBpmMap()[track] ?? null
}

/** 记住某首歌的 BPM；上限 200 条，避免长期累积 */
export function setTrackBpm(track: string, bpm: number): void {
  if (!track) return
  const map = readBpmMap()
  map[track] = Math.round(bpm)
  const keys = Object.keys(map)
  if (keys.length > 200) for (const k of keys.slice(0, keys.length - 200)) delete map[k]
  try { localStorage.setItem(BPM_KEY, JSON.stringify(map)) } catch { /* 忽略 */ }
}

/**
 * 把"观感类"设置落到 DOM 根节点上。
 * 只做两件事：类名切换（凝神模式）与 CSS 变量（身量）——
 * 都不需要 React 重渲染，桌宠窗口与洞府窗口因此自动同步。
 */
export function applyUiToDocument(s: UiSettings): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('reduce-motion', s.reduceMotion)
  root.style.setProperty('--pet-scale', String(s.petScale))
}
