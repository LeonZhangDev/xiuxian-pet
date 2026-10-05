// Electron owns windows and transports state; the pet renderer owns the simulation.
const { app, BrowserWindow, ipcMain, screen, Tray, Menu, shell, protocol, net } = require('electron')
const { pathToFileURL } = require('url')
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const log = require('./logger.cjs')
const PET_SIZE = { width: 360, height: 500 }
const GAME_SIZE = { width: 1180, height: 840 }
const stateFile = () => path.join(app.getPath('userData'), 'win-state.json')
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json')
const packsDir = () => path.join(app.getPath('userData'), 'packs')
// 扫描用户资源包：packs/<包id>/manifest.json，id 必须与目录同名且含 frames 列表
function scanPacks() {
  const out = []
  try {
    for (const entry of fs.readdirSync(packsDir(), { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^[a-z0-9-]{1,40}$/.test(entry.name)) continue
      try {
        const m = JSON.parse(fs.readFileSync(path.join(packsDir(), entry.name, 'manifest.json'), 'utf8'))
        const okAction = Array.isArray(m?.frames) && m.frames.length > 0
        const okSkin = m?.kind === 'skin' && m?.poses && Object.keys(m.poses).length > 0
        if (m && m.id === entry.name && (okAction || okSkin)) out.push(m)
        else log.warn('packs', `跳过无效资源包：${entry.name}`)
      } catch (err) { log.warn('packs', `资源包读取失败：${entry.name}`, String(err)) }
    }
  } catch { /* packs 目录不存在属正常 */ }
  return out
}
function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return fallback } }
const settings = { openAtLogin: false, ...readJson(settingsFile(), {}) }
function writeJson(file, value) { try { fs.writeFileSync(file, JSON.stringify(value)) } catch (err) { log.warn('storage', String(err)) } }
let win = null, gameWin = null, recoveryWin = null, tray = null
let isQuitting = false, ghostOn = false, interactive = false
let pendingMode = 'home', snapshot = null, saveTimer = null
let wanderOn = false, followOn = false, wanderTimer = null, followTimer = null, glideTimer = null
let guardProc = null, musicProc = null, musicOn = false, musicTrack = ''
const lifecycle = new Map()
const live = w => !!w && !w.isDestroyed()
const petSender = e => live(win) && e.sender === win.webContents
const gameSender = e => live(gameWin) && e.sender === gameWin.webContents
const trusted = e => petSender(e) || gameSender(e)
function sendPet(channel, value) { if (live(win)) win.webContents.send(channel, value) }
// 两个窗口都要知道的状态（如系统放歌）：洞府里的小仙也得跟着起舞
function broadcast(channel, value) {
  if (live(win)) win.webContents.send(channel, value)
  if (live(gameWin)) gameWin.webContents.send(channel, value)
}
function clampPosition(x, y) {
  const wa = screen.getDisplayMatching({ x: Math.round(x), y: Math.round(y), ...PET_SIZE }).workArea
  return [Math.round(Math.max(wa.x, Math.min(x, wa.x + Math.max(0, wa.width - PET_SIZE.width)))), Math.round(Math.max(wa.y, Math.min(y, wa.y + Math.max(0, wa.height - PET_SIZE.height))))]
}
function savePosition() { if (live(win)) { const { x, y } = win.getBounds(); writeJson(stateFile(), { x, y }) } }
function applyHitTest() {
  if (!live(win)) return
  const ready = lifecycle.get(win.webContents.id)?.ready === true
  const status = lifecycle.get(win.webContents.id)
  const ignored = ghostOn || !ready || !interactive
  if (status?.ignored === ignored) return
  win.setIgnoreMouseEvents(ignored, { forward: true })
  if (status) status.ignored = ignored
}
function loadPage(target) {
  const promise = process.env.ELECTRON_DEV_URL ? target.loadURL(process.env.ELECTRON_DEV_URL) : target.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  promise.catch(err => { if (!isQuitting) showRecovery(String(err)) })
}
function showRecovery(message) {
  interactive = false
  applyHitTest()
  if (isQuitting || live(recoveryWin)) return
  log.error('recovery', String(message))
  recoveryWin = new BrowserWindow({ width: 500, height: 270, title: '桌面小仙 · 恢复', resizable: false, webPreferences: { contextIsolation: true, nodeIntegration: false } })
  const escaped = String(message).slice(0, 350).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
  recoveryWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<html lang="zh"><meta charset="utf-8"><body style="font:16px sans-serif;padding:24px"><h2>小仙暂时无法显示</h2><p>${escaped}</p><p>请在托盘菜单选择「恢复桌宠 / 重新加载」。日志已保留。</p></body></html>`)).catch(err => log.error('recovery', String(err)))
  recoveryWin.on('closed', () => { recoveryWin = null })
}
function watchRenderer(target, role) {
  const id = target.webContents.id
  const status = { retries: 0, timer: null, ready: false }
  lifecycle.set(id, status)
  const arm = () => {
    clearTimeout(status.timer)
    status.ready = false
    if (role === 'pet') { interactive = false; applyHitTest() }
    status.timer = setTimeout(() => showRecovery(`${role === 'pet' ? '桌宠' : '洞府'}启动超时，请从托盘恢复。`), 12000)
  }
  const retry = reason => {
    clearTimeout(status.timer)
    if (isQuitting || !live(target)) return
    status.ready = false
    if (role === 'pet') { interactive = false; applyHitTest() }
    log.error('win', reason, { role, retries: status.retries })
    if (status.retries >= 2) { showRecovery(reason); return }
    status.retries += 1
    target.webContents.reloadIgnoringCache()
  }
  target.webContents.on('did-start-loading', arm)
  target.webContents.on('unresponsive', () => { clearTimeout(status.timer); status.timer = setTimeout(() => retry('窗口持续无响应'), 8000) })
  target.webContents.on('responsive', () => { clearTimeout(status.timer); if (!status.ready) arm() })
  target.webContents.on('render-process-gone', (_e, detail) => { if (detail.reason !== 'clean-exit') retry(`渲染进程退出：${detail.reason}`) })
  target.webContents.on('did-fail-load', (_e, code, desc, _url, mainFrame) => { if (mainFrame && code !== -3) showRecovery(`页面加载失败：${desc}`) })
  target.webContents.on('did-finish-load', () => log.info('win', '页面加载完成', { role }))
  target.webContents.on('console-message', (_e, level, message) => { if (level >= 3) log.error('renderer', message) })
  target.on('closed', () => { clearTimeout(status.timer); lifecycle.delete(id) })
}
function createWindow() {
  const prev = readJson(stateFile(), {})
  const wa = screen.getPrimaryDisplay().workArea
  const [x, y] = clampPosition(Number.isInteger(prev?.x) ? prev.x : wa.x + wa.width - PET_SIZE.width - 40, Number.isInteger(prev?.y) ? prev.y : wa.y + wa.height - PET_SIZE.height - 60)
  win = new BrowserWindow({ ...PET_SIZE, x, y, transparent: true, frame: false, resizable: false, alwaysOnTop: true, skipTaskbar: false, hasShadow: false, show: true, backgroundColor: '#00000000', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } })
  watchRenderer(win, 'pet')
  applyHitTest()
  win.setAlwaysOnTop(true, 'screen-saver')
  win.on('moved', () => { clearTimeout(saveTimer); saveTimer = setTimeout(savePosition, 750) })
  win.on('close', e => { savePosition(); if (!isQuitting && !process.env.PET_SELFTEST) { e.preventDefault(); win.hide() } })
  win.on('closed', () => { win = null })
  loadPage(win)
  if (process.env.PET_SELFTEST) win.webContents.once('did-finish-load', () => setTimeout(async () => {
    try { if (live(win)) fs.writeFileSync(path.join(__dirname, '..', 'desktop-shot.png'), (await win.capturePage()).toPNG()) } catch (err) { log.error('selftest', String(err)) }
    isQuitting = true; app.quit()
  }, 2500))
}
function restorePet() {
  if (!live(win)) createWindow()
  ghostOn = false
  interactive = false
  win.setPosition(...clampPosition(...win.getPosition()))
  if (win.isMinimized()) win.restore()
  win.show()
  applyHitTest()
  sendPet('tray:action', 'ghost-off')
  rebuildMenu()
}
function openGame(mode = 'home') {
  pendingMode = ['home', 'dungeon', 'tribulation', 'settings'].includes(mode) ? mode : 'home'
  if (!live(gameWin)) {
    gameWin = new BrowserWindow({ ...GAME_SIZE, minWidth: 700, minHeight: 500, title: '桌面小仙 · 洞府', backgroundColor: '#101322', show: false, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, additionalArguments: ['--window-role=game'] } })
    const target = gameWin
    watchRenderer(target, 'game')
    target.on('closed', () => { if (gameWin === target) gameWin = null; if (!isQuitting) restorePet() })
    loadPage(target)
  } else {
    gameWin.webContents.send('mode:open', pendingMode)
    if (snapshot) gameWin.webContents.send('pet:state', snapshot)
    gameWin.webContents.send('music:state', musicOn) // 洞府开晚了也要接上当前播放状态
    if (musicTrack) gameWin.webContents.send('music:track', musicTrack)
  }
  gameWin.setIgnoreMouseEvents(false)
  if (gameWin.isMinimized()) gameWin.restore()
  gameWin.show(); gameWin.focus()
}
function recover() {
  restorePet()
  if (live(gameWin)) gameWin.close()
  const status = lifecycle.get(win.webContents.id)
  if (status) status.retries = 0
  win.webContents.reloadIgnoringCache()
  if (live(recoveryWin)) recoveryWin.close()
}
function exportLogs() {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')
  const zipPath = path.join(app.getPath('desktop'), `xian-logs-${stamp}.zip`)
  const quote = value => "'" + value.replace(/'/g, "''") + "'"
  const ps = spawn('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path ${quote(path.join(log.dir(), '*'))} -DestinationPath ${quote(zipPath)} -Force`], { windowsHide: true })
  ps.on('error', err => log.error('tray', String(err)))
  ps.on('exit', code => { if (code === 0) shell.showItemInFolder(zipPath); else log.error('tray', '日志导出失败', { code }) })
}
function rebuildMenu() {
  if (!tray || tray.isDestroyed()) return
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示 / 隐藏桌宠', click: () => live(win) && win.isVisible() ? win.hide() : restorePet() },
    { label: '打开洞府', click: () => openGame('home') },
    { label: '设置', click: () => openGame('settings') },
    { label: '出外历练', click: () => sendPet('tray:action', 'dungeon') },
    ...[['喂食', 'feed'], ['洗澡', 'bathe'], ['吐纳', 'meditate']].map(([label, action]) => ({ label, click: () => sendPet('tray:action', action) })),
    { type: 'separator' },
    { label: '恢复桌宠 / 重新加载', click: recover },
    { label: '鼠标穿透', type: 'checkbox', checked: ghostOn, click: item => { ghostOn = item.checked; applyHitTest(); sendPet('tray:action', ghostOn ? 'ghost-on' : 'ghost-off') } },
    { label: '打开日志目录', click: () => { shell.openPath(log.dir()).catch(err => log.error('tray', String(err))) } },
    { label: '导出日志', click: exportLogs },
    { label: '详细日志模式', type: 'checkbox', checked: !!settings.verbose, click: item => { settings.verbose = item.checked; writeJson(settingsFile(), settings); log.setVerbose(item.checked); sendPet('log:verbose', item.checked) } },
    { label: '开机自启', type: 'checkbox', checked: !!settings.openAtLogin, click: item => { settings.openAtLogin = item.checked; writeJson(settingsFile(), settings); app.setLoginItemSettings({ openAtLogin: item.checked }) } },
    { label: '兼容模式（重启生效）', type: 'checkbox', checked: !!settings.gpuSafe, click: item => { settings.gpuSafe = item.checked; writeJson(settingsFile(), settings) } },
    { type: 'separator' },
    { label: '退出', click: () => { isQuitting = true; app.quit() } },
  ]))
}
function createTray() {
  tray = new Tray(path.join(__dirname, '..', 'build', 'tray.png'))
  tray.setToolTip('桌面小仙'); rebuildMenu()
  tray.on('click', () => live(win) && win.isVisible() ? win.hide() : restorePet())
}
ipcMain.on('mode:pet', e => { if (trusted(e)) { if (live(gameWin)) gameWin.close(); restorePet() } })
ipcMain.on('mode:game', (e, mode) => { if (petSender(e)) openGame(mode) })
ipcMain.on('clickthrough:set', (e, on) => { if (petSender(e) && typeof on === 'boolean') { ghostOn = on; applyHitTest(); rebuildMenu() } })
ipcMain.on('hit-test:set', (e, on) => { if (petSender(e) && typeof on === 'boolean') { interactive = on; applyHitTest() } })
ipcMain.on('pet:drag', (e, dx, dy) => {
  if (!petSender(e) || !Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) > 2000 || Math.abs(dy) > 2000) return
  clearInterval(glideTimer); glideTimer = null
  const [x, y] = win.getPosition(); win.setPosition(...clampPosition(x + dx, y + dy))
})
ipcMain.on('renderer:ready', e => {
  if (!trusted(e)) return
  const status = lifecycle.get(e.sender.id)
  if (status) { clearTimeout(status.timer); status.ready = true }
  if (petSender(e)) applyHitTest()
  if (gameSender(e)) { e.sender.send('mode:open', pendingMode); if (snapshot) e.sender.send('pet:state', snapshot) }
})
ipcMain.on('renderer:failed', (e, message) => { if (trusted(e)) { const status = lifecycle.get(e.sender.id); if (status) { clearTimeout(status.timer); status.ready = false } showRecovery(String(message)) } })
ipcMain.on('pet:publish', (e, state, messages) => { if (!petSender(e)) return; snapshot = { state, messages }; if (live(gameWin)) gameWin.webContents.send('pet:state', snapshot) })
ipcMain.handle('pet:get-state', e => trusted(e) ? snapshot : null)
ipcMain.handle('packs:list', e => trusted(e) ? scanPacks() : [])
ipcMain.on('pet:dispatch', (e, action) => { if (gameSender(e)) sendPet('pet:action', action) })
ipcMain.on('log:renderer', (e, level, tag, message, extra) => {
  if (!trusted(e)) return
  const fn = level === 'error' ? log.error : level === 'warn' ? log.warn : level === 'debug' ? log.debug : log.info
  fn(`ui:${String(tag).slice(0, 100)}`, String(message).slice(0, 10000), extra)
})
ipcMain.on('app:quit', e => { if (trusted(e)) { isQuitting = true; app.quit() } })
function stopGuard() { const old = guardProc; guardProc = null; if (old) old.kill() }
ipcMain.on('guard:start', (e, payload) => {
  if (!petSender(e)) return
  stopGuard()
  const wl = Array.isArray(payload?.whitelist) ? payload.whitelist.filter(item => typeof item === 'string').join(',') : ''
  const child = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'guard.ps1'), '-Whitelist', wl, '-Strict', payload?.strict ? '1' : '0'], { windowsHide: true })
  guardProc = child
  let buf = ''
  child.stdout.on('data', data => { if (child !== guardProc) return; buf = (buf + data.toString('utf8')).slice(-65536); let index; while ((index = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, index).trim(); buf = buf.slice(index + 1); if (line.startsWith('DISTRACT:')) sendPet('guard:distraction', line.slice(9)) } })
  child.on('error', err => log.error('guard', String(err)))
  child.on('exit', () => { if (guardProc === child) guardProc = null })
})
ipcMain.on('guard:stop', e => { if (petSender(e)) stopGuard() })
function glideTo(x, y, ms = 1200) {
  if (!live(win)) return
  clearInterval(glideTimer)
  ;[x, y] = clampPosition(x, y)
  const [sx, sy] = win.getPosition(), start = Date.now()
  glideTimer = setInterval(() => {
    if (!live(win)) { clearInterval(glideTimer); glideTimer = null; return }
    const k = Math.min(1, (Date.now() - start) / ms), ease = 1 - Math.pow(1 - k, 3)
    win.setPosition(...clampPosition(sx + (x - sx) * ease, sy + (y - sy) * ease))
    if (k >= 1) { clearInterval(glideTimer); glideTimer = null }
  }, 16)
}
ipcMain.on('wander:set', (e, on) => {
  if (!petSender(e)) return
  wanderOn = !!on
  clearInterval(wanderTimer); wanderTimer = null
  if (wanderOn) wanderTimer = setInterval(() => { if (!followOn && live(win) && win.isVisible()) { const [x, y] = win.getPosition(); glideTo(x + (Math.random() - 0.5) * 520, y + (Math.random() - 0.5) * 240, 1800) } }, 12000)
})
ipcMain.on('follow:set', (e, on) => {
  if (!petSender(e)) return
  followOn = !!on
  clearInterval(followTimer); followTimer = null
  if (followOn) followTimer = setInterval(() => { if (live(win) && win.isVisible()) { const cursor = screen.getCursorScreenPoint(); glideTo(cursor.x - PET_SIZE.width - 24, cursor.y - PET_SIZE.height / 2, 420) } }, 500)
})
function startMusicWatch() {
  const child = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'music.ps1')], { windowsHide: true })
  musicProc = child
  let buf = ''
  child.stdout.on('data', data => {
    if (musicProc !== child) return
    buf = (buf + data.toString('utf8')).slice(-65536)
    let index
    while ((index = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, index).trim()
      buf = buf.slice(index + 1)
      if (line === 'MUSIC:1' || line === 'MUSIC:0') { musicOn = line === 'MUSIC:1'; broadcast('music:state', musicOn) }
      else if (line.startsWith('MUSIC:TRACK:')) { musicTrack = line.slice(12).trim(); if (musicTrack) broadcast('music:track', musicTrack) }
    }
  })
  child.on('error', err => log.error('music', String(err)))
  child.on('exit', () => { if (musicProc === child) musicProc = null })
}
if (!app.requestSingleInstanceLock()) app.quit()
else {
  log.init(app); log.setVerbose(!!settings.verbose)
  log.info('app', '桌面小仙启动', { version: app.getVersion(), electron: process.versions.electron })
  process.on('uncaughtException', err => { log.error('app', String(err.stack || err)); if (app.isReady()) showRecovery(String(err)) })
  process.on('unhandledRejection', err => log.error('app', String(err)))
  if (process.env.PET_SAFE_GPU === '1' || settings.gpuSafe) app.disableHardwareAcceleration()
  else {
    // 非兼容模式：开足 GPU 加速（2D 画布/栅格化/零拷贝），副本与桌宠动画更顺滑
    app.commandLine.appendSwitch('enable-accelerated-2d-canvas')
    app.commandLine.appendSwitch('enable-gpu-rasterization')
    app.commandLine.appendSwitch('enable-zero-copy')
    app.commandLine.appendSwitch('ignore-gpu-blocklist')
  }
  app.on('second-instance', () => { restorePet(); if (win.webContents.isCrashed()) recover() })
  app.whenReady().then(() => {
    createWindow(); createTray(); startMusicWatch()
    if (settings.openAtLogin) app.setLoginItemSettings({ openAtLogin: true })
    const constrain = () => { if (live(win)) win.setPosition(...clampPosition(...win.getPosition())) }
    screen.on('display-removed', constrain); screen.on('display-metrics-changed', constrain)
  }).catch(err => { log.error('app', String(err)); if (app.isReady()) showRecovery(String(err)) })
  // pack:// 自定义协议：渲染进程加载用户资源包内的帧图片（白名单目录 + 防目录穿越）
  protocol.handle('pack', (req) => {
    try {
      const u = new URL(req.url)
      const id = u.hostname
      const file = decodeURIComponent(u.pathname.slice(1))
      if (!/^[a-z0-9-]{1,40}$/.test(id) || !file || file.includes('..') || path.isAbsolute(file)) return new Response('forbidden', { status: 403 })
      return net.fetch(pathToFileURL(path.join(packsDir(), id, file)).toString())
    } catch (err) {
      log.warn('packs', String(err))
      return new Response('bad request', { status: 400 })
    }
  })
}
app.on('window-all-closed', () => { if (isQuitting) app.quit() })
app.on('before-quit', () => {
  isQuitting = true
  clearTimeout(saveTimer); savePosition()
  for (const timer of [wanderTimer, followTimer, glideTimer]) clearInterval(timer)
  for (const status of lifecycle.values()) clearTimeout(status.timer)
  stopGuard(); if (musicProc) { musicProc.kill(); musicProc = null }
  log.info('app', '桌面小仙退出'); log.flush?.()
})
