const { contextBridge, ipcRenderer } = require('electron')
const subscribe = (channel, cb) => {
  const listener = (_event, ...args) => cb(...args)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}
contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  windowRole: process.argv.includes('--window-role=game') ? 'game' : 'pet',
  petMode: () => ipcRenderer.send('mode:pet'),
  gameMode: (mode = 'home') => ipcRenderer.send('mode:game', mode),
  setClickThrough: on => ipcRenderer.send('clickthrough:set', on),
  setHitTest: interactive => ipcRenderer.send('hit-test:set', interactive),
  dragPet: (dx, dy) => ipcRenderer.send('pet:drag', dx, dy),
  rendererReady: () => ipcRenderer.send('renderer:ready'),
  rendererFailed: message => ipcRenderer.send('renderer:failed', message),
  publishPetState: (state, messages) => ipcRenderer.send('pet:publish', state, messages),
  getPetState: () => ipcRenderer.invoke('pet:get-state'),
  listPacks: () => ipcRenderer.invoke('packs:list'),
  onPetState: cb => subscribe('pet:state', cb),
  dispatchPetAction: action => ipcRenderer.send('pet:dispatch', action),
  onPetAction: cb => subscribe('pet:action', cb),
  quit: () => ipcRenderer.send('app:quit'),
  onOpenMode: cb => subscribe('mode:open', cb),
  onOpenHome: cb => subscribe('tray:open-home', cb),
  startGuard: (whitelist, strict) => ipcRenderer.send('guard:start', { whitelist, strict }),
  stopGuard: () => ipcRenderer.send('guard:stop'),
  onDistraction: cb => subscribe('guard:distraction', cb),
  onTrayAction: cb => subscribe('tray:action', cb),
  onMusic: cb => subscribe('music:state', cb),
  onMusicTrack: cb => subscribe('music:track', cb),
  setWander: on => ipcRenderer.send('wander:set', on),
  setFollow: on => ipcRenderer.send('follow:set', on),
  log: (level, tag, msg, extra) => ipcRenderer.send('log:renderer', level, tag, msg, extra),
  onVerbose: cb => subscribe('log:verbose', cb),
})
