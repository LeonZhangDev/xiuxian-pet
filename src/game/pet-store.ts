import { COSMETICS, EQUIP_POOL, REALMS, initialPet, type EquipItem, type PetState } from './data'
import { LOOKS } from './looks'

export const SAVE_KEY = 'xiuxian-pet-save-v1'
type ObjectValue = Record<string, unknown>
const object = (value: unknown): ObjectValue => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as ObjectValue : {}
const number = (value: unknown, fallback = 0, max = 1e9): number => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : fallback
const text = (value: unknown, fallback: string, max = 200): string => typeof value === 'string' ? value.slice(0, max) : fallback
const bool = (value: unknown, fallback = false): boolean => typeof value === 'boolean' ? value : fallback
const list = (value: unknown): unknown[] => Array.isArray(value) ? value.slice(0, 1000) : []
const ids = (value: unknown, allowed: string[]): string[] => [...new Set(list(value).filter((id): id is string => typeof id === 'string' && allowed.includes(id)))]
const counts = (value: unknown): Record<string, number> => Object.fromEntries(Object.entries(object(value)).filter(([key]) => /^[a-z][a-z0-9-]{0,39}$/.test(key)).map(([key, count]) => [key, Math.floor(number(count))]))
const equipment = (value: unknown): EquipItem | undefined => EQUIP_POOL.find((item) => item.id === object(value).id)
const day = (value: unknown): string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''

/** Normalize every persisted field. Unknown equipment cannot enter renderer code. */
export function normalizePet(value: unknown): PetState {
  const src = object(value)
  const pet = initialPet()
  pet.name = text(src.name, pet.name, 8).trim() || pet.name
  const counters = ['realm', 'cultivation', 'satiety', 'cleanliness', 'mood', 'stamina', 'stones', 'herbs', 'ore', 'pills', 'swordLevel', 'secludeLeft', 'kills', 'deaths', 'victories'] as const
  for (const key of counters) pet[key] = number(src[key], pet[key], ['satiety', 'cleanliness', 'mood', 'stamina'].includes(key) ? 100 : 1e9)
  pet.realm = Math.floor(Math.min(pet.realm, REALMS.length - 1))
  pet.secludeLeft = Math.min(pet.secludeLeft, 30)
  pet.secluding = bool(src.secluding) && pet.secludeLeft > 0
  pet.pendingTribulation = bool(src.pendingTribulation)
  pet.breakthroughAt = number(src.breakthroughAt, 0, 8.64e15)
  pet.quality = src.quality === 'smooth' || src.quality === 'ultra' ? src.quality : 'fine'
  pet.gender = src.gender === 'male' ? 'male' : 'female'
  const eq = object(src.equipped)
  for (const slot of ['weapon', 'armor', 'trinket'] as const) {
    const item = equipment(eq[slot])
    if (item?.slot === slot) pet.equipped[slot] = { ...item }
  }
  pet.backpack = list(src.backpack).flatMap((value) => { const item = equipment(value); return item ? [{ ...item }] : [] })
  const focus = object(src.focus)
  pet.focus = {
    phase: focus.phase === 'focus' || focus.phase === 'break' ? focus.phase : 'idle',
    endsAt: number(focus.endsAt, 0, 8.64e15), minutes: number(focus.minutes, 0, 180),
    todayCount: Math.floor(number(focus.todayCount)), todayDay: day(focus.todayDay),
    totalMinutes: number(focus.totalMinutes), distractions: Math.floor(number(focus.distractions)),
  }
  if (!pet.focus.endsAt) pet.focus.phase = 'idle'
  // 每日专注账：老存档没有这个字段；非法日期或非数字直接丢弃（不猜、不补零）
  const focusLog = object(src.focusLog)
  pet.focusLog = {}
  for (const [key, value] of Object.entries(focusLog)) {
    const d = day(key)
    if (!d) continue
    const entry = object(value)
    const m = number(entry.m, 0, 1440)
    const r = number(entry.r, 0, 99)
    if (m > 0 || r > 0) pet.focusLog[d] = { m, r }
  }
  const guard = object(src.guard)
  pet.guard = { enabled: bool(guard.enabled), strict: bool(guard.strict), whitelist: text(guard.whitelist, pet.guard.whitelist, 2000) }
  const seenTodos = new Set<number>()
  pet.todos = list(src.todos).flatMap((value) => {
    const item = object(value)
    const title = text(item.text, '', 40).trim()
    const id = number(item.id)
    if (!title || !id || seenTodos.has(id)) return []
    seenTodos.add(id)
    return [{ id, text: title, done: bool(item.done), createdAt: number(item.createdAt, 0, 8.64e15), ...(typeof item.doneAt === 'number' ? { doneAt: number(item.doneAt, 0, 8.64e15) } : {}) }]
  })
  const codex = object(src.codex)
  pet.codex = { kills: counts(codex.kills), equips: ids(codex.equips, EQUIP_POOL.map((item) => item.id)) }
  pet.neidan = counts(src.neidan)
  const cosmetics = object(src.cosmetics)
  const owned = ids(cosmetics.owned, COSMETICS.map((item) => item.id))
  pet.cosmetics = { owned, active: typeof cosmetics.active === 'string' && owned.includes(cosmetics.active) ? cosmetics.active : null }
  pet.skin = typeof src.skin === 'string' && /^[a-z0-9-]{1,40}$/.test(src.skin) ? src.skin : null
  pet.look = LOOKS.some((l) => l.id === src.look) ? (src.look as string) : null
  const companion = object(src.companion)
  pet.companion = { name: text(companion.name, pet.companion.name, 8).trim() || pet.companion.name, bond: number(companion.bond, 0, 100) }
  const diary = object(src.diary)
  pet.diary = { day: day(diary.day), kills: number(diary.kills), victories: number(diary.victories), focusCount: number(diary.focusCount) }
  const last = object(src.diaryLast)
  pet.diaryLast = day(last.day) ? { day: day(last.day), lines: list(last.lines).filter((line): line is string => typeof line === 'string').map((line) => line.slice(0, 500)) } : null
  return pet
}

export interface SaveStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export function loadPet(storage: SaveStorage): { state: PetState; canSave: boolean; recovered: boolean } {
  let raw: string | null
  try { raw = storage.getItem(SAVE_KEY) } catch { return { state: initialPet(), canSave: false, recovered: false } }
  if (!raw) return { state: initialPet(), canSave: true, recovered: false }
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { parsed = null }
  const state = normalizePet(parsed)
  const recovered = JSON.stringify(parsed) !== JSON.stringify(state)
  if (recovered) {
    // Back up first. If storage is full, keep the original save untouched.
    try {
      let hash = 2166136261
      for (let i = 0; i < raw.length; i++) hash = Math.imul(hash ^ raw.charCodeAt(i), 16777619)
      const key = `${SAVE_KEY}-backup-${(hash >>> 0).toString(16)}`
      if (storage.getItem(key) !== raw) storage.setItem(key, raw)
    } catch { return { state, canSave: false, recovered: true } }
  }
  return { state, canSave: true, recovered }
}
