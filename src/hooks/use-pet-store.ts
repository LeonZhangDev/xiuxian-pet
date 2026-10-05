import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { desktop } from '../lib/desktop-bridge'
import { initialPet, msg, reducePet, type ActionMsg, type PetAction, type PetState } from '../game/data'
import { loadPet, normalizePet, SAVE_KEY } from '../game/pet-store'

type Snapshot = { pet: PetState; messages: ActionMsg[]; ready: boolean }
const actionTypes = new Set(['tick', 'feed', 'bathe', 'meditate', 'seclude', 'brew', 'forge', 'enterDungeon', 'dungeonResult', 'equip', 'unequip', 'tribulationResult', 'rename', 'setGender', 'startFocus', 'cancelFocus', 'setGuard', 'distraction', 'addTodo', 'toggleTodo', 'removeTodo', 'redeemCosmetic', 'wearCosmetic', 'feedCompanion', 'renameCompanion', 'reset'])
function messageList(value: unknown): ActionMsg[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is ActionMsg => item !== null && typeof item === 'object' && typeof item.id === 'number' && Number.isFinite(item.id) && typeof item.text === 'string' && ['info', 'good', 'bad'].includes(item.kind)).slice(-6).map((item) => ({ ...item, text: item.text.slice(0, 1000) }))
}

/** The pet renderer owns simulation and storage; the game renderer is a subscriber. */
export function usePetStore(): { pet: PetState; messages: ActionMsg[]; dispatch: (action: PetAction) => void; setMessages: Dispatch<SetStateAction<ActionMsg[]>>; ready: boolean } {
  const owner = desktop?.windowRole !== 'game'
  const [snapshot, setSnapshot] = useState<Snapshot>(() => ({ pet: initialPet(), messages: [], ready: false }))
  const current = useRef(snapshot)
  const canSave = useRef(false)
  const actionSequence = useRef(0)
  const messageSequence = useRef(0)
  const commit = useCallback((next: Snapshot) => {
    current.current = next
    setSnapshot(next)
    if (owner) desktop?.publishPetState(next.pet, next.messages)
  }, [owner])
  const apply = useCallback((action: PetAction) => {
    if (!current.current.ready) return
    const now = Date.now()
    messageSequence.current = Math.max(messageSequence.current, now * 1000)
    const result = reducePet(current.current.pet, action, { now, todoId: now * 1000 + (actionSequence.current++ % 1000), messageId: messageSequence.current })
    messageSequence.current += result.messages.length + 1
    commit({ pet: normalizePet(result.state), messages: [...current.current.messages, ...result.messages].slice(-6), ready: true })
  }, [commit])
  const dispatch = useCallback((action: PetAction) => {
    if (!current.current.ready) return
    if (owner) apply(action)
    else desktop?.dispatchPetAction(action)
  }, [apply, owner])
  const setMessages: Dispatch<SetStateAction<ActionMsg[]>> = useCallback((update) => {
    if (!current.current.ready) return
    const next = messageList(typeof update === 'function' ? update(current.current.messages) : update)
    if (owner) commit({ ...current.current, messages: next })
    else {
      // Forward only added messages. A stale game snapshot must not erase owner messages.
      const known = new Set(current.current.messages.map((item) => `${item.id}:${item.text}`))
      desktop?.dispatchPetAction({ type: '__messages', messages: next.filter((item) => !known.has(`${item.id}:${item.text}`)) })
    }
  }, [commit, owner])

  useEffect(() => {
    if (!owner) {
      let live = true
      let received = false
      const receive = (value: { state: unknown; messages: unknown }) => {
        if (!live) return
        received = true
        commit({ pet: normalizePet(value.state), messages: messageList(value.messages), ready: true })
      }
      const unsubscribe = desktop?.onPetState(receive)
      void desktop?.getPetState().then((value: { state: unknown; messages: unknown } | null) => { if (value && !received) receive(value) }).catch((error: unknown) => console.error('读取桌宠状态失败', error))
      return () => { live = false; unsubscribe?.() }
    }
    if (!current.current.ready) {
      const loaded = loadPet(localStorage)
      canSave.current = loaded.canSave
      // Hydrate once from external storage after mount: recovery writes must stay outside render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      commit({ pet: loaded.state, ready: true, messages: loaded.recovered ? [msg(loaded.canSave ? '存档异常字段已恢复，原文已备份。' : '存档已恢复，但备份写入失败；暂停自动保存以保留原文。', 'info')] : [] })
    }
    const unsubscribe = desktop?.onPetAction((value: unknown) => {
      if (!value || typeof value !== 'object') return
      const input = value as Record<string, unknown>
      if (input.type === '__messages') {
        commit({ ...current.current, messages: [...current.current.messages, ...messageList(input.messages)].slice(-6) })
      } else if (typeof input.type === 'string' && actionTypes.has(input.type)) {
        // IPC payloads are checked before entering the domain reducer.
        try { apply(input as PetAction) } catch (error) { console.error('无效桌宠操作', error) }
      }
    })
    const save = () => {
      if (!canSave.current || !current.current.ready) return
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(current.current.pet)) } catch (error) { console.error('保存桌宠失败', error) }
    }
    let lastTick = performance.now()
    const tick = window.setInterval(() => {
      const now = performance.now()
      const dt = Math.min(60, (now - lastTick) / 1000)
      lastTick = now
      apply({ type: 'tick', dt })
    }, 1000)
    const autosave = window.setInterval(save, 3000)
    window.addEventListener('pagehide', save)
    window.addEventListener('beforeunload', save)
    return () => {
      unsubscribe?.()
      window.clearInterval(tick)
      window.clearInterval(autosave)
      window.removeEventListener('pagehide', save)
      window.removeEventListener('beforeunload', save)
      save()
    }
  }, [owner, apply, commit])

  return { ...snapshot, dispatch, setMessages }
}
