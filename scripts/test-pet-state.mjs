import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const scratch = mkdtempSync(join(tmpdir(), 'xiuxian-pet-state-'))
try {
  for (const name of ['data', 'pet-store']) {
    const code = ts.transpileModule(readFileSync(resolve('src/game', `${name}.ts`), 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    }).outputText.replaceAll("from './data'", "from './data.mjs'")
    writeFileSync(join(scratch, `${name}.mjs`), code, 'utf8')
  }
  const { initialPet, reducePet, EQUIP_POOL } = await import(pathToFileURL(join(scratch, 'data.mjs')))
  const { normalizePet, loadPet, SAVE_KEY } = await import(pathToFileURL(join(scratch, 'pet-store.mjs')))
  const freeze = (value) => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) } return value }
  const source = initialPet()
  source.todos.push({ id: 123, text: '验证任务', done: false, createdAt: 1 })
  source.neidan.wolf = 10
  source.backpack.push({ ...EQUIP_POOL[0] })
  const before = JSON.stringify(source)
  freeze(source)
  const actions = [
    { type: 'tick', dt: 1 }, { type: 'startFocus', minutes: 25 },
    { type: 'setGuard', enabled: true, strict: true, whitelist: 'test' },
    { type: 'addTodo', text: '新任务' }, { type: 'toggleTodo', id: 123 },
    { type: 'dungeonResult', victory: true, died: false, loot: { stones: 1, herbs: 2, ore: 3 }, kills: 1, killsByKind: { wolf: 1 }, neidan: { wolf: 1 }, equip: EQUIP_POOL[1] },
    { type: 'equip', index: 0 }, { type: 'redeemCosmetic', id: 'mount-fox' }, { type: 'feedCompanion' },
  ]
  for (const action of actions) {
    const context = { now: 100000, todoId: 999 }
    const first = reducePet(source, action, context)
    const second = reducePet(source, action, context)
    assert.deepEqual(first, second, `${action.type}: deterministic replay`)
    assert.equal(JSON.stringify(source), before, `${action.type}: previous state untouched`)
  }
  const corrupt = { name: [], realm: 999, satiety: -99, cleanliness: Infinity, todos: 'bad', focus: { phase: 'unknown', endsAt: 'bad' }, codex: { equips: ['bad'] }, cosmetics: { owned: null, active: 'bad' }, equipped: { weapon: { id: 'unknown' } }, backpack: [null, { id: EQUIP_POOL[0].id, name: null }], companion: { bond: 500 }, diaryLast: { day: '2026-10-04', lines: [null, 'ok'] } }
  const safe = normalizePet(corrupt)
  assert.equal(safe.name, '小豆')
  assert.equal(safe.realm, 19)
  assert.equal(safe.satiety, 0)
  assert.equal(safe.cleanliness, 80)
  assert.deepEqual(safe.todos, [])
  assert.deepEqual(safe.equipped, {})
  assert.equal(safe.backpack[0].name, EQUIP_POOL[0].name)
  assert.equal(safe.focus.phase, 'idle')
  assert.equal(safe.companion.bond, 100)
  assert.deepEqual(safe.diaryLast.lines, ['ok'])
  for (const raw of ['{broken json', JSON.stringify(corrupt)]) {
    const values = new Map([[SAVE_KEY, raw]])
    const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
    const result = loadPet(storage)
    assert.equal(result.recovered, true)
    assert.equal(result.canSave, true)
    assert.equal(values.get(SAVE_KEY), raw)
    assert.ok([...values].some(([key, value]) => key.startsWith(`${SAVE_KEY}-backup-`) && value === raw))
    loadPet(storage)
    assert.equal(values.size, 2, 'Strict Mode recovery does not duplicate backups')
    const blocked = loadPet({ getItem: storage.getItem, setItem: () => { throw new Error('quota') } })
    // Existing backup means recovery can safely save; test a fresh corrupt save too.
    assert.equal(blocked.canSave, true)
    assert.equal(loadPet({ getItem: (key) => key === SAVE_KEY ? raw : null, setItem: () => { throw new Error('quota') } }).canSave, false)
  }
  console.log('PASS: 9 immutable deterministic actions; nested save recovery; original backups; quota protection')
} finally { rmSync(scratch, { recursive: true, force: true }) }
